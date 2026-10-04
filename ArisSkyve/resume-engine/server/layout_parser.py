"""Local PDF -> editable positioned text, without sending the document to a model.

The raster decoration layer is generated AFTER removing PDF text operators. It is
not a screenshot of the original text. Original bytes are retained by the caller.
"""
import base64
import json
import math
import os
import re
import subprocess
import time
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

import pymupdf as fitz
from fastapi import HTTPException

OCR_HELPER = Path(__file__).with_name('ocr_sidecar.py')
OCR_TIMEOUT_SECONDS = 90
OCR_DOCUMENT_TIMEOUT_SECONDS = 145
OCR_MAX_SCAN_PAGES = 3
OCR_MAX_INPUT_BYTES = 6_000_000
OCR_MAX_RESPONSE_BYTES = 8_000_000
OCR_MIN_CONFIDENCE = .70
OCR_MAX_ROTATION = 3
OCR_MAX_MASK_COVERAGE = .35
LAYOUT_MAX_TOTAL_ELEMENTS = 6_000
LAYOUT_MAX_OUTPUT_BYTES = 9_000_000
LAYOUT_BACKGROUND_MAX_SCALE = 2.5
LAYOUT_BACKGROUND_MAX_PIXELS = 4_000_000
LAYOUT_BACKGROUND_JPEG_QUALITY = 92
OCR_PREFLIGHT_TIMEOUT_SECONDS = 2
VISIBLE_TEXT_RENDER_MODES = frozenset((0, 1, 2, 4, 5, 6))
FULL_PAGE_IMAGE_COVERAGE = .65
FULL_PAGE_IMAGE_TEXT_COVERAGE = .80
LINK_TEXT_MIN_COVERAGE = .80
FULL_PAGE_SCAN_IMAGE_COVERAGE = .90
SPARSE_SCAN_OVERLAY_MAX_TRACES = 2
SPARSE_SCAN_OVERLAY_MAX_CHARS = 48
SPARSE_SCAN_OVERLAY_MAX_FONT_SIZE = 12
SCANNER_STAMP_MAX_TRACES = 4
SCANNER_STAMP_MAX_CHARS = 160
SCANNER_STAMP_MAX_FONT_SIZE = 14
SCANNER_STAMP_EDGE_FRACTION = .12
SCANNER_STAMP_MARKERS = (
    'scanned with', 'scanned by', 'scan with', 'camscanner', 'cam scanner',
    'adobe scan', 'microsoft lens', 'office lens', 'abbyy finereader',
    'scanner pro', 'genius scan', 'swift scan', 'scanbot', 'notebloc',
    'vflat scan', 'clear scan', 'quet bang', 'duoc quet',
)


def normalized_font_family(value):
    """Convert a PDF face name into a CSS family name, not a face name.

    PDF spans commonly use names such as ``ABCDEF+Calibri-Bold`` or
    ``Arial-BoldMT``. CSS needs the family (Calibri / Arial); bold and italic
    are supplied separately from the span flags.
    """
    value = re.sub(r'^[A-Z]{6}\+', '', str(value or '')).strip()
    compact = re.sub(r'[\s,._-]+', '', value).lower()
    aliases = (
        ('timesnewroman', 'Times New Roman'), ('calibrilight', 'Calibri Light'),
        ('calibri', 'Calibri'), ('cambria', 'Cambria'), ('arial', 'Arial'),
        ('helvetica', 'Helvetica'), ('couriernew', 'Courier New'), ('courier', 'Courier'),
        ('georgia', 'Georgia'), ('verdana', 'Verdana'), ('tahoma', 'Tahoma'),
        ('segoeui', 'Segoe UI'), ('garamond', 'Garamond'), ('palatino', 'Palatino Linotype'),
    )
    for prefix, family in aliases:
        if compact.startswith(prefix):
            return family
    # Retain unfamiliar families, but remove common PostScript face suffixes.
    family = re.sub(r'(?i)(?:[-, _]?(?:bolditalic|boldoblique|italic|oblique|bold|regular|roman|psmt|mt))+$', '', value)
    return family.strip(' -,_') or 'sans-serif'


def visible_text_trace_details(page):
    """Return display-list data for text that is actually painted by a page.

    A scanned image can carry an invisible OCR layer. ``get_text`` exposes
    that layer, but text-trace render mode 3 identifies it as non-visible.
    """
    details = []
    for trace in page.get_texttrace():
        if trace.get('type') not in VISIBLE_TEXT_RENDER_MODES:
            continue
        opacity = trace.get('opacity', 1)
        if not isinstance(opacity, (int, float)) or opacity <= 0:
            continue
        if not trace.get('chars'):
            continue
        try:
            rect = fitz.Rect(trace['bbox'])
        except (KeyError, TypeError, ValueError):
            continue
        if rect.is_empty or rect.get_area() <= 0:
            continue
        characters = []
        for item in trace['chars']:
            if not isinstance(item, (tuple, list)) or not item:
                continue
            codepoint = item[0]
            if not isinstance(codepoint, int) or isinstance(codepoint, bool) or not 0 <= codepoint <= 0x10ffff:
                continue
            character = chr(codepoint)
            if character.isprintable():
                characters.append(character)
        details.append({
            'rect': rect,
            'sequence': trace.get('seqno'),
            'text': ''.join(characters),
            'font_size': trace.get('size'),
        })
    return details


def visible_text_bounds(page):
    return [detail['rect'] for detail in visible_text_trace_details(page)]


def span_is_visible(span, visible_bounds):
    try:
        span_rect = fitz.Rect(span['bbox'])
    except (KeyError, TypeError, ValueError):
        return False
    span_area = span_rect.get_area()
    if span_area <= 0:
        return False
    for visible in visible_bounds:
        overlap = span_rect & visible
        if not overlap.is_empty and overlap.get_area() / span_area >= .25:
            return True
    return False


def safe_link_uri(value):
    if not isinstance(value, str) or len(value) > 2000:
        return None
    parsed = urlparse(value)
    if parsed.scheme in ('http', 'https') and parsed.netloc:
        return value
    if parsed.scheme == 'mailto' and parsed.path:
        return value
    return None


def page_uri_links(page):
    links = []
    for link in page.get_links():
        uri = safe_link_uri(link.get('uri'))
        if not uri:
            continue
        try:
            rect = fitz.Rect(link['from'])
        except (KeyError, TypeError, ValueError):
            continue
        if not rect.is_empty and rect.get_area() > 0:
            links.append((rect, uri))
    return links


def span_href(span_rect, links):
    """Return a URI only when its annotation contains most of this text.

    PDF producers regularly make a link annotation a little wider than its
    visible label.  Treating any one-pixel intersection as a link makes the
    title next to an email address clickable as ``mailto:``.  Choose the most
    contained safe annotation instead, while allowing normal annotation
    padding around the linked text.
    """
    span_area = span_rect.get_area()
    if span_area <= 0:
        return None
    match = None
    for link_rect, uri in links:
        overlap = span_rect & link_rect
        if overlap.is_empty:
            continue
        coverage = overlap.get_area() / span_area
        if coverage >= LINK_TEXT_MIN_COVERAGE and (match is None or coverage > match[0]):
            match = (coverage, uri)
    return match[1] if match else None


def ocr_capability():
    executable_value = os.environ.get('RESUME_OCR_PYTHON', '').strip()
    model_value = os.environ.get('RESUME_OCR_MODEL_DIR', '').strip()
    if not executable_value:
        return {'layoutOcr': False, 'layoutOcrReason': 'ocr_python_not_configured'}
    if not Path(executable_value).is_file():
        return {'layoutOcr': False, 'layoutOcrReason': 'ocr_python_not_found'}
    if not model_value:
        return {'layoutOcr': False, 'layoutOcrReason': 'ocr_model_dir_not_configured'}
    if not Path(model_value).is_dir():
        return {'layoutOcr': False, 'layoutOcrReason': 'ocr_model_dir_not_found'}
    if not OCR_HELPER.is_file():
        return {'layoutOcr': False, 'layoutOcrReason': 'ocr_helper_not_found'}
    try:
        if not any(Path(model_value).iterdir()):
            return {'layoutOcr': False, 'layoutOcrReason': 'ocr_model_dir_empty'}
        executable, environment = ocr_environment()
        # Do not import EasyOCR here: that can load Torch and make an ordinary
        # capabilities request expensive.  find_spec detects a misprovisioned
        # isolated interpreter before the UI offers the explicit OCR action.
        probe = subprocess.run(
            [str(executable), '-I', '-c',
             "import importlib.util,sys;sys.exit(not all(importlib.util.find_spec(n) for n in ('easyocr','cv2','numpy','PIL')))"],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            cwd=str(OCR_HELPER.parent), env=environment, timeout=OCR_PREFLIGHT_TIMEOUT_SECONDS, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return {'layoutOcr': False, 'layoutOcrReason': 'ocr_runtime_not_ready'}
    if probe.returncode:
        return {'layoutOcr': False, 'layoutOcrReason': 'ocr_runtime_dependencies_missing'}
    return {'layoutOcr': True, 'layoutOcrReason': None}


def layout_error(status, code, error, actions=()):
    raise HTTPException(status, {'error': error, 'code': code, 'actions': list(actions)})


def scan_detected(page_number):
    layout_error(422, 'layout_scan_detected',
                 f'Trang {page_number} là ảnh scan hoặc có ảnh phủ gần hết trang. Chữ gốc chưa bị thay đổi.',
                 ({'id': 'use-layout-ocr', 'label': 'Dùng OCR cục bộ để giữ bố cục'},
                  {'id': 'use-template', 'label': 'Chuyển sang mẫu Studio mới'}))


def ocr_actions():
    return ({'id': 'use-layout', 'label': 'Giữ bố cục PDF có lớp chữ'},
            {'id': 'use-template', 'label': 'Chuyển sang mẫu Studio mới'})


def ocr_error(status, code, error):
    layout_error(status, code, error, ocr_actions())


def require_ocr_capability():
    if not ocr_capability()['layoutOcr']:
        ocr_error(503, 'ocr_unavailable', 'OCR giữ bố cục chưa sẵn sàng trên máy chủ này. File gốc chưa bị thay đổi.')


def ocr_environment():
    executable = Path(os.environ['RESUME_OCR_PYTHON']).resolve()
    model_dir = Path(os.environ['RESUME_OCR_MODEL_DIR']).resolve()
    system_root = os.environ.get('SYSTEMROOT', '')
    temp = os.environ.get('TEMP') or os.environ.get('TMP') or str(Path.cwd())
    path_parts = [str(executable.parent)]
    if system_root:
        path_parts.extend([str(Path(system_root) / 'System32'), system_root])
    environment = {
        'PATH': os.pathsep.join(path_parts), 'SYSTEMROOT': system_root, 'WINDIR': os.environ.get('WINDIR', system_root),
        'TEMP': temp, 'TMP': temp, 'USERPROFILE': os.environ.get('USERPROFILE', ''),
        'RESUME_OCR_MODEL_DIR': str(model_dir), 'RESUME_OCR_LANGUAGES': os.environ.get('RESUME_OCR_LANGUAGES', 'vi,en'),
        'RESUME_OCR_GPU': os.environ.get('RESUME_OCR_GPU', '0'),
        'NO_PROXY': '*', 'HTTP_PROXY': '', 'HTTPS_PROXY': '', 'ALL_PROXY': '', 'PIP_NO_INDEX': '1',
    }
    return executable, environment


def run_ocr_sidecar(image, timeout_seconds=OCR_TIMEOUT_SECONDS):
    require_ocr_capability()
    if not 0 < len(image) <= OCR_MAX_INPUT_BYTES:
        ocr_error(413, 'ocr_image_too_large', 'Ảnh trang OCR vượt giới hạn an toàn.')
    try:
        timeout = float(timeout_seconds)
    except (TypeError, ValueError):
        timeout = 0
    if not math.isfinite(timeout) or timeout <= 0:
        ocr_error(504, 'ocr_document_timeout', 'OCR processing exceeded its safe document deadline.')
    executable, environment = ocr_environment()
    payload = json.dumps({'image': base64.b64encode(image).decode('ascii')}, separators=(',', ':')).encode('utf-8')
    try:
        process = subprocess.run([str(executable), '-I', str(OCR_HELPER)], input=payload, stdout=subprocess.PIPE,
                                 stderr=subprocess.DEVNULL, cwd=str(OCR_HELPER.parent), env=environment,
                                 timeout=min(OCR_TIMEOUT_SECONDS, timeout), check=False)
    except subprocess.TimeoutExpired:
        ocr_error(504, 'ocr_timeout', 'OCR cục bộ mất quá nhiều thời gian. Hãy thử PDF ít trang hoặc rõ nét hơn.')
    except OSError:
        ocr_error(503, 'ocr_unavailable', 'Không thể khởi động OCR cục bộ. File gốc chưa bị thay đổi.')
    if len(process.stdout) > OCR_MAX_RESPONSE_BYTES:
        ocr_error(413, 'ocr_result_too_large', 'Kết quả OCR vượt giới hạn an toàn.')
    try:
        result = json.loads(process.stdout.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        ocr_error(503, 'ocr_runtime_unavailable', 'OCR cục bộ không trả về dữ liệu hợp lệ. File gốc chưa bị thay đổi.')
    if not isinstance(result, dict):
        ocr_error(503, 'ocr_runtime_unavailable', 'OCR cục bộ không trả về dữ liệu hợp lệ. File gốc chưa bị thay đổi.')
    sidecar_error = result.get('error')
    if isinstance(sidecar_error, dict):
        code = sidecar_error.get('code')
        if code == 'ocr_no_text':
            ocr_error(422, 'ocr_no_text', 'Không nhận được chữ đủ tin cậy từ ảnh scan. Hãy dùng bản PDF rõ hơn hoặc mẫu Studio mới.')
        ocr_error(503, 'ocr_runtime_unavailable', 'OCR cục bộ chưa sẵn sàng hoặc thiếu model cài đặt. File gốc chưa bị thay đổi.')
    if process.returncode:
        ocr_error(503, 'ocr_runtime_unavailable', 'OCR cục bộ chưa sẵn sàng. File gốc chưa bị thay đổi.')
    return result


def page_size(page):
    width, height = page.rect.width, page.rect.height
    if not all(math.isfinite(value) and 10 <= value <= 2000 for value in (width, height)):
        raise HTTPException(422, 'Kích thước trang PDF không được hỗ trợ.')
    return width, height


def full_page_images(page, width, height):
    """Return image paint records that cover most of the page.

    ``number`` is MuPDF's display-list sequence number.  It is comparable to
    the ``seqno`` returned by ``get_texttrace()`` and therefore lets us tell a
    decorative image painted *behind* text from an opaque scan painted over
    it.
    """
    area = width * height
    if area <= 0:
        return []
    images = []
    for info in page.get_image_info():
        try:
            rect = fitz.Rect(info['bbox'])
        except (KeyError, TypeError, ValueError):
            continue
        if rect.is_empty or rect.get_area() / area <= FULL_PAGE_IMAGE_COVERAGE:
            continue
        sequence = info.get('number')
        if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 0:
            continue
        images.append((rect, sequence))
    return images


def page_has_full_page_image(page, width, height):
    return bool(full_page_images(page, width, height))


def page_has_text_below_full_page_image(page, width, height):
    """Whether an image covering most of a page was painted after its text.

    Some scanner exports retain a selectable OCR/text layer *under* the
    rasterized page.  Text extraction calls that layer "visible" because its
    PDF render mode is normal, but it is hidden by the later opaque image and
    would otherwise be emitted as duplicate, editable text.  Compare the PDF
    display-list order rather than guessing from text/image area.
    """
    images = full_page_images(page, width, height)
    if not images:
        return False
    for detail in visible_text_trace_details(page):
        sequence = detail['sequence']
        if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 0:
            continue
        text_rect = detail['rect']
        text_area = text_rect.get_area()
        if text_rect.is_empty or text_area <= 0:
            continue
        for image_rect, image_sequence in images:
            overlap = text_rect & image_rect
            if (image_sequence > sequence and not overlap.is_empty
                    and overlap.get_area() / text_area >= FULL_PAGE_IMAGE_TEXT_COVERAGE):
                return True
    return False


def normalized_scanner_stamp_text(value):
    """Normalize a short overlay for scanner-brand matching without OCR."""
    value = unicodedata.normalize('NFKD', str(value or ''))
    value = ''.join(character for character in value if not unicodedata.combining(character))
    return re.sub(r'[^a-z0-9]+', ' ', value.lower()).strip()


def text_is_near_page_edge(rect, width, height):
    inset_x, inset_y = width * SCANNER_STAMP_EDGE_FRACTION, height * SCANNER_STAMP_EDGE_FRACTION
    return rect.x0 <= inset_x or rect.x1 >= width - inset_x or rect.y0 <= inset_y or rect.y1 >= height - inset_y


def page_has_sparse_scanner_overlay(page, width, height):
    """Detect a scanner watermark above a nearly full-page raster image.

    A normal PDF can intentionally place decorative artwork before editable
    text, so a large image alone is not enough.  This only rejects text that
    is entirely painted *after* a nearly full-page image and looks like an
    edge watermark: either a known scanner-app signature, or at most two tiny
    edge fragments.  It deliberately does not guess about dense or central
    native text, which preserves real PDFs using image backgrounds.
    """
    page_area = width * height
    if page_area <= 0:
        return False
    images = [(rect, sequence) for rect, sequence in full_page_images(page, width, height)
              if rect.get_area() / page_area >= FULL_PAGE_SCAN_IMAGE_COVERAGE]
    details = visible_text_trace_details(page)
    if not images or not details:
        return False

    for image_rect, image_sequence in images:
        overlays = []
        for detail in details:
            sequence = detail['sequence']
            text_rect = detail['rect']
            text_area = text_rect.get_area()
            overlap = text_rect & image_rect
            if (isinstance(sequence, int) and not isinstance(sequence, bool) and sequence > image_sequence
                    and text_area > 0 and not overlap.is_empty
                    and overlap.get_area() / text_area >= FULL_PAGE_IMAGE_TEXT_COVERAGE):
                overlays.append(detail)

        # All painted text must be this image's overlay.  If the page has other
        # native text, it is not a sparse watermark-only scan.
        if len(overlays) != len(details):
            continue

        # Traces can split a watermark at a font or glyph boundary; preserve a
        # separator so "Scanned" + "with CamScanner" still matches.
        raw_text = ' '.join(detail['text'] for detail in overlays)
        non_space_characters = ''.join(character for character in raw_text if not character.isspace())
        if not non_space_characters or not all(text_is_near_page_edge(detail['rect'], width, height) for detail in overlays):
            continue

        normalized = normalized_scanner_stamp_text(raw_text)
        known_stamp = any(marker in normalized for marker in SCANNER_STAMP_MARKERS)
        font_sizes = [detail['font_size'] for detail in overlays]
        if (known_stamp and len(overlays) <= SCANNER_STAMP_MAX_TRACES
                and len(non_space_characters) <= SCANNER_STAMP_MAX_CHARS
                and all(isinstance(size, (int, float)) and not isinstance(size, bool)
                        and size <= SCANNER_STAMP_MAX_FONT_SIZE for size in font_sizes)):
            return True

        if (len(overlays) <= SPARSE_SCAN_OVERLAY_MAX_TRACES
                and len(non_space_characters) <= SPARSE_SCAN_OVERLAY_MAX_CHARS
                and all(isinstance(size, (int, float)) and not isinstance(size, bool)
                        and size <= SPARSE_SCAN_OVERLAY_MAX_FONT_SIZE for size in font_sizes)):
            return True
    return False


def direct_page_layout(page, page_index, visible_bounds=None):
    """Extract painted PDF text and remove all source text operators.

    Visible bounds let a hybrid page keep real visible text while removing an
    invisible OCR layer from its background rather than turning it into UI.
    """
    width, height = page_size(page)
    blocks = page.get_text('dict', flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES, sort=True)['blocks']
    links = page_uri_links(page)
    elements, text_parts, redaction_boxes = [], [], []
    for block in blocks:
        for line in block.get('lines', []):
            for span in line['spans']:
                text = span['text']
                if not text.strip():
                    continue
                x0, y0, x1, y1 = span['bbox']
                redaction_boxes.append(fitz.Rect(x0, y0, x1, y1))
                if visible_bounds is not None and not span_is_visible(span, visible_bounds):
                    continue
                if abs(line['dir'][1]) > .01:
                    raise HTTPException(422, 'PDF có chữ xoay. Chế độ giữ bố cục chưa hỗ trợ tài liệu này; file gốc chưa bị thay đổi.')
                if '\ufffd' in text:
                    raise HTTPException(422, 'PDF có lớp chữ lỗi mã hóa. Hãy xuất lại PDF có thể chọn chữ.')
                element = {'id': f'p{page_index}-s{len(elements)}', 'text': text,
                    'x': round(x0, 3), 'y': round(y0, 3), 'width': round(max(1, x1-x0), 3),
                    'height': round(max(1, y1-y0), 3), 'fontSize': round(span['size'], 3),
                    'fontFamily': normalized_font_family(span['font']),
                    'bold': bool(span['flags'] & 16), 'italic': bool(span['flags'] & 2),
                    'color': f"#{span['color']:06x}"}
                href = span_href(fitz.Rect(x0, y0, x1, y1), links)
                if href:
                    element['href'] = href
                elements.append(element)
                text_parts.append(text)
    if not elements:
        scan_detected(page_index + 1)
    if len(elements) > 1500:
        raise HTTPException(413, 'CV có quá nhiều khối chữ.')
    for box in redaction_boxes:
        page.add_redact_annot(box, fill=False, cross_out=False)
    page.apply_redactions(images=0, graphics=0, text=0)
    if page.get_text().strip():
        raise HTTPException(422, 'Không tách hết lớp chữ khỏi nền. Giữ nguyên file gốc, không tạo bản chỉnh sửa bị chồng chữ.')
    scale = min(LAYOUT_BACKGROUND_MAX_SCALE, math.sqrt(LAYOUT_BACKGROUND_MAX_PIXELS / (width * height)))
    image = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).tobytes('jpeg', jpg_quality=LAYOUT_BACKGROUND_JPEG_QUALITY)
    return ({'width': width, 'height': height,
             'background': 'data:image/jpeg;base64,' + base64.b64encode(image).decode('ascii'),
             'elements': elements}, text_parts)


def layout_response(filename, pages, all_text, notices):
    text = '\n'.join(all_text)
    email = re.search(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', text)
    # No fabricated career history. The positioned text is the source of truth.
    data = {'meta': {'slug': 'imported-cv', 'version': '1.0.0', 'theme': {'primaryColor': '#172c3d',
            'accentColor': '#b5efce', 'fontHeading': 'auto', 'fontBody': 'auto', 'radius': 'md'}, 'atsOptimized': False},
            'basics': {'name': all_text[0][:150], 'headline': '', 'email': email.group(0) if email else '',
            'phone': '', 'location': {'city': '', 'country': '', 'remoteStatus': 'onsite'}, 'summary': '', 'links': []},
            'work': [], 'projects': [], 'skills': [], 'education': [],
            'importedLayout': {'version': 1, 'sourceName': filename[:200], 'pages': pages, 'warnings': notices}}
    result = {'data': data, 'warnings': notices}
    if len(json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode('utf-8')) > LAYOUT_MAX_OUTPUT_BYTES:
        raise HTTPException(413, 'Bố cục chỉnh sửa vượt giới hạn lưu an toàn. Hãy giảm số trang hoặc hình ảnh trong CV.')
    return result


def parse_layout(raw: bytes, filename: str):
    if not filename.lower().endswith('.pdf'):
        raise HTTPException(415, 'Giữ bố cục hiện hỗ trợ PDF có lớp chữ. Với DOCX, hãy xuất PDF từ Word trước; hoặc chọn riêng chế độ chuyển sang mẫu mới.')
    try:
        document = fitz.open(stream=raw, filetype='pdf')
    except Exception as exc:
        raise HTTPException(422, 'Không đọc được PDF.') from exc
    with document:
        if document.needs_pass:
            raise HTTPException(422, 'Hãy dùng PDF không có mật khẩu.')
        if not 1 <= len(document) <= 20:
            raise HTTPException(413, 'Hỗ trợ tối đa 20 trang.')
        pages, all_text, byte_count, element_count, hybrid_pages = [], [], 0, 0, []
        notices = ['Chữ được dựng lại theo tọa độ gốc. Font không có trên máy dùng font thay thế; hãy đối chiếu và kiểm tra xuống dòng trước khi xuất PDF.',
                   'Ảnh và hình trang trí được giữ thành lớp nền; hiện chỉnh sửa trực tiếp được các khối chữ.']
        for index, page in enumerate(document):
            if page.rotation:
                page.remove_rotation()
            width, height = page_size(page)
            visible_bounds = visible_text_bounds(page)
            # A dominant image alone is not proof of a scan: exported CVs often
            # have a full-page decorative background with real PDF text painted
            # over it.  Conversely, a scan can retain ordinary text operators
            # underneath the later full-page image; display-list order catches
            # that case before we expose duplicate, invisible text for editing.
            if page_has_text_below_full_page_image(page, width, height):
                scan_detected(index + 1)
            if page_has_sparse_scanner_overlay(page, width, height):
                scan_detected(index + 1)
            if not visible_bounds:
                scan_detected(index + 1)
            if page_has_full_page_image(page, width, height):
                hybrid_pages.append(index + 1)
            page_data, text_parts = direct_page_layout(page, index, visible_bounds)
            all_text.extend(text_parts)
            element_count += len(page_data['elements'])
            if element_count > LAYOUT_MAX_TOTAL_ELEMENTS:
                raise HTTPException(413, 'CV có quá nhiều khối chữ để lưu an toàn.')
            if sum(map(len, all_text)) > 50_000:
                raise HTTPException(413, 'CV có quá nhiều khối chữ.')
            byte_count += len(page_data['background'])
            if byte_count > 8_000_000:
                raise HTTPException(413, 'Lớp hình ảnh quá lớn. Hãy giảm số trang hoặc kích thước ảnh trong CV.')
            pages.append(page_data)
        if hybrid_pages:
            notices.append('Trang có ảnh nền lớn nhưng lớp chữ PDF hiển thị đã được giữ nguyên. Hãy kiểm tra nền không chứa chữ raster trùng lặp trước khi xuất.')
        return layout_response(filename, pages, all_text, notices)


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def ocr_order_key(value):
    if not isinstance(value, dict) or not isinstance(value.get('polygon'), list) or not value['polygon']:
        return (math.inf, math.inf)
    points = [point for point in value['polygon'] if isinstance(point, list) and len(point) == 2 and all(finite_number(item) for item in point)]
    if not points:
        return (math.inf, math.inf)
    return min(point[1] for point in points), min(point[0] for point in points)


def ocr_elements(page_index, items, pixel_width, pixel_height, page_width, page_height):
    if not isinstance(items, list) or not 1 <= len(items) <= 1500:
        ocr_error(422, 'ocr_geometry_invalid', 'OCR không trả về đủ khối chữ hợp lệ để giữ bố cục.')
    scale_x, scale_y = pixel_width / page_width, pixel_height / page_height
    if not all(math.isfinite(value) and value > 0 for value in (scale_x, scale_y)):
        ocr_error(422, 'ocr_geometry_invalid', 'Tỷ lệ trang OCR không hợp lệ.')
    elements, occupied = [], []
    for item in sorted(items, key=ocr_order_key):
        if not isinstance(item, dict):
            ocr_error(422, 'ocr_geometry_invalid', 'OCR trả về khối chữ không hợp lệ.')
        text, polygon = item.get('text'), item.get('polygon')
        confidence, rotation = item.get('confidence'), item.get('rotation')
        if not isinstance(text, str) or not text.strip() or len(text) > 1000 or not isinstance(polygon, list) or len(polygon) != 4:
            ocr_error(422, 'ocr_geometry_invalid', 'OCR trả về khối chữ không hợp lệ.')
        if not finite_number(confidence) or confidence < OCR_MIN_CONFIDENCE or confidence > 1:
            ocr_error(422, 'ocr_confidence_too_low', 'Có chữ OCR chưa đủ tin cậy để xóa chữ gốc an toàn. Hãy dùng bản scan rõ hơn hoặc mẫu Studio mới.')
        if not finite_number(rotation) or abs(rotation) > OCR_MAX_ROTATION:
            ocr_error(422, 'ocr_rotated_text_unsupported', 'Ảnh scan có chữ xoay hoặc lệch quá mức hỗ trợ. File gốc chưa bị thay đổi.')
        points = []
        for point in polygon:
            if not isinstance(point, list) or len(point) != 2 or not all(finite_number(value) for value in point):
                ocr_error(422, 'ocr_geometry_invalid', 'OCR trả về tọa độ chữ không hợp lệ.')
            x, y = point
            if not -1 <= x <= pixel_width + 1 or not -1 <= y <= pixel_height + 1:
                ocr_error(422, 'ocr_geometry_invalid', 'OCR trả về tọa độ ngoài trang.')
            points.append((min(pixel_width, max(0, x)), min(pixel_height, max(0, y))))
        left, top = min(point[0] for point in points), min(point[1] for point in points)
        right, bottom = max(point[0] for point in points), max(point[1] for point in points)
        if right - left < 3 or bottom - top < 3:
            ocr_error(422, 'ocr_geometry_invalid', 'OCR trả về khối chữ quá nhỏ để chỉnh sửa an toàn.')
        area = (right - left) * (bottom - top)
        for current in occupied:
            overlap = max(0, min(right, current[2]) - max(left, current[0])) * max(0, min(bottom, current[3]) - max(top, current[1]))
            if overlap / min(area, current[4]) > .55:
                ocr_error(422, 'ocr_overlapping_text', 'OCR phát hiện các khối chữ chồng nhau. File gốc chưa bị thay đổi.')
        occupied.append((left, top, right, bottom, area))
        x, y = left / scale_x, top / scale_y
        width, height = (right - left) / scale_x, (bottom - top) / scale_y
        elements.append({'id': f'p{page_index}-o{len(elements)}', 'text': text.strip(),
                         'x': round(x, 3), 'y': round(y, 3), 'width': round(max(1, width), 3),
                         'height': round(max(1, height), 3), 'fontSize': round(min(96, max(6, height * .72)), 3),
                         'fontFamily': 'Arial', 'bold': False, 'italic': False, 'color': '#111827'})
    return elements


def parse_ocr_layout(raw: bytes, filename: str):
    if not filename.lower().endswith('.pdf'):
        ocr_error(415, 'ocr_pdf_required', 'OCR giữ bố cục hiện chỉ hỗ trợ PDF scan hoặc PDF ảnh.')
    require_ocr_capability()
    try:
        document = fitz.open(stream=raw, filetype='pdf')
    except Exception as exc:
        raise HTTPException(422, 'Không đọc được PDF.') from exc
    with document:
        if document.needs_pass:
            raise HTTPException(422, 'Hãy dùng PDF không có mật khẩu.')
        if not 1 <= len(document) <= 20:
            raise HTTPException(413, 'Hỗ trợ tối đa 20 trang.')
        pages, all_text, byte_count, scan_pages, element_count = [], [], 0, 0, 0
        deadline = time.monotonic() + OCR_DOCUMENT_TIMEOUT_SECONDS
        for index, page in enumerate(document):
            if time.monotonic() >= deadline:
                ocr_error(504, 'ocr_document_timeout', 'OCR cục bộ đã hết thời gian xử lý an toàn. File gốc chưa bị thay đổi.')
            if page.rotation:
                page.remove_rotation()
            width, height = page_size(page)
            visible_bounds = visible_text_bounds(page)
            text_is_below_image = page_has_text_below_full_page_image(page, width, height)
            sparse_scanner_overlay = page_has_sparse_scanner_overlay(page, width, height)
            if visible_bounds and not text_is_below_image and not sparse_scanner_overlay:
                # Keep native PDF positions/fonts whenever text is actually
                # painted, including pages with a full-page decorative image.
                # OCR is only for pages without visible native text, or for a
                # scan that merely carries text operators beneath its image or
                # a small scanner-app watermark above the raster page.
                page_data, text_parts = direct_page_layout(page, index, visible_bounds)
                all_text.extend(text_parts)
                element_count += len(page_data['elements'])
                if element_count > LAYOUT_MAX_TOTAL_ELEMENTS:
                    raise HTTPException(413, 'CV có quá nhiều khối chữ để lưu an toàn.')
                byte_count += len(page_data['background'])
                if sum(map(len, all_text)) > 50_000:
                    raise HTTPException(413, 'CV có quá nhiều khối chữ.')
                if byte_count > 8_000_000:
                    raise HTTPException(413, 'Lớp hình ảnh quá lớn. Hãy giảm số trang hoặc kích thước ảnh trong CV.')
                pages.append(page_data)
                continue
            scan_pages += 1
            if scan_pages > OCR_MAX_SCAN_PAGES:
                ocr_error(413, 'ocr_scan_page_limit', 'OCR giữ bố cục hỗ trợ tối đa ba trang scan trong một lần nhập. File gốc chưa bị thay đổi.')
            area = width * height
            scale = min(2, math.sqrt(2_000_000 / area))
            pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            image = pixmap.tobytes('jpeg', jpg_quality=92)
            pixel_width, pixel_height = pixmap.width, pixmap.height
            del pixmap
            remaining = deadline - time.monotonic()
            if remaining <= 1:
                ocr_error(504, 'ocr_document_timeout', 'OCR cục bộ đã hết thời gian xử lý an toàn. File gốc chưa bị thay đổi.')
            result = run_ocr_sidecar(image, timeout_seconds=remaining)
            if result.get('width') != pixel_width or result.get('height') != pixel_height:
                ocr_error(422, 'ocr_geometry_invalid', 'OCR trả về kích thước trang không khớp với PDF.')
            coverage, residual = result.get('maskCoverage'), result.get('residualCount')
            if not finite_number(coverage) or not 0 < coverage <= OCR_MAX_MASK_COVERAGE:
                ocr_error(422, 'ocr_mask_invalid', 'Vùng che chữ OCR không an toàn để giữ bố cục.')
            if not isinstance(residual, int) or isinstance(residual, bool) or residual != 0:
                ocr_error(422, 'ocr_background_not_clean', 'Không xóa được toàn bộ chữ gốc khỏi nền scan một cách an toàn. File gốc chưa bị thay đổi.')
            background = result.get('background')
            if not isinstance(background, str) or not re.fullmatch(r'[A-Za-z0-9+/=]+', background):
                ocr_error(422, 'ocr_background_invalid', 'OCR không trả về lớp nền an toàn.')
            elements = ocr_elements(index, result.get('items'), pixel_width, pixel_height, width, height)
            all_text.extend(element['text'] for element in elements)
            element_count += len(elements)
            if element_count > LAYOUT_MAX_TOTAL_ELEMENTS:
                raise HTTPException(413, 'CV có quá nhiều khối chữ để lưu an toàn.')
            if sum(map(len, all_text)) > 50_000:
                raise HTTPException(413, 'CV có quá nhiều khối chữ.')
            image_data = 'data:image/jpeg;base64,' + background
            byte_count += len(image_data)
            if byte_count > 8_000_000:
                raise HTTPException(413, 'Lớp hình ảnh quá lớn. Hãy giảm số trang hoặc kích thước ảnh trong CV.')
            pages.append({'width': width, 'height': height, 'background': image_data, 'elements': elements})
        notices = ['Các trang PDF có lớp chữ được dựng lại theo tọa độ gốc; font thiếu trên máy có thể được thay thế.']
        if scan_pages:
            notices.extend(['OCR chạy hoàn toàn trên máy cục bộ; không gửi CV sang dịch vụ AI bên ngoài.',
                            'OCR cố gắng che chữ raster trước khi dựng lại thành khối sửa được, nhưng chữ mờ hoặc nhỏ có thể còn sót trong nền. Hãy đối chiếu từng trang scan với file gốc trước khi lưu hoặc công khai.',
                            'Font, màu và độ đậm của bản scan là ước lượng; chữ quá dài, scan mờ hoặc bố cục phức tạp có thể cần chỉnh tay.'])
        result = layout_response(filename, pages, all_text, notices)
        if scan_pages:
            # A second pass by the same OCR engine is useful as a rejection signal,
            # not proof that every raster glyph disappeared.  Require an explicit
            # owner acknowledgement before this document can be saved or published.
            result['data']['importedLayout']['ocrReviewRequired'] = True
            result['data']['importedLayout']['ocrReviewConfirmed'] = False
        return result
