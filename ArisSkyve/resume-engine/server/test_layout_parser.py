import base64
import json
import tempfile
import unittest
from io import BytesIO, TextIOWrapper
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pymupdf as fitz
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageDraw

import app
import layout_parser
import ocr_sidecar
from layout_parser import parse_layout, parse_ocr_layout


def fixture(two_columns=False, pages=1, photo=False):
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page(width=595, height=842)
        page.draw_rect(fitz.Rect(0, 0, 180, 842), color=None, fill=(.88, .93, .96))
        page.insert_text((35, 55), 'Alex Example', fontsize=20)
        page.insert_text((35, 90), 'alex@example.com', fontsize=10)
        page.insert_text((220 if two_columns else 35, 160), 'Python SQL experience', fontsize=12)
        page.insert_text((220 if two_columns else 35, 190), f'Built API page {i+1}', fontsize=11)
        if photo:
            image = BytesIO(); Image.new('RGB', (80, 80), '#6655aa').save(image, format='PNG')
            page.insert_image(fitz.Rect(35, 220, 95, 280), stream=image.getvalue())
    raw = doc.tobytes(); doc.close(); return raw


def scan_fixture():
    image = Image.new('RGB', (600, 840), 'white')
    ImageDraw.Draw(image).text((60, 80), 'Dang Anh', fill='black')
    encoded = BytesIO(); image.save(encoded, format='PNG')
    doc = fitz.open(); page = doc.new_page(width=595, height=842)
    page.insert_image(page.rect, stream=encoded.getvalue())
    raw = doc.tobytes(); doc.close(); return raw


def hybrid_fixture(include_hidden_ocr=False):
    image = BytesIO()
    Image.new('RGB', (600, 840), '#f1f5f9').save(image, format='PNG')
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_image(page.rect, stream=image.getvalue())
    page.insert_text((55, 75), 'Native visible name', fontsize=20)
    page.insert_text((55, 110), 'native@example.com', fontsize=11)
    if include_hidden_ocr:
        page.insert_text((55, 160), 'Hidden OCR layer', fontsize=11, render_mode=3)
    raw = doc.tobytes(); doc.close(); return raw


def text_below_full_page_image_fixture():
    """Scanner-style PDF: selectable text is painted before the page image."""
    image = BytesIO()
    Image.new('RGB', (600, 840), '#f1f5f9').save(image, format='PNG')
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((55, 75), 'Text hidden by scan image', fontsize=20)
    page.insert_text((55, 110), 'hidden@example.com', fontsize=11)
    page.insert_image(page.rect, stream=image.getvalue())
    raw = doc.tobytes(); doc.close(); return raw


def scanner_overlay_fixture(overlay, fontsize=8):
    """Scan image with a small selectable watermark painted on top."""
    image = BytesIO()
    Image.new('RGB', (1800, 2520), '#f1f5f9').save(image, format='PNG')
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_image(page.rect, stream=image.getvalue())
    page.insert_text((390, 820), overlay, fontsize=fontsize)
    raw = doc.tobytes(); doc.close(); return raw


def sparse_legitimate_hybrid_fixture(name='Linh'):
    """A real image-background PDF can legitimately have only short text."""
    image = BytesIO()
    Image.new('RGB', (600, 840), '#f1f5f9').save(image, format='PNG')
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_image(page.rect, stream=image.getvalue())
    page.insert_text((55, 75), name, fontsize=20)
    page.insert_text((55, 110), 'linh@example.com', fontsize=11)
    raw = doc.tobytes(); doc.close(); return raw


def linked_fixture():
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((55, 75), 'alex@example.com', fontsize=12)
    page.insert_text((55, 105), 'linkedin.com/in/alex', fontsize=12)
    page.insert_link({'kind': fitz.LINK_URI, 'from': fitz.Rect(55, 60, 160, 80), 'uri': 'mailto:alex@example.com'})
    page.insert_link({'kind': fitz.LINK_URI, 'from': fitz.Rect(55, 90, 180, 110), 'uri': 'https://linkedin.com/in/alex'})
    raw = doc.tobytes(); doc.close(); return raw


def adjacent_link_fixture():
    """An email annotation with padding must not capture the title beside it."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((55, 75), 'alex@example.com', fontsize=12)
    page.insert_text((165, 75), 'Product manager', fontsize=12)
    # The annotation has enough padding to overlap the adjacent title, but it
    # still contains nearly all of the email text.
    page.insert_link({'kind': fitz.LINK_URI, 'from': fitz.Rect(55, 60, 185, 80),
                      'uri': 'mailto:alex@example.com'})
    raw = doc.tobytes(); doc.close(); return raw


def mocked_ocr_result(image, timeout_seconds=None):
    with Image.open(BytesIO(image)) as rendered:
        pixel_width, pixel_height = rendered.size
    background = BytesIO()
    Image.new('RGB', (8, 8), 'white').save(background, format='JPEG')
    left, top = int(pixel_width * .08), int(pixel_height * .08)
    right, bottom = int(pixel_width * .52), int(pixel_height * .12)
    return {'width': pixel_width, 'height': pixel_height,
            'items': [{'polygon': [[left, top], [right, top], [right, bottom], [left, bottom]],
                       'text': 'Đặng Ánh', 'confidence': .99, 'rotation': 0}],
            'background': base64.b64encode(background.getvalue()).decode('ascii'),
            'maskCoverage': .02, 'residualCount': 0}


class LayoutTests(unittest.TestCase):
    def test_pdf_font_face_names_are_normalized_to_css_families(self):
        cases = {
            'ABCDEF+Calibri-Bold': 'Calibri',
            'Calibri-Bold': 'Calibri',
            'Arial-BoldMT': 'Arial',
            'TimesNewRomanPS-BoldMT': 'Times New Roman',
        }
        for source, expected in cases.items():
            with self.subTest(source=source):
                self.assertEqual(layout_parser.normalized_font_family(source), expected)

    def test_ocr_capability_requires_the_isolated_runtime_dependencies(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            executable, models = root / 'ocr-python.exe', root / 'models'
            executable.touch(); models.mkdir(); (models / 'detector-model.bin').write_bytes(b'fixture')
            environment = {'RESUME_OCR_PYTHON': str(executable), 'RESUME_OCR_MODEL_DIR': str(models)}
            with patch.dict(layout_parser.os.environ, environment, clear=False), \
                    patch.object(layout_parser.subprocess, 'run', return_value=SimpleNamespace(returncode=0)) as probe:
                self.assertEqual(layout_parser.ocr_capability(), {'layoutOcr': True, 'layoutOcrReason': None})
            self.assertIn('-I', probe.call_args.args[0])
            with patch.dict(layout_parser.os.environ, environment, clear=False), \
                    patch.object(layout_parser.subprocess, 'run', return_value=SimpleNamespace(returncode=1)):
                self.assertEqual(layout_parser.ocr_capability()['layoutOcrReason'], 'ocr_runtime_dependencies_missing')

    def test_ocr_sidecar_emits_ascii_json_for_vietnamese_text(self):
        raw_output = BytesIO()
        output = TextIOWrapper(raw_output, encoding='cp1252', errors='strict')
        with patch.object(ocr_sidecar.sys, 'stdout', output):
            self.assertEqual(ocr_sidecar.emit({'text': 'Đặng Nguyễn'}), 0)
            output.flush()
        self.assertTrue(raw_output.getvalue().isascii())
        self.assertEqual(json.loads(raw_output.getvalue().decode('utf-8'))['text'], 'Đặng Nguyễn')

    def test_ocr_capability_gate_runs_before_pdf_parse(self):
        unavailable = {'layoutOcr': False, 'layoutOcrReason': 'ocr_python_not_configured'}
        with patch.object(layout_parser, 'ocr_capability', return_value=unavailable), \
                patch.object(layout_parser.fitz, 'open') as open_document:
            with self.assertRaises(HTTPException) as error:
                parse_ocr_layout(b'not a PDF', 'Scan.pdf')
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(error.exception.detail['code'], 'ocr_unavailable')
        open_document.assert_not_called()

    def test_ocr_scan_builds_editable_layout_from_local_mock(self):
        available = {'layoutOcr': True, 'layoutOcrReason': None}
        with patch.object(layout_parser, 'ocr_capability', return_value=available), \
                patch.object(layout_parser, 'run_ocr_sidecar', side_effect=mocked_ocr_result) as sidecar:
            result = parse_ocr_layout(scan_fixture(), 'Scan.pdf')
        app.canonical_validator.cache_clear()
        app.validate_canonical(result['data'])
        page = result['data']['importedLayout']['pages'][0]
        self.assertEqual(result['data']['basics']['name'], 'Đặng Ánh')
        self.assertEqual(page['elements'][0]['text'], 'Đặng Ánh')
        self.assertTrue(page['background'].startswith('data:image/jpeg;base64,'))
        self.assertTrue(result['data']['importedLayout']['ocrReviewRequired'])
        self.assertFalse(result['data']['importedLayout']['ocrReviewConfirmed'])
        self.assertIn('OCR chạy hoàn toàn trên máy cục bộ; không gửi CV sang dịch vụ AI bên ngoài.', result['warnings'])
        sidecar.assert_called_once()

    def test_ocr_scan_rejects_unsafe_mock_results(self):
        available = {'layoutOcr': True, 'layoutOcrReason': None}
        cases = (
            ('ocr_mask_invalid', lambda result: result.update(maskCoverage=.36)),
            ('ocr_background_not_clean', lambda result: result.update(residualCount=1)),
            ('ocr_confidence_too_low', lambda result: result['items'][0].update(confidence=.69)),
        )
        for code, mutate in cases:
            with self.subTest(code=code):
                def unsafe_result(image, timeout_seconds=None, mutate=mutate):
                    result = mocked_ocr_result(image)
                    mutate(result)
                    return result

                with patch.object(layout_parser, 'ocr_capability', return_value=available), \
                        patch.object(layout_parser, 'run_ocr_sidecar', side_effect=unsafe_result):
                    with self.assertRaises(HTTPException) as error:
                        parse_ocr_layout(scan_fixture(), 'Scan.pdf')
                self.assertEqual(error.exception.status_code, 422)
                self.assertEqual(error.exception.detail['code'], code)

    def test_single_column_real_text_and_contract(self):
        result = parse_layout(fixture(), 'CV.pdf')
        app.canonical_validator.cache_clear()
        app.validate_canonical(result['data'])
        self.assertEqual(result['data']['basics']['name'], 'Alex Example')
        elements = result['data']['importedLayout']['pages'][0]['elements']
        self.assertEqual(elements[0]['text'], 'Alex Example')
        self.assertAlmostEqual(elements[0]['x'], 35)
        self.assertEqual(elements[0]['fontSize'], 20)

    def test_full_page_background_with_visible_native_text_keeps_layout(self):
        result = parse_layout(hybrid_fixture(), 'Hybrid.pdf')
        page = result['data']['importedLayout']['pages'][0]
        self.assertEqual([element['text'] for element in page['elements']], ['Native visible name', 'native@example.com'])
        self.assertIn('ảnh nền lớn', ' '.join(result['warnings']))

    def test_text_painted_below_full_page_image_is_rejected_as_scan(self):
        with self.assertRaises(HTTPException) as error:
            parse_layout(text_below_full_page_image_fixture(), 'Scanned.pdf')
        self.assertEqual(error.exception.status_code, 422)
        self.assertEqual(error.exception.detail['code'], 'layout_scan_detected')

    def test_scanner_app_stamp_above_full_page_image_is_rejected_as_scan(self):
        for stamp in ('Scanned with CamScanner', 'ABBYY FineReader'):
            with self.subTest(stamp=stamp):
                with self.assertRaises(HTTPException) as error:
                    parse_layout(scanner_overlay_fixture(stamp), 'Scanned.pdf')
                self.assertEqual(error.exception.status_code, 422)
                self.assertEqual(error.exception.detail['code'], 'layout_scan_detected')

    def test_tiny_exposed_edge_text_above_full_page_image_is_rejected_as_scan(self):
        with self.assertRaises(HTTPException) as error:
            parse_layout(scanner_overlay_fixture('Scan copy'), 'Scanned.pdf')
        self.assertEqual(error.exception.status_code, 422)
        self.assertEqual(error.exception.detail['code'], 'layout_scan_detected')

    def test_sparse_real_text_above_decorative_background_is_not_rejected_as_scan(self):
        result = parse_layout(sparse_legitimate_hybrid_fixture(), 'Hybrid.pdf')
        self.assertEqual([element['text'] for element in result['data']['importedLayout']['pages'][0]['elements']],
                         ['Linh', 'linh@example.com'])

    def test_real_heading_with_scanner_brand_words_is_not_a_stamp(self):
        result = parse_layout(sparse_legitimate_hybrid_fixture('Adobe Scan Consultant'), 'Hybrid.pdf')
        self.assertEqual(result['data']['importedLayout']['pages'][0]['elements'][0]['text'], 'Adobe Scan Consultant')

    def test_ocr_mode_treats_text_below_full_page_image_as_scan(self):
        available = {'layoutOcr': True, 'layoutOcrReason': None}
        with patch.object(layout_parser, 'ocr_capability', return_value=available), \
                patch.object(layout_parser, 'run_ocr_sidecar', side_effect=mocked_ocr_result) as sidecar:
            result = parse_ocr_layout(text_below_full_page_image_fixture(), 'Scanned.pdf')
        self.assertTrue(result['data']['importedLayout']['ocrReviewRequired'])
        self.assertEqual(result['data']['importedLayout']['pages'][0]['elements'][0]['text'], 'Đặng Ánh')
        sidecar.assert_called_once()

    def test_ocr_mode_treats_scanner_app_stamp_as_scan(self):
        available = {'layoutOcr': True, 'layoutOcrReason': None}
        with patch.object(layout_parser, 'ocr_capability', return_value=available), \
                patch.object(layout_parser, 'run_ocr_sidecar', side_effect=mocked_ocr_result) as sidecar:
            result = parse_ocr_layout(scanner_overlay_fixture('Scanned with CamScanner'), 'Scanned.pdf')
        self.assertTrue(result['data']['importedLayout']['ocrReviewRequired'])
        self.assertEqual(result['data']['importedLayout']['pages'][0]['elements'][0]['text'], 'Đặng Ánh')
        sidecar.assert_called_once()

    def test_pdf_uri_annotations_become_safe_editable_links(self):
        result = parse_layout(linked_fixture(), 'Links.pdf')
        app.canonical_validator.cache_clear()
        app.validate_canonical(result['data'])
        elements = result['data']['importedLayout']['pages'][0]['elements']
        self.assertEqual([element.get('href') for element in elements],
                         ['mailto:alex@example.com', 'https://linkedin.com/in/alex'])

    def test_link_annotation_padding_does_not_capture_adjacent_text(self):
        result = parse_layout(adjacent_link_fixture(), 'Links.pdf')
        elements = result['data']['importedLayout']['pages'][0]['elements']
        self.assertEqual([element['text'] for element in elements], ['alex@example.com', 'Product manager'])
        self.assertEqual([element.get('href') for element in elements], ['mailto:alex@example.com', None])

    def test_hybrid_page_filters_hidden_ocr_and_ocr_mode_does_not_rerun_it(self):
        raw = hybrid_fixture(include_hidden_ocr=True)
        direct = parse_layout(raw, 'Hybrid.pdf')
        direct_text = [element['text'] for element in direct['data']['importedLayout']['pages'][0]['elements']]
        self.assertEqual(direct_text, ['Native visible name', 'native@example.com'])
        available = {'layoutOcr': True, 'layoutOcrReason': None}
        with patch.object(layout_parser, 'ocr_capability', return_value=available), \
                patch.object(layout_parser, 'run_ocr_sidecar', side_effect=AssertionError('native text must not be OCRed')) as sidecar:
            ocr_mode = parse_ocr_layout(raw, 'Hybrid.pdf')
        self.assertEqual([element['text'] for element in ocr_mode['data']['importedLayout']['pages'][0]['elements']], direct_text)
        self.assertNotIn('ocrReviewRequired', ocr_mode['data']['importedLayout'])
        sidecar.assert_not_called()

    def test_two_columns_keep_positions_and_multiple_pages(self):
        result = parse_layout(fixture(True, 3, True), 'Two columns.pdf')
        pages = result['data']['importedLayout']['pages']
        self.assertEqual(len(pages), 3)
        self.assertEqual([p['elements'][2]['x'] for p in pages], [220]*3)
        self.assertTrue(all(p['background'].startswith('data:image/jpeg;base64,') for p in pages))

    def test_background_contains_no_original_text_and_original_bytes_unchanged(self):
        raw = fixture(True, photo=True)
        before = raw[:]
        seen = []
        render = fitz.Page.get_pixmap
        def capture(page, *a, **kw):
            seen.append(page.get_text())
            self.assertGreater(len(page.get_images()), 0)
            self.assertGreater(len(page.get_drawings()), 0)
            return render(page, *a, **kw)
        with patch.object(fitz.Page, 'get_pixmap', capture):
            parse_layout(raw, 'CV.pdf')
        self.assertEqual(seen, [''])
        self.assertEqual(raw, before)
        with fitz.open(stream=raw, filetype='pdf') as original:
            self.assertIn('Alex Example', original[0].get_text())

    def test_layout_background_uses_high_resolution_raster_budget(self):
        page = parse_layout(fixture(), 'CV.pdf')['data']['importedLayout']['pages'][0]
        encoded = page['background'].split(',', 1)[1]
        with Image.open(BytesIO(base64.b64decode(encoded))) as rendered:
            self.assertGreaterEqual(rendered.width / page['width'], 2.4)
            self.assertGreaterEqual(rendered.height / page['height'], 2.4)

    def test_layout_route_never_calls_model(self):
        with patch.object(app, 'call_model', side_effect=AssertionError('No external model')):
            response = app.parse(UploadFile(BytesIO(fixture()), filename='CV.pdf'), mode='layout')
        self.assertIn('importedLayout', json.loads(response.body)['data'])

    def test_scan_and_hidden_ocr_are_rejected_without_template_fallback(self):
        doc = fitz.open(); page = doc.new_page()
        image = BytesIO(); Image.new('RGB', (500, 800), 'white').save(image, format='PNG')
        page.insert_image(page.rect, stream=image.getvalue())
        page.insert_text((30, 50), 'Hidden OCR', render_mode=3)
        with self.assertRaises(HTTPException) as error:
            parse_layout(doc.tobytes(), 'Scan.pdf')
        self.assertEqual(error.exception.status_code, 422)
        doc.close()

    def test_docx_does_not_silently_retemplate(self):
        with self.assertRaises(HTTPException) as error:
            parse_layout(b'file', 'CV.docx')
        self.assertEqual(error.exception.status_code, 415)

    def test_malformed_pdf_and_page_limit(self):
        with self.assertRaises(HTTPException): parse_layout(b'garbage', 'bad.pdf')
        with self.assertRaises(HTTPException) as error: parse_layout(fixture(pages=21), 'long.pdf')
        self.assertEqual(error.exception.status_code, 413)

    def test_rotated_text_rejected(self):
        doc = fitz.open(); page = doc.new_page(); page.insert_text((80, 150), 'Rotated', rotate=90)
        with self.assertRaises(HTTPException): parse_layout(doc.tobytes(), 'rotated.pdf')
        doc.close()


if __name__ == '__main__':
    unittest.main()
