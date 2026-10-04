import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { ImportedLayout } from './schema';
import './imported-fonts.css';
import './imported-document.css';

type ImportedElement = ImportedLayout['pages'][number]['elements'][number];
type LayoutSelection = { pageIndex: number; id: string };
type LayoutPatch = LayoutSelection & { patch: Partial<ImportedElement>; historyKey?: string; action?: 'add' | 'delete' };
type DragState = LayoutSelection & {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  pageWidth: number;
  pageHeight: number;
  elementWidth: number;
  elementHeight: number;
  historyKey: string;
  lastX: number;
  lastY: number;
};
type Props = {
  layout: ImportedLayout;
  onChange?: (change: LayoutPatch) => void;
  onChooseNameElement?: (selection: { pageIndex: number; id: string }) => void;
  onLayoutOverflowChange?: (overflowing: boolean) => void;
  disabled?: boolean;
};
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const pdfFontStack = (value: string) => {
  const family = value.replace(/["\\]/g, '').trim() || 'sans-serif';
  const normalized = family.replace(/[\s,_-]+/g, '').toLowerCase();
  if (normalized.startsWith('calibri')) return '"Calibri", "Aris Carlito", "Carlito", Arial, sans-serif';
  if (normalized.startsWith('cambria')) return '"Cambria", "Aris Caladea", "Caladea", "Times New Roman", serif';
  if (normalized.startsWith('timesnewroman')) return '"Times New Roman", "Aris Tinos", "Tinos", "Liberation Serif", serif';
  if (normalized.startsWith('courier')) return '"Courier New", "Aris Cousine", "Cousine", monospace';
  if (normalized.startsWith('arial') || normalized.startsWith('helvetica')) return '"' + family + '", Arial, "Aris Arimo", "Arimo", Helvetica, sans-serif';
  return '"' + family + '", ' + (/times|serif|georgia/i.test(family) ? 'serif' : 'Arial, sans-serif');
};
export function ImportedDocument({ layout, onChange, onChooseNameElement, onLayoutOverflowChange, disabled = false }: Props) {
  const [selected, setSelected] = useState<{ page: number; id: string } | null>(null);
  const [insertPage, setInsertPage] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const dragSequence = useRef(0);
  const insertSequence = useRef(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const element = selected ? layout.pages[selected.page]?.elements.find(e => e.id === selected.id) : null;
  useLayoutEffect(() => {
    let cancelled = false;
    const fitSourceText = () => {
      if (cancelled) return;
      const nodes = root.current ? Array.from(root.current.querySelectorAll<HTMLElement>('.imported-text')) : [];
      let overflowingEditedText = false;
      for (const node of nodes) {
        const edited = node.dataset.textEdited === 'true';
        const width = node.clientWidth;
        const intrinsicWidth = node.scrollWidth;
        // PDF.js applies a horizontal transform when browser font metrics do
        // not exactly match a source-PDF run. Preserve the fixed PDF box
        // without mutating source text merely because a device lacks Office.
        const scaleX = !edited && width > 0 && intrinsicWidth > width + 1
          ? Math.max(0.01, width / intrinsicWidth) : 1;
        node.style.setProperty('--import-text-scale-x', String(scaleX));
        if (edited && (intrinsicWidth > width + 1 || node.scrollHeight > node.clientHeight + 1)) overflowingEditedText = true;
      }
      setHasOverflow(previous => previous === overflowingEditedText ? previous : overflowingEditedText);
      onLayoutOverflowChange?.(overflowingEditedText);
    };
    fitSourceText();
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    const afterFonts = () => fitSourceText();
    void fonts?.ready.then(afterFonts);
    fonts?.addEventListener?.('loadingdone', afterFonts);
    window.addEventListener('resize', fitSourceText);
    return () => {
      cancelled = true;
      fonts?.removeEventListener?.('loadingdone', afterFonts);
      window.removeEventListener('resize', fitSourceText);
    };
  }, [layout, onLayoutOverflowChange]);
  const edit = (patch: Partial<ImportedElement>, historyKey?: string) => {
    if (!selected || !onChange || disabled) return;
    onChange({ pageIndex: selected.page, id: selected.id, patch, historyKey });
  };
  const select = (selection: { page: number; id: string }) => {
    setSelected(selection);
    setInsertPage(selection.page);
  };
  const addTextBlock = () => {
    if (!onChange || disabled || !layout.pages.length) return;
    const pageIndex = clamp(insertPage, 0, layout.pages.length - 1);
    const random = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().replaceAll('-', '')
      : `${Date.now().toString(36)}${++insertSequence.current}`;
    const id = `added-${random}`.slice(0, 80);
    onChange({ pageIndex, id, patch: {}, action: 'add' });
    select({ page: pageIndex, id });
  };
  const deleteSelectedTextBlock = () => {
    if (!selected || !onChange || disabled) return;
    const selection = selected;
    setSelected(null);
    onChange({ pageIndex: selection.page, id: selection.id, patch: {}, action: 'delete' });
  };
  const nudge = (event: ReactKeyboardEvent<HTMLElement>, pageIndex: number, source: ImportedElement) => {
    if (!onChange || disabled || selected?.page !== pageIndex || selected.id !== source.id) return false;
    const movement = event.shiftKey ? 10 : 1;
    const direction = event.key === 'ArrowLeft' ? [-movement, 0] : event.key === 'ArrowRight' ? [movement, 0] : event.key === 'ArrowUp' ? [0, -movement] : event.key === 'ArrowDown' ? [0, movement] : null;
    if (!direction) return false;
    const page = layout.pages[pageIndex];
    if (!page) return false;
    event.preventDefault();
    onChange({
      pageIndex,
      id: source.id,
      patch: {
        x: clamp(source.x + direction[0], 0, Math.max(0, page.width - source.width)),
        y: clamp(source.y + direction[1], 0, Math.max(0, page.height - source.height)),
      },
      historyKey: `nudge:${source.id}`,
    });
    return true;
  };
  const startDrag = (event: ReactPointerEvent<HTMLElement>, pageIndex: number, source: ImportedElement) => {
    if (!onChange || disabled || selected?.page !== pageIndex || selected.id !== source.id || event.button !== 0) return;
    const page = event.currentTarget.closest<HTMLElement>('.imported-page');
    if (!page) return;
    const rect = page.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pageIndex,
      id: source.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: source.x,
      startY: source.y,
      pageWidth: layout.pages[pageIndex].width,
      pageHeight: layout.pages[pageIndex].height,
      elementWidth: source.width,
      elementHeight: source.height,
      historyKey: `drag:${source.id}:${++dragSequence.current}`,
      lastX: source.x,
      lastY: source.y,
    };
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId || !onChange || disabled) return;
    const page = event.currentTarget.closest<HTMLElement>('.imported-page');
    if (!page) return;
    const rect = page.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nextX = clamp(active.startX + ((event.clientX - active.startClientX) / rect.width) * active.pageWidth, 0, Math.max(0, active.pageWidth - active.elementWidth));
    const nextY = clamp(active.startY + ((event.clientY - active.startClientY) / rect.height) * active.pageHeight, 0, Math.max(0, active.pageHeight - active.elementHeight));
    if (Math.abs(nextX - active.lastX) < 0.1 && Math.abs(nextY - active.lastY) < 0.1) return;
    active.lastX = nextX;
    active.lastY = nextY;
    event.preventDefault();
    onChange({ pageIndex: active.pageIndex, id: active.id, patch: { x: nextX, y: nextY }, historyKey: active.historyKey });
  };
  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
  };
  return <div className="imported-document" ref={root}>
    <style>{`@media print { html, body { margin: 0 !important; padding: 0 !important; } }\n${layout.pages.map((page, index) => `@page imported${index} { size: ${page.width}pt ${page.height}pt; margin: 0; } .imported-page-${index} { page: imported${index}; }`).join('\n')}`}</style>
    {onChange && <div className="imported-tools interactive-only">
      <p>Chọn một khối chữ trên CV để sửa. Giữ nguyên hình nền và bố cục trang.</p>
      <div className="imported-add-controls">
        <label>Thêm vào trang<select aria-label="Trang thêm khối chữ" disabled={disabled} value={clamp(insertPage, 0, Math.max(0, layout.pages.length - 1))} onChange={event => setInsertPage(Number(event.target.value))}>{layout.pages.map((_, pageIndex) => <option key={pageIndex} value={pageIndex}>Trang {pageIndex + 1}</option>)}</select></label>
        <button type="button" aria-label="Thêm khối chữ" disabled={disabled || !layout.pages.length} onClick={addTextBlock}>+ Thêm khối chữ</button>
      </div>
      {element && <fieldset disabled={disabled} aria-label="Chỉnh khối chữ">
        <label>Nội dung<textarea aria-label="Nội dung khối chữ" value={element.text} onChange={e => edit({ text: e.target.value, textEdited: true }, 'text')}/></label>
        {onChooseNameElement && <button type="button" className="imported-name-choice" aria-pressed={layout.nameElementId === element.id} onClick={() => onChooseNameElement({ pageIndex: selected!.page, id: element.id })}>
          {layout.nameElementId === element.id ? 'Đang dùng làm họ và tên CV' : 'Dùng khối này làm họ và tên CV'}
        </button>}
        <button type="button" className="imported-delete" aria-label="Xóa khối chữ đã chọn" onClick={deleteSelectedTextBlock}>Xóa khối chữ</button>
        <div className="imported-fields">
          {(['x', 'y', 'width', 'height', 'fontSize'] as const).map((key, i) => <label key={key}>{['Trái', 'Trên', 'Rộng', 'Cao', 'Cỡ chữ'][i]}<input aria-label={['Trái', 'Trên', 'Rộng', 'Cao', 'Cỡ chữ'][i]} type="number" step="0.5" min={key === 'x' || key === 'y' ? -2000 : 1} max={key === 'fontSize' ? 500 : 4000} value={element[key]} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && e.target.validity.valid) edit({ [key]: n }, `field:${key}`); }}/></label>)}
          <label>Màu<input type="color" aria-label="Màu chữ" value={element.color} onChange={e => edit({ color: e.target.value }, 'color')}/></label>
          <label><input type="checkbox" checked={element.bold} onChange={e => edit({ bold: e.target.checked }, 'style')}/>Đậm</label>
          <label><input type="checkbox" checked={element.italic} onChange={e => edit({ italic: e.target.checked }, 'style')}/>Nghiêng</label>
        </div>
        <small>Kéo khối đã chọn để đặt lại vị trí; dùng phím mũi tên để dịch 1 pt, Shift + mũi tên để dịch 10 pt. Chữ dài phải nằm gọn trong khối trước khi lưu.</small>
      </fieldset>}
    </div>}
    {hasOverflow && onChange && <p className="imported-overflow" role="alert">Có chữ vượt khối gốc. CV chưa thể lưu hoặc xuất để tránh đè lên nội dung bên dưới; hãy chỉnh rộng/cao/cỡ chữ của khối đó.</p>}
    {layout.pages.map((page, index) => <section className={`imported-page imported-page-${index}`} key={index} aria-label={`Trang ${index+1}`} style={{ width: `${page.width}pt`, height: `${page.height}pt`, '--import-width': `${page.width}pt`, '--import-height': `${page.height}pt` } as CSSProperties}>
      <img className="imported-background" src={page.background} alt="" draggable={false}/>
      {page.elements.map(e => <a key={e.id} className={`imported-text ${selected?.page === index && selected.id === e.id ? 'selected' : ''}`}
        href={e.href} target={e.href && !onChange ? '_blank' : undefined} rel={e.href && !onChange ? 'noreferrer' : undefined}
        role={onChange ? 'button' : undefined} tabIndex={onChange && !disabled ? 0 : undefined}
        aria-label={onChange ? `Sửa: ${e.text.slice(0, 60)}. Nhấn Enter để chọn; khi đã chọn dùng phím mũi tên để di chuyển.` : undefined}
        data-layout-id={e.id} data-page-index={index}
        onFocus={() => { if (onChange && !disabled) select({ page: index, id: e.id }); }}
        onPointerDown={event => startDrag(event, index, e)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
        onClick={event => { if (onChange && !disabled) { event.preventDefault(); select({ page: index, id: e.id }); } }}
        onKeyDown={event => { if (nudge(event, index, e)) return; if (onChange && !disabled && ['Enter', ' '].includes(event.key)) { event.preventDefault(); select({ page: index, id: e.id }); } }}
        data-text-edited={e.textEdited ? 'true' : undefined}
        style={{ left: e.x + 'pt', top: e.y + 'pt', width: e.width + 'pt', height: e.height + 'pt', fontSize: e.fontSize + 'pt', fontFamily: pdfFontStack(e.fontFamily), color: e.color, fontWeight: e.bold ? 700 : 400, fontStyle: e.italic ? 'italic' : 'normal' }}>
        {e.text}
      </a>)}
    </section>)}
  </div>;
}
