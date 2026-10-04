import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EngineSwitcher } from './Engine';
import { ResumeEditor, type EditorTab } from './Editor';
import { ExternalGallery } from './ExternalGallery';
import { ColorMixer } from './ColorMixer';
import { Coach } from './Coach';
import { ImportedDocument } from './ImportedDocument';
import { validateCoachProposal, type CoachProposal } from './coach-rules';
import { FONT_CATALOG, loadFont } from './fonts';
import { templates, categories, validTemplate } from './catalog';
import { CanonicalResumeSchema, type CanonicalResume, type ImportedLayout, type TemplateId, type RenderMode } from './schema';
import { sample } from './sample';

type Snapshot = { data: CanonicalResume; templateId: TemplateId };
type History = { past: Snapshot[]; present: Snapshot; future: Snapshot[] };
type Ribbon = 'home' | 'insert' | 'design' | 'view';
type Theme = CanonicalResume['meta']['theme'];
type ImportMode = 'layout' | 'layout-ocr' | 'template';
type LayoutImportMode = Extract<ImportMode, 'layout' | 'layout-ocr'>;
type OcrRetry = { kind: 'file'; file: File } | { kind: 'new-file' } | { kind: 'legacy' };
type Replacement = {
  data: CanonicalResume;
  warnings?: string[];
  editorTab?: EditorTab | null;
  notice?: string;
  // A layout parsed during this session can own a private original that has not
  // yet been referenced by a saved CV. Only that known upload is safe to
  // discard when the user cancels the replacement.
  discardOriginalOnCancel?: boolean;
};
type ResumeApiError = Error & { code?: string; actions?: string[] };
const serialize = (value: Snapshot) => JSON.stringify(value);
const objectValue = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
const actionIds = (value: unknown) => Array.isArray(value) ? value.flatMap(action => {
  if (typeof action === 'string') return [action];
  const id = objectValue(action).id;
  return typeof id === 'string' ? [id] : [];
}) : [];
const apiError = (body: unknown, status: number): ResumeApiError => {
  const root = objectValue(body);
  const detail = objectValue(root.detail);
  const source = Object.keys(detail).length ? detail : root;
  const message = typeof source.error === 'string' ? source.error : typeof root.error === 'string' ? root.error : typeof root.detail === 'string' ? root.detail : status === 401 || status === 403 ? 'Hãy đăng nhập để lưu và nhập tài liệu.' : `Yêu cầu thất bại (${status}).`;
  const error = new Error(message) as ResumeApiError;
  if (typeof source.code === 'string') error.code = source.code;
  const actions = actionIds(source.actions);
  if (actions.length) error.actions = actions;
  return error;
};
const isOcrRetry = (error: unknown) => error instanceof Error && (error as ResumeApiError).code === 'layout_scan_detected' && ((error as ResumeApiError).actions?.some(action => action === 'layout-ocr' || action === 'use-layout-ocr') ?? false);
const needsOcrReview = (data: CanonicalResume) => data.importedLayout?.ocrReviewRequired === true && data.importedLayout.ocrReviewConfirmed !== true;
const importedEmailPattern = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;
const clampLayoutValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const synchronizeImportedBasics = (data: CanonicalResume, layout: ImportedLayout): CanonicalResume => {
  const elements = layout.pages.flatMap(page => page.elements);
  const explicitlyNamed = layout.nameElementId
    ? elements.find(element => element.id === layout.nameElementId && element.text.trim())
    : undefined;
  const name = (explicitlyNamed || elements.find(element => element.text.trim()))?.text.trim().slice(0, 150);
  const email = elements.map(element => element.text.match(importedEmailPattern)?.[0]).find(Boolean) || '';
  return {
    ...data,
    basics: { ...data.basics, ...(name ? { name } : {}), email },
    importedLayout: layout,
  };
};
const sections: { id: EditorTab; label: string; icon: string }[] = [
  { id: 'profile', label: 'Thông tin cá nhân', icon: 'Aa' }, { id: 'work', label: 'Kinh nghiệm', icon: '01' },
  { id: 'projects', label: 'Dự án', icon: '02' }, { id: 'skills', label: 'Kỹ năng', icon: '03' },
  { id: 'education', label: 'Học vấn', icon: '04' }, { id: 'custom', label: 'Mục tùy chỉnh', icon: '+' },
];
const palettes = [ ['Forest', '#123c32', '#b5efce'], ['Ocean', '#243b69', '#c6ddff'], ['Orchid', '#43318d', '#d6c9ff'], ['Rose', '#6c2d55', '#f4c8e3'], ['Terracotta', '#8b3439', '#ffd1ca'], ['Sand', '#74613c', '#fff0b7'], ['Graphite', '#252b34', '#e2e8f0'], ['Lagoon', '#27605e', '#bae6e6'] ];

function blankResume(name: string, headline: string, email: string): CanonicalResume {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-resume';
  return { meta: { slug, version: '1.0.0', theme: { primaryColor: '#123c32', accentColor: '#b5efce', fontHeading: 'auto', fontBody: 'auto', radius: 'md' }, atsOptimized: true }, basics: { name, headline, email, phone: '', location: { city: '', country: '', remoteStatus: 'onsite' }, summary: '', links: [] }, work: [], projects: [], skills: [], education: [] };
}
function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const prior = document.activeElement as HTMLElement; ref.current?.showModal(); return () => prior?.focus(); }, []);
  return <dialog ref={ref} className={`studio-dialog ${wide ? 'wide' : ''}`} onCancel={onClose} aria-label={title}><header><div><small>ARIS RESUME STUDIO</small><h2>{title}</h2></div><button onClick={onClose} aria-label="Đóng cửa sổ">×</button></header>{children}</dialog>;
}
function ProposalDialog({ proposal, onApply, onCancel }: { proposal: CoachProposal; onApply: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className="proposal-dialog" aria-label={proposal.title} onCancel={event => { event.preventDefault(); onCancel(); }}>
    <header><div><small>ĐỀ XUẤT CỦA TRỢ LÝ CV</small><h2>{proposal.title}</h2></div><button type="button" onClick={onCancel} aria-label="Đóng đề xuất">×</button></header>
    <p className="proposal-detail">{proposal.detail}</p>
    <div className="proposal-diff" aria-live="polite">
      <section><small>ĐANG CÓ</small><p>{proposal.before}</p></section>
      <section><small>BẢN XEM TRƯỚC</small><p className="proposal-after">{proposal.after}</p></section>
    </div>
    <section className="proposal-changes" aria-label="Phạm vi thay đổi">
      <small>CHỈ THAY ĐỔI CÁC TRƯỜNG NÀY</small>
      <ul>{proposal.changes.map(change => <li key={change.path}><b>{change.label}</b><code>{change.path}</code></li>)}</ul>
    </section>
    <section className="proposal-evidence" aria-label="Dữ kiện nguồn">
      <small>DỮ KIỆN ĐƯỢC DÙNG</small>
      <ul>{proposal.evidence.map((evidence, index) => <li key={`${evidence.path}:${index}`} data-source={evidence.path.startsWith('target.') ? 'target' : 'cv'}><b>{evidence.label}</b><code>{evidence.path}</code><span>{evidence.value}</span></li>)}</ul>
    </section>
    <p className="proposal-note">{proposal.verificationNote} Bản xem trước phía sau đang hiển thị thay đổi này; CV chỉ được sửa khi bạn xác nhận áp dụng.</p>
    <footer><button type="button" onClick={onCancel}>Giữ nguyên</button><button type="button" className="primary" onClick={onApply}>Áp dụng thay đổi</button></footer>
  </dialog>;
}
function FontPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="font-picker">{label}<select aria-label={label} value={value} onChange={e => { loadFont(e.target.value); onChange(e.target.value); }}><option value="auto">Theo thiết kế của mẫu</option>{['System', 'Sans serif', 'Serif', 'Display', 'Monospace'].map(group => <optgroup label={group} key={group}>{FONT_CATALOG.filter(f => f.category === group).map(f => <option key={f.family} value={f.family}>{f.family}{!f.web ? ' · máy tính' : ''}</option>)}</optgroup>)}{value !== 'auto' && !FONT_CATALOG.some(x => x.family === value) && <option value={value}>{value}</option>}</select></label>;
}
function download(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Studio() {
  const publicId = window.location.pathname.match(/^\/portfolio\/(\d+)\/?$/)?.[1];
  const isPublic = Boolean(publicId);
  const query = new URLSearchParams(window.location.search);
  const initialId = Number(publicId || query.get('resumeId'));
  const initialTemplate = query.get('template');
  const initial: Snapshot = { data: sample, templateId: validTemplate(initialTemplate) ? initialTemplate : 't3' };
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] });
  const current = history.present;
  const historyRef = useRef(history);
  const latest = useRef(current);
  const historyGroup = useRef<string | null>(null);
  // Snapshots are treated immutably: each edit creates a new one. Keeping the
  // saved object identity lets undo/redo compute dirty state without JSON
  // serializing a potentially multi-megabyte positioned PDF on every keypress.
  const savedSnapshot = useRef<Snapshot | null>(null);
  const [resumeId, setResumeId] = useState<number | null>(initialId > 0 && Number.isInteger(initialId) ? initialId : null);
  const idRef = useRef(resumeId); idRef.current = resumeId;
  const [published, setPublished] = useState(false);
  const [saved, setSaved] = useState('');
  const [isDirty, setIsDirty] = useState(true);
  const [ready, setReady] = useState(false); const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false); const [busy, setBusy] = useState(false);
  const saveFlight = useRef<Promise<number | null> | null>(null);
  const tokenRef = useRef(''); const ownerRef = useRef('');
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [mode, setMode] = useState<RenderMode>('pdf');
  const [ribbon, setRibbon] = useState<Ribbon>('home');
  const [zoom, setZoom] = useState(90); const [ruler, setRuler] = useState(true); const [focus, setFocus] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab | null>(null); const [documentKey, setDocumentKey] = useState(0);
  const [gallery, setGallery] = useState(query.get('templates') === '1'); const [external, setExternal] = useState(false);
  const [newDialog, setNewDialog] = useState(query.get('new') === '1'); const [fontsOpen, setFontsOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState(''); const [fontTarget, setFontTarget] = useState<'fontHeading' | 'fontBody'>('fontBody');
  const [category, setCategory] = useState('Tất cả'); const [search, setSearch] = useState('');
  const [mixer, setMixer] = useState<'primaryColor' | 'accentColor' | null>(null);
  const [recover, setRecover] = useState<Snapshot | null>(null);
  const [coachOpen, setCoachOpen] = useState(query.get('coach') === '1');
  const [proposal, setProposal] = useState<CoachProposal | null>(null);
  const [legacyChoice, setLegacyChoice] = useState(false);
  const [layoutOcrAvailable, setLayoutOcrAvailable] = useState(false);
  const [originalRetentionHours, setOriginalRetentionHours] = useState<number | null>(null);
  const [ocrRetry, setOcrRetry] = useState<OcrRetry | null>(null);
  const [layoutOverflow, setLayoutOverflow] = useState(false);
  const [replacement, setReplacement] = useState<Replacement | null>(null);
  const importMode = useRef<ImportMode>('layout');
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = isDirty;
  const theme = current.data.meta.theme;
  const visibleWarnings = [...new Set([...warnings, ...(current.data.importedLayout?.warnings || [])])];
  const ocrReviewRequired = needsOcrReview(current.data);
  const abandonedOriginalRetention = originalRetentionHours && originalRetentionHours >= 24
    ? ` Nếu đóng trang trước khi lưu, máy chủ sẽ dọn file gốc không còn được CV nào dùng sau tối đa ${originalRetentionHours % 24 === 0 ? `${originalRetentionHours / 24} ngày` : `${originalRetentionHours} giờ`}.`
    : ' Nếu đóng trang trước khi lưu, máy chủ sẽ dọn file gốc không còn được CV nào dùng theo thời hạn riêng tư trên máy chủ.';
  const previewData = proposal?.candidate ?? current.data;
  const activeTemplate = templates.find(t => t.id === current.templateId)!;
  const publishHistory = (next: History) => {
    historyRef.current = next;
    latest.current = next.present;
    setHistory(next);
  };
  const commit = (next: Snapshot, coalesceKey?: string) => {
    const previous = historyRef.current;
    const nextHistory = coalesceKey && historyGroup.current === coalesceKey
      ? { ...previous, present: next, future: [] }
      : { past: [...previous.past, previous.present].slice(-50), present: next, future: [] };
    historyGroup.current = coalesceKey ?? null;
    publishHistory(nextHistory);
    setIsDirty(next !== savedSnapshot.current);
    setError('');
  };
  const reset = (next: Snapshot, clean = false) => {
    historyGroup.current = null;
    savedSnapshot.current = clean ? next : null;
    publishHistory({ past: [], present: next, future: [] });
    setIsDirty(!clean);
    setDocumentKey(k => k + 1);
  };
  const changeImportedLayout = ({ pageIndex, id, patch, historyKey, action }: { pageIndex: number; id: string; patch: Partial<ImportedLayout['pages'][number]['elements'][number]>; historyKey?: string; action?: 'add' | 'delete' }) => {
    if (action === 'add') { addImportedTextBlock(pageIndex, id); return; }
    if (action === 'delete') { deleteImportedTextBlock({ pageIndex, id }); return; }
    const snapshot = latest.current;
    const layout = snapshot.data.importedLayout;
    const page = layout?.pages[pageIndex];
    if (!layout || !page || !page.elements.some(element => element.id === id)) return;
    const nextLayout: ImportedLayout = {
      ...layout,
      pages: layout.pages.map((currentPage, index) => index !== pageIndex ? currentPage : {
        ...currentPage,
        elements: currentPage.elements.map(element => element.id === id ? { ...element, ...patch } : element),
      }),
    };
    commit({ ...snapshot, data: synchronizeImportedBasics(snapshot.data, nextLayout) }, historyKey ? `layout:${pageIndex}:${id}:${historyKey}` : undefined);
  };
  const addImportedTextBlock = (pageIndex: number, id: string) => {
    const snapshot = latest.current;
    const layout = snapshot.data.importedLayout;
    const page = layout?.pages[pageIndex];
    if (!layout || !page) return null;
    if (page.elements.length >= 1500) {
      setError('Trang này đã đạt giới hạn 1.500 khối chữ; không thể thêm khối mới.');
      return;
    }
    const ids = new Set(layout.pages.flatMap(currentPage => currentPage.elements.map(element => element.id)));
    if (!/^added-[a-zA-Z0-9]+$/.test(id) || id.length > 80 || ids.has(id)) {
      setError('Mã khối chữ mới không hợp lệ. Hãy thử thêm lại.');
      return;
    }
    const inset = Math.min(24, Math.max(2, Math.min(page.width, page.height) / 12));
    const width = Math.max(1, Math.min(180, page.width - inset * 2));
    const height = Math.max(1, Math.min(28, page.height - inset * 2));
    const element: ImportedLayout['pages'][number]['elements'][number] = {
      id,
      text: 'Khối chữ mới',
      textEdited: true,
      x: clampLayoutValue((page.width - width) / 2, 0, Math.max(0, page.width - width)),
      y: clampLayoutValue((page.height - height) / 2, 0, Math.max(0, page.height - height)),
      width,
      height,
      fontSize: Math.max(1, Math.min(12, height)),
      fontFamily: 'Arial',
      color: '#111827',
      bold: false,
      italic: false,
    };
    const nextLayout: ImportedLayout = {
      ...layout,
      pages: layout.pages.map((currentPage, index) => index === pageIndex ? { ...currentPage, elements: [...currentPage.elements, element] } : currentPage),
    };
    commit({ ...snapshot, data: synchronizeImportedBasics(snapshot.data, nextLayout) });
    setNotice(`Đã thêm khối chữ ở trang ${pageIndex + 1}. Bạn có thể kéo hoặc dùng phím mũi tên để đặt vị trí.`);
  };
  const deleteImportedTextBlock = ({ pageIndex, id }: { pageIndex: number; id: string }) => {
    const snapshot = latest.current;
    const layout = snapshot.data.importedLayout;
    const page = layout?.pages[pageIndex];
    if (!layout || !page || !page.elements.some(element => element.id === id)) return;
    const nextLayout: ImportedLayout = {
      ...layout,
      nameElementId: layout.nameElementId === id ? undefined : layout.nameElementId,
      pages: layout.pages.map((currentPage, index) => index === pageIndex ? { ...currentPage, elements: currentPage.elements.filter(element => element.id !== id) } : currentPage),
    };
    commit({ ...snapshot, data: synchronizeImportedBasics(snapshot.data, nextLayout) });
    setNotice('Đã xóa khối chữ. Nhấn Ctrl+Z để khôi phục nếu cần.');
  };
  const chooseImportedNameElement = ({ pageIndex, id }: { pageIndex: number; id: string }) => {
    const snapshot = latest.current;
    const layout = snapshot.data.importedLayout;
    const element = layout?.pages[pageIndex]?.elements.find(candidate => candidate.id === id);
    if (!layout || !element?.text.trim()) {
      setError('Chỉ có thể dùng khối chữ có nội dung làm họ và tên.');
      return;
    }
    const nextLayout: ImportedLayout = { ...layout, nameElementId: id };
    commit({ ...snapshot, data: synchronizeImportedBasics(snapshot.data, nextLayout) }, 'layout:name');
    setNotice('Đã dùng khối chữ đã chọn làm họ và tên CV.');
  };
  const changeTheme = (patch: Partial<Theme>) => { const next = structuredClone(latest.current); Object.assign(next.data.meta.theme, patch); commit(next); };
  const undo = () => {
    const previous = historyRef.current;
    if (!previous.past.length) return;
    historyGroup.current = null;
    const next = { past: previous.past.slice(0, -1), present: previous.past.at(-1)!, future: [previous.present, ...previous.future] };
    publishHistory(next);
    setIsDirty(next.present !== savedSnapshot.current);
    setDocumentKey(k => k + 1);
  };
  const redo = () => {
    const previous = historyRef.current;
    if (!previous.future.length) return;
    historyGroup.current = null;
    const next = { past: [...previous.past, previous.present], present: previous.future[0], future: previous.future.slice(1) };
    publishHistory(next);
    setIsDirty(next.present !== savedSnapshot.current);
    setDocumentKey(k => k + 1);
  };
  const applyData = (candidate: unknown) => {
    const result = CanonicalResumeSchema.safeParse(candidate);
    if (!result.success) { setError(result.error.issues.slice(0, 3).map(x => `${x.path.join('.')}: ${x.message}`).join(' · ')); return false; }
    commit({ ...latest.current, data: result.data }); setNotice('Đã áp dụng thay đổi vào bản xem trước.'); return true;
  };
  const previewProposal = (candidate: CoachProposal) => {
    const result = CanonicalResumeSchema.safeParse(candidate.candidate);
    if (!result.success) { setError('Đề xuất không hợp lệ; CV của bạn chưa bị thay đổi.'); return; }
    if (!validateCoachProposal(latest.current.data, candidate)) { setError('Đề xuất không đủ dữ kiện hoặc có thay đổi ngoài phạm vi đã khai báo; CV của bạn chưa bị thay đổi.'); return; }
    setProposal({ ...candidate, candidate: result.data }); setError('');
  };
  const applyProposal = () => {
    if (!proposal) return;
    const result = CanonicalResumeSchema.safeParse(proposal.candidate);
    if (!result.success) { setError('Đề xuất không hợp lệ; CV của bạn chưa bị thay đổi.'); setProposal(null); return; }
    if (!validateCoachProposal(latest.current.data, proposal)) { setError('Đề xuất không còn khớp với CV hiện tại hoặc có thay đổi ngoài phạm vi đã khai báo.'); setProposal(null); return; }
    commit({ ...latest.current, data: result.data }); setProposal(null);
    setNotice('Đã áp dụng đề xuất vào bản xem trước. Bấm Lưu CV để lưu thay đổi.');
  };
  const cancelProposal = () => { setProposal(null); setNotice('Đã giữ nguyên CV.'); };
  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { credentials: 'same-origin', ...init, headers: { ...init?.headers, ...(init?.method === 'POST' ? { RequestVerificationToken: tokenRef.current } : {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw apiError(body, response.status);
    return body;
  };
  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        if (!isPublic) {
          const session = await request('/api/resume-engine/session');
          if (typeof session.token !== 'string') throw new Error('Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.');
          tokenRef.current = session.token; ownerRef.current = String(session.userId || '');
          void request('/api/resume-engine/capabilities').then(capabilities => {
            if (stopped) return;
            setLayoutOcrAvailable(capabilities.layoutOcr === true);
            const retention = Number(capabilities.originalRetentionHours);
            setOriginalRetentionHours(Number.isInteger(retention) && retention >= 24 ? retention : null);
          }).catch(() => { if (!stopped) { setLayoutOcrAvailable(false); setOriginalRetentionHours(null); } });
        }
        let next = initial;
        let nextIsSaved = false;
        if (idRef.current) {
          const payload = await request(`/api/resume-engine/${isPublic ? 'public' : 'document'}/${idRef.current}`);
          next = { data: CanonicalResumeSchema.parse(payload.data), templateId: validTemplate(payload.templateId) ? payload.templateId : 't1' };
          if (!stopped) {
            setPublished(Boolean(payload.published));
            if (payload.imported) {
              setLegacyChoice(Boolean(payload.hasOriginalFile));
              setSaved('');
              setNotice(payload.importSource === 'ai'
                ? 'AI đã đọc lại CV bạn tải lên và chuyển sang Resume Studio. Kiểm tra từng mục rồi bấm Lưu CV — file gốc vẫn được giữ.'
                : 'Đã chuyển CV cũ sang Resume Studio. Kiểm tra nội dung, bổ sung mô tả công việc rồi bấm Lưu CV.');
            } else { setSaved(serialize(next)); nextIsSaved = true; }
          }
        }
        if (stopped) return;
        reset(next, nextIsSaved);
        if (!isPublic && ownerRef.current) { try { const raw = sessionStorage.getItem(`aris-draft:${ownerRef.current}:${idRef.current || 'new'}`); if (raw) { const draft = JSON.parse(raw); const parsed = CanonicalResumeSchema.safeParse(draft.data); if (parsed.success && validTemplate(draft.templateId) && serialize(next) !== serialize(draft)) setRecover({ data: parsed.data, templateId: draft.templateId }); } } catch {} }
        if (isPublic) setMode('landing');
      } catch (e) { if (!stopped) { setError(e instanceof Error ? e.message : 'Không tải được hồ sơ.'); if (idRef.current || isPublic) setLoadFailed(true); } }
      finally { if (!stopped) setReady(true); }
    })();
    return () => { stopped = true; };
  }, []);
  useEffect(() => {
    if (!ready || isPublic || loadFailed || !ownerRef.current || recover) return;
    const key = `aris-draft:${ownerRef.current}:${resumeId || 'new'}`;
    if (!dirty) {
      try { sessionStorage.removeItem(key); } catch {}
      return;
    }
    // A positioned PDF can include multi-megabyte raster pages. Coalesce typing
    // into one draft write instead of serializing the entire document per key.
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(key, serialize(latest.current)); }
      catch { setError('Không đủ bộ nhớ trình duyệt để lưu bản nháp cục bộ. Hãy lưu CV trước khi đóng trang.'); }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [current, dirty, ready, resumeId, recover, loadFailed]);
  useEffect(() => { if (!dirty || isPublic) return; const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty, isPublic]);
  const clearDraft = (id = idRef.current) => {
    if (!ownerRef.current) return;
    try { sessionStorage.removeItem(`aris-draft:${ownerRef.current}:${id || 'new'}`); } catch {}
  };
  const save = async (): Promise<number | null> => {
    if (saveFlight.current) return saveFlight.current;
    if (layoutOverflow) { setError('Có chữ vượt khối gốc. Hãy chỉnh rộng, cao hoặc cỡ chữ trước khi lưu hay xuất PDF.'); return null; }
    // Every edit publishes a new immutable snapshot, so this reference stays
    // stable while an in-flight request is serialized. Avoid cloning the entire
    // raster-backed layout just to save it.
    const snapshot = latest.current;
    // Keep this synchronous guard outside the single-flight assignment. Otherwise
    // an immediately rejected save leaves a resolved promise in saveFlight and
    // blocks the user after they confirm their OCR review.
    if (needsOcrReview(snapshot.data)) { setError('Hãy xác nhận đã đối chiếu từng trang OCR với file gốc trước khi lưu hoặc công khai.'); return null; }
    setSaving(true); setError('');
    const operation = (async () => {
      try {
        if (!tokenRef.current) { const session = await request('/api/resume-engine/session'); if (!session.token) throw new Error('Hãy đăng nhập để lưu CV.'); tokenRef.current = session.token; }
        const priorId = idRef.current;
        const result = await request('/api/resume-engine/document', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeId: idRef.current, data: snapshot.data, templateId: snapshot.templateId }) });
        if (!Number.isInteger(result.resumeId) || result.resumeId < 1) throw new Error('Máy chủ không trả về mã CV hợp lệ.');
        idRef.current = result.resumeId; setResumeId(result.resumeId); setPublished(Boolean(result.published)); setSaved(serialize(snapshot));
        // A user may make another edit while a save is in flight. That later
        // immutable snapshot remains dirty; only the exact saved one is clean.
        savedSnapshot.current = snapshot;
        historyGroup.current = null;
        setIsDirty(latest.current !== snapshot);
        window.history.replaceState(null, '', `${window.location.pathname}?resumeId=${result.resumeId}`);
        setNotice(result.aiSync === 'pending' ? 'CV đã lưu. AI chưa nhận được cập nhật; bấm Lưu CV để thử đồng bộ lại.' : result.aiSync === 'too_short' ? 'CV đã lưu. Nội dung còn quá ngắn để tạo gợi ý AI.' : 'Đã lưu CV. AI đã nhận nội dung mới; gợi ý việc làm sẽ cập nhật sau khi xử lý.');
        clearDraft(priorId); clearDraft(result.resumeId as number);
        return result.resumeId as number;
      } catch (e) { setError(e instanceof Error ? e.message : 'Không lưu được CV.'); return null; }
      finally { setSaving(false); saveFlight.current = null; }
    })(); saveFlight.current = operation; return operation;
  };
  const postJson = (url: string, body: unknown) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const copyPublic = async () => { if (!idRef.current) return; const url = `${window.location.origin}/portfolio/${idRef.current}`; try { await navigator.clipboard.writeText(url); setNotice(`Đã sao chép: ${url}`); } catch { setNotice(`Liên kết công khai: ${url}`); } };
  const publish = async () => { setBusy(true); try { const id = await save(); if (!id) return; await request(`/api/resume-engine/document/${id}/publish`, { method: 'POST' }); setPublished(true); await copyPublic(); } catch (e) { setError(e instanceof Error ? e.message : 'Không công khai được CV.'); } finally { setBusy(false); } };
  const unpublish = async () => { setBusy(true); try { await request(`/api/resume-engine/document/${idRef.current}/unpublish`, { method: 'POST' }); setPublished(false); setNotice('Đã thu hồi liên kết công khai.'); } catch (e) { setError(String(e)); } finally { setBusy(false); } };
  const chooseFile = (requestedMode: ImportMode) => { importMode.current = requestedMode; setNewDialog(false); fileInput.current?.click(); };
  const discardAbandonedOriginal = async (data: CanonicalResume) => {
    const sourceId = data.importedLayout?.sourceId;
    if (!sourceId || !/^[a-f0-9]{32}$/.test(sourceId) || !tokenRef.current) return true;
    // The server refuses this request if a saved document still references the
    // original, so this only removes an explicitly abandoned private import.
    try {
      await request(`/api/resume-engine/original/${sourceId}/discard`, { method: 'POST' });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thể xóa file gốc của bản nhập đã bỏ.');
      return false;
    }
  };
  const startNew = (next: Replacement) => {
    // A saved CV may still be using its original. The server would reject a
    // discard anyway, but avoid issuing that misleading request in the first
    // place. Unsaved imports are explicitly abandoned as the user moves on.
    if (!idRef.current) void discardAbandonedOriginal(latest.current.data);
    clearDraft();
    reset({ data: next.data, templateId: latest.current.templateId });
    setResumeId(null); idRef.current = null; setPublished(false); setSaved(''); setRecover(null);
    setWarnings(next.warnings || []); setOcrRetry(null); setLayoutOverflow(false);
    window.history.replaceState(null, '', window.location.pathname);
    setNewDialog(false); setEditorTab(next.editorTab === undefined ? 'profile' : next.editorTab);
    setNotice(next.notice || 'Hồ sơ mới. Hãy thêm nội dung của bạn rồi lưu.');
  };
  const confirmReplacement = () => {
    const next = replacement;
    if (!next) return;
    setReplacement(null);
    startNew(next);
  };
  const requestReplacement = (next: Replacement) => {
    if (!dirty) { startNew(next); return; }
    setReplacement(next);
    setNewDialog(false);
  };
  const cancelReplacement = async () => {
    const next = replacement;
    setReplacement(null);
    setNotice('Đã giữ nguyên CV đang soạn.');
    if (next?.discardOriginalOnCancel) await discardAbandonedOriginal(next.data);
  };
  const saveThenReplace = async () => {
    if (!replacement) return;
    const savedId = await save();
    if (savedId) confirmReplacement();
  };
  const confirmOcrReview = () => {
    const next = structuredClone(latest.current);
    if (!next.data.importedLayout?.ocrReviewRequired) return;
    next.data.importedLayout.ocrReviewConfirmed = true;
    commit(next);
    setNotice('Đã ghi nhận bạn đã đối chiếu bản OCR với file gốc. Bạn vẫn có thể chỉnh sửa trước khi lưu.');
  };
  const importFile = async (file: File, requestedMode: ImportMode = importMode.current) => {
    if (file.size > 10 * 1024 * 1024) { setError('Tệp tối đa 10 MB.'); return; }
    if (requestedMode === 'layout-ocr' && !layoutOcrAvailable) { setError('OCR giữ bố cục chưa sẵn sàng trên máy chủ này. File gốc chưa bị thay đổi.'); return; }
    if (requestedMode === 'layout-ocr' && !/\.pdf$/i.test(file.name)) { setError('OCR giữ bố cục hiện chỉ nhận PDF scan/ảnh.'); return; }
    setBusy(true); setError('');
    try {
      let payload: { data: unknown; warnings?: string[] };
      if (/\.json$/i.test(file.name)) payload = { data: JSON.parse(await file.text()) };
      else {
        const form = new FormData(); form.append('file', file); form.append('mode', requestedMode);
        payload = await request('/api/resume-engine/parse', { method: 'POST', body: form });
      }
      const data = CanonicalResumeSchema.parse(payload.data);
      const parsedUpload = !/\.json$/i.test(file.name) && Boolean(data.importedLayout?.sourceId);
      requestReplacement({
        data,
        warnings: (payload.warnings || []).filter(x => typeof x === 'string'),
        editorTab: data.importedLayout ? null : 'profile',
        discardOriginalOnCancel: parsedUpload,
        notice: data.importedLayout
          ? requestedMode === 'layout-ocr'
            ? `Đã tạo bản chỉnh sửa OCR. Đối chiếu từng trang với file gốc trước khi lưu hoặc công khai.${abandonedOriginalRetention}`
            : `Đã nhập bố cục gốc. Chọn khối chữ để sửa; file gốc được giữ riêng.${abandonedOriginalRetention}`
          : 'Đã chuyển nội dung sang mẫu mới. Bố cục gốc không được giữ.',
      });
    } catch (e) {
      if (requestedMode === 'layout' && isOcrRetry(e)) { setOcrRetry({ kind: 'file', file }); setError(''); }
      else setError(e instanceof Error ? e.message : 'Không đọc được tài liệu.');
    } finally { setBusy(false); }
  };
  const importOriginal = async (requestedMode: LayoutImportMode = 'layout') => {
    if (requestedMode === 'layout-ocr' && !layoutOcrAvailable) { setError('OCR giữ bố cục chưa sẵn sàng trên máy chủ này. File gốc chưa bị thay đổi.'); return; }
    setBusy(true); setError('');
    try {
      const form = new FormData(); form.append('mode', requestedMode);
      const payload = await request(`/api/resume-engine/document/${idRef.current}/import-layout`, { method: 'POST', body: form });
      const data = CanonicalResumeSchema.parse(payload.data);
      commit({ ...latest.current, data }); setEditorTab(null); setLegacyChoice(false); setOcrRetry(null); setLayoutOverflow(false);
      setWarnings(data.importedLayout?.warnings || []);
      setNotice(requestedMode === 'layout-ocr'
        ? 'Đã tạo bản chỉnh sửa OCR. Đối chiếu từng trang với file gốc trước khi lưu hoặc công khai.'
        : 'Đã mở bố cục gốc. Chọn một khối chữ để sửa, sau đó lưu CV.');
    } catch (e) {
      if (requestedMode === 'layout' && isOcrRetry(e)) { setOcrRetry({ kind: 'legacy' }); setError(''); }
      else setError(e instanceof Error ? e.message : 'Không nhập được file gốc.');
    } finally { setBusy(false); }
  };
  const importTemplate = async () => {
    setBusy(true); setError('');
    try {
      const payload = await request(`/api/resume-engine/document/${idRef.current}/import-template`, { method: 'POST' });
      const data = CanonicalResumeSchema.parse(payload.data);
      commit({ ...latest.current, data, templateId: validTemplate(payload.templateId) ? payload.templateId : 't1' }); setLegacyChoice(false); setOcrRetry(null);
      setNotice(payload.importSource === 'ai' ? 'AI đã đọc nội dung CV để chuyển sang mẫu Studio. Kiểm tra từng mục rồi lưu CV.' : 'Đã chuyển nội dung sang mẫu Studio mới. Bố cục file gốc không được giữ.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Không chuyển được CV sang mẫu Studio.'); }
    finally { setBusy(false); }
  };
  const startOcrRetry = () => {
    if (!ocrRetry) return;
    if (ocrRetry.kind === 'legacy') { void importOriginal('layout-ocr'); return; }
    if (ocrRetry.kind === 'new-file') { setOcrRetry(null); chooseFile('layout-ocr'); return; }
    void importFile(ocrRetry.file, 'layout-ocr');
  };
  const chooseTemplateInstead = () => {
    if (!ocrRetry) return;
    if (ocrRetry.kind === 'legacy') { void importTemplate(); return; }
    if (ocrRetry.kind === 'file') { void importFile(ocrRetry.file, 'template'); return; }
    setOcrRetry(null); chooseFile('template');
  };
  const print = async () => {
    if (layoutOverflow) { setError('Có chữ vượt khối gốc. Hãy chỉnh rộng, cao hoặc cỡ chữ trước khi xuất PDF.'); return; }
    setMode('pdf'); await new Promise(resolve => setTimeout(resolve, 150)); await document.fonts.ready; window.print();
  };
  useEffect(() => { if (isPublic) return; const handler = (e: KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey)) return; const input = (e.target as HTMLElement)?.closest('input,textarea,[contenteditable="true"]'); if (e.key.toLowerCase() === 's') { e.preventDefault(); if (!busy && !editorTab && !proposal) void save(); } if (!input && !editorTab && !proposal && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } if (!input && !editorTab && !proposal && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });

  if (!ready) return <main className="studio-loading">Đang mở Resume Studio…</main>;
  if (loadFailed) return <main className="studio-loading"><h1>Không mở được hồ sơ</h1><p role="alert">{error}</p><a href="/Resume">Về danh sách CV</a></main>;
  if (isPublic) return current.data.importedLayout ? <ImportedDocument layout={current.data.importedLayout}/> : <EngineSwitcher data={current.data} templateId={current.templateId} mode="landing" />;
  const locked = saving || busy || legacyChoice || !!proposal;
  const words = [previewData.basics.name, previewData.basics.headline, previewData.basics.summary, ...previewData.work.flatMap(x => [x.role, x.company, ...x.highlights]), ...previewData.projects.flatMap(x => [x.title, x.tagline, x.description]), ...previewData.skills.flatMap(x => x.items.map(i => i.name)), ...previewData.education.flatMap(x => [x.institution, x.degree, x.field])].join(' ').trim().split(/\s+/).filter(Boolean).length;
  return <div className={`word-studio ${focus ? 'focus-mode' : ''}`}>
    <header className="word-titlebar interactive-only flex items-center"><a href="/Resume" className="word-brand"><span>A</span>aris<span className="brand-divider">/</span><b>resume studio</b></a><div className="document-title"><strong>{current.data.basics.name || 'Hồ sơ mới'}</strong><span>{resumeId ? `CV #${resumeId}` : 'Bản nháp'} · {saving ? 'Đang lưu…' : saved && !dirty ? 'Đã lưu' : 'Chưa lưu'}</span></div><div className="title-actions"><button className="coach-button" aria-pressed={coachOpen} onClick={() => setCoachOpen(x => !x)} title="Chấm CV và gợi ý cách sửa">✦ <span>Trợ lý CV</span></button><button disabled={locked || !!editorTab} onClick={() => void save()} title={editorTab ? 'Áp dụng chỉnh sửa trước khi lưu' : 'Ctrl+S'}>▣ <span>Lưu CV</span></button><button className="publish-button" disabled={locked || !!editorTab} onClick={() => void publish()}>{published ? 'Cập nhật portfolio ↗' : 'Công khai portfolio ↗'}</button></div></header>
    <div className="word-toolbar interactive-only"><nav className="ribbon-tabs" aria-label="Thanh công cụ"><button className="file-tab" onClick={() => setNewDialog(true)} disabled={locked || !!editorTab}>Tệp</button>{([{ id: 'home', name: 'Trang đầu' }, { id: 'insert', name: 'Chèn' }, { id: 'design', name: 'Thiết kế' }, { id: 'view', name: 'Xem' }] as const).map(t => <button key={t.id} className={ribbon === t.id ? 'selected' : ''} aria-pressed={ribbon === t.id} onClick={() => setRibbon(t.id)}>{t.name}</button>)}<div className="ribbon-tail"><span className="save-dot"/>{FONT_CATALOG.length} font · 32 layout</div></nav>
      <div className="ribbon-content">
        {current.data.importedLayout && <div className="ribbon-group"><strong>Đang giữ bố cục gốc</strong><small>Chọn khối chữ trên trang để sửa; Ctrl+S để lưu.</small><button onClick={() => void print()}>In / lưu PDF</button></div>}{!current.data.importedLayout && ribbon === 'home' && <><div className="ribbon-group history-tools"><div><button aria-label="Hoàn tác" title="Hoàn tác · Ctrl+Z" disabled={!history.past.length || !!editorTab} onClick={undo}>↶</button><button aria-label="Làm lại" title="Làm lại · Ctrl+Y" disabled={!history.future.length || !!editorTab} onClick={redo}>↷</button></div><small>Lịch sử</small></div><div className="ribbon-group font-tools"><FontPicker label="Font tiêu đề" value={theme.fontHeading} onChange={v => changeTheme({ fontHeading: v })}/><FontPicker label="Font nội dung" value={theme.fontBody} onChange={v => changeTheme({ fontBody: v })}/><button className="font-library-link" onClick={() => setFontsOpen(true)}>Aa · Khám phá {FONT_CATALOG.length} font</button></div><div className="ribbon-group color-tools"><div><button onClick={() => setMixer('primaryColor')}><span className="color-underline" style={{ borderColor: theme.primaryColor }}>A</span>Màu chính</button><button onClick={() => setMixer('accentColor')}><span className="color-chip" style={{ background: theme.accentColor }}/>Màu nhấn</button></div><small>Màu & bộ pha màu</small></div><div className="ribbon-group"><button className="ribbon-large" onClick={() => setEditorTab('profile')}><span>✎</span>Chỉnh nội dung</button><small>Văn bản & liên kết</small></div><div className="ribbon-group"><button className="ribbon-large" aria-pressed={coachOpen} onClick={() => setCoachOpen(x => !x)}><span>✦</span>Trợ lý CV</button><small>Chấm điểm & gợi ý</small></div><div className="ribbon-group"><button className="ribbon-large" onClick={() => setGallery(true)}><span>▦</span>Đổi layout</button><small>{activeTemplate.name}</small></div></>}
        {!current.data.importedLayout && ribbon === 'insert' && <><div className="ribbon-group insert-tools">{sections.map(s => <button key={s.id} onClick={() => setEditorTab(s.id)}><span>{s.icon}</span>{s.label}</button>)}</div><div className="ribbon-group"><button className="ribbon-large" disabled={locked || !!editorTab} onClick={() => fileInput.current?.click()}><span>↥</span>Nhập tài liệu</button><small>PDF · DOCX · ảnh · JSON</small></div></>}
        {!current.data.importedLayout && ribbon === 'design' && <><div className="ribbon-group"><div className="palette-strip">{palettes.map(([name, primary, accent]) => <button key={name} title={name} aria-label={`Bảng màu ${name}`} onClick={() => changeTheme({ primaryColor: primary, accentColor: accent })}><i style={{ background: primary }}/><i style={{ background: accent }}/><span>{name}</span></button>)}</div><small>Bảng màu phối sẵn</small></div><div className="ribbon-group"><label>Bo góc<select value={theme.radius} onChange={e => changeTheme({ radius: e.target.value as Theme['radius'] })}><option value="none">Vuông</option><option value="sm">Nhẹ</option><option value="md">Vừa</option><option value="full">Tròn</option></select></label><small>Áp dụng theo layout</small></div><div className="ribbon-group"><button className="ribbon-large" onClick={() => setGallery(true)}><span>▦</span>32 layout</button><small>Chỉnh sửa trong Studio</small></div><div className="ribbon-group"><button className="ribbon-large" onClick={() => setExternal(true)}><span>↗</span>Kho mở rộng</button><small>Theme từ cộng đồng</small></div></>}
        {ribbon === 'view' && <><div className="ribbon-group"><div className="segmented"><button className={mode === 'pdf' ? 'active' : ''} onClick={() => setMode('pdf')}>▤ Trang A4</button><button className={mode === 'landing' ? 'active' : ''} onClick={() => setMode('landing')}>▣ Website</button></div><small>Đích hiển thị</small></div><div className="ribbon-group"><label className="check-control"><input type="checkbox" checked={ruler} onChange={e => setRuler(e.target.checked)}/> Thước ngang</label><label className="check-control"><input type="checkbox" checked={focus} onChange={e => setFocus(e.target.checked)}/> Tập trung vào CV</label></div><div className="ribbon-group"><label>Thu phóng<input aria-label="Thu phóng" type="range" min="50" max="150" step="5" value={zoom} onChange={e => setZoom(Number(e.target.value))}/></label><small>{zoom}%</small></div><div className="ribbon-group"><button className="ribbon-large" onClick={() => void print()}><span>⎙</span>In / tải PDF</button><small>A4 · lề 12 × 15 mm</small></div></>}
      </div>
    </div>
    <input ref={fileInput} hidden type="file" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.json" disabled={locked} onChange={e => { const file = e.target.files?.[0]; const requestedMode = importMode.current; if (file) void importFile(file, requestedMode); e.currentTarget.value = ''; }}/>
    {(error || notice || busy || recover || visibleWarnings.length > 0 || ocrReviewRequired) && <div className="studio-messages interactive-only">{error && <div className="message error" role="alert">{error}<button aria-label="Đóng lỗi" onClick={() => setError('')}>×</button></div>}{busy && <div className="message" role="status">Đang xử lý…</div>}{notice && !busy && <div className="message" role="status">{notice}<button aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button></div>}{recover && <div className="message">Có bản nháp chưa lưu trong phiên trình duyệt này.<button onClick={() => { reset(recover); setRecover(null); }}>Khôi phục</button><button onClick={() => setRecover(null)}>Bỏ qua</button></div>}{ocrReviewRequired && <div className="message error" role="alert"><strong>Kiểm tra OCR trước khi tiếp tục</strong><p>OCR có thể bỏ sót chữ mờ hoặc nhỏ trong ảnh nền. Hãy mở file gốc, đối chiếu từng trang và chỉnh các phần sai trước khi lưu hoặc công khai.</p><button onClick={confirmOcrReview}>Tôi đã đối chiếu với file gốc</button></div>}{visibleWarnings.length > 0 && <details className="parse-warnings" open><summary>Cần kiểm tra sau khi nhập ({visibleWarnings.length})</summary><ul>{visibleWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}</div>}
    <div className={`word-workspace ${coachOpen ? 'with-coach' : ''}`}><aside className="document-outline interactive-only">{current.data.importedLayout && <div className="outline-template"><strong>Bố cục PDF gốc</strong><p>Chọn chữ ngay trên trang để chỉnh sửa.</p>{current.data.importedLayout.sourceId && <a href={`/api/resume-engine/original/${current.data.importedLayout.sourceId}`} target="_blank" rel="noreferrer">Mở file gốc ↗</a>}</div>}<div hidden={!!current.data.importedLayout}><div className="outline-heading"><small>TÀI LIỆU CỦA BẠN</small><span>↙</span></div><h2>Nội dung CV</h2><p>Chọn một phần để chỉnh sửa.</p><nav>{sections.map(s => <button key={s.id} className={editorTab === s.id ? 'active' : ''} onClick={() => setEditorTab(s.id)}><span>{s.icon}</span>{s.label}<b>›</b></button>)}</nav><div className="outline-template"><span className="outline-template-icon">▤</span><small>LAYOUT HIỆN TẠI</small><strong>{activeTemplate.name}</strong><button onClick={() => setGallery(true)}>Khám phá 32 layout →</button></div><button className="community-button" onClick={() => setExternal(true)}>↗ Kho theme cộng đồng</button><div className="outline-bottom"><span className="save-dot"/> Một hồ sơ, nhiều thiết kế</div></div></aside>
      <main className={`document-stage ${mode} ${proposal ? 'proposal-preview' : ''}`} aria-label="Bản xem trước CV"><div className="canvas-heading interactive-only"><div><strong>{mode === 'pdf' ? 'Bản in A4' : 'Portfolio tương tác'}</strong><span>{mode === 'pdf' ? 'Phân trang theo nội dung khi xuất PDF' : 'Nhấp kỹ năng để lọc dự án'}</span></div><div><button className={mode === 'pdf' ? 'active' : ''} onClick={() => setMode('pdf')}>A4</button><button className={mode === 'landing' ? 'active' : ''} onClick={() => setMode('landing')}>Web</button><button disabled={layoutOverflow} onClick={() => void print()} title={layoutOverflow ? 'Chỉnh chữ vượt khối trước khi xuất PDF' : 'In hoặc lưu PDF'}>⎙</button></div></div>{ruler && <div className="page-ruler interactive-only" aria-hidden="true">{Array.from({ length: 19 }, (_, i) => <span key={i}>{i}</span>)}</div>}<div className="page-zoom" style={{ zoom: zoom / 100 }}>{previewData.importedLayout ? <ImportedDocument layout={previewData.importedLayout} disabled={locked} onChange={changeImportedLayout} onChooseNameElement={chooseImportedNameElement} onLayoutOverflowChange={setLayoutOverflow}/> : <EngineSwitcher data={previewData} templateId={current.templateId} mode={mode}/>}</div><div className="canvas-note interactive-only">{mode === 'pdf' ? 'A4 · 210 × 297 mm · Chữ có thể tìm kiếm trong PDF' : 'Portfolio responsive · Kỹ năng, dự án và liên hệ tương tác'}</div></main>
      {coachOpen && <Coach data={current.data} post={postJson} onEdit={tab => setEditorTab(tab)} onClose={() => setCoachOpen(false)} onPropose={previewProposal}/>} 
    </div>
    <footer className="word-statusbar interactive-only"><div><span>{words} từ</span><span>{current.data.meta.slug}</span><span>{published ? '● Portfolio công khai' : '○ Riêng tư'}</span>{published && <><button onClick={() => void copyPublic()}>Sao chép link</button><button disabled={locked} onClick={() => void unpublish()}>Thu hồi</button></>}</div><div><button onClick={() => setFocus(x => !x)}>{focus ? 'Hiện điều hướng' : 'Tập trung'}</button><button aria-label="Thu nhỏ" onClick={() => setZoom(z => Math.max(50, z - 10))}>−</button><input aria-label="Mức thu phóng" type="range" min="50" max="150" step="5" value={zoom} onChange={e => setZoom(Number(e.target.value))}/><button aria-label="Phóng to" onClick={() => setZoom(z => Math.min(150, z + 10))}>+</button><span>{zoom}%</span></div></footer>
    {editorTab && !current.data.importedLayout && <ResumeEditor value={current.data} documentKey={String(documentKey)} initialTab={editorTab} onSave={candidate => { const ok = applyData(candidate); if (ok) setEditorTab(null); return ok; }} onClose={() => setEditorTab(null)}/>}
    {proposal && <ProposalDialog proposal={proposal} onApply={applyProposal} onCancel={cancelProposal}/>} 
    {mixer && <ColorMixer label={mixer === 'primaryColor' ? 'Màu chính' : 'Màu nhấn'} value={theme[mixer]} onApply={color => changeTheme({ [mixer]: color })} onClose={() => setMixer(null)}/>}
    {external && <ExternalGallery data={current.data} onClose={() => setExternal(false)}/>}
    {gallery && <Modal title="Chọn thiết kế cho câu chuyện của bạn" wide onClose={() => setGallery(false)}><div className="gallery-intro"><p>32 cấu trúc layout. Mọi mẫu dùng chung nội dung CV của bạn.</p><button onClick={() => { setGallery(false); setExternal(true); }}>Kho cộng đồng ↗</button></div><input className="gallery-search" aria-label="Tìm layout" placeholder="Tìm tên, ngành nghề, phong cách…" value={search} onChange={e => setSearch(e.target.value)}/><div className="gallery-categories" aria-label="Danh mục layout">{categories.map(c => <button className={category === c ? 'selected' : ''} aria-pressed={category === c} key={c} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="native-gallery">{templates.filter(t => (category === 'Tất cả' || t.categories.includes(category)) && `${t.name} ${t.note} ${t.categories.join(' ')}`.toLowerCase().includes(search.toLowerCase())).map(t => <button className={`native-card ${t.id === current.templateId ? 'selected' : ''}`} key={t.id} onClick={() => { commit({ ...latest.current, templateId: t.id }); setGallery(false); }}><div className="native-thumbnail"><img src={`/resume-engine/previews/${t.id}.png`} loading="lazy" alt={`Bản xem trước ${t.name}`} onError={e => { e.currentTarget.hidden = true; }}/><span className="thumbnail-label">{t.id.toUpperCase()}</span></div><div className="native-card-info"><strong>{t.name}</strong><small>{t.note}</small><span>{t.id === current.templateId ? '✓ Đang sử dụng' : 'Sử dụng layout →'}</span></div></button>)}</div></Modal>}
    {fontsOpen && <Modal title={`${FONT_CATALOG.length} font cho CV của bạn`} wide onClose={() => setFontsOpen(false)}><div className="font-library-controls"><input aria-label="Tìm font" placeholder="Tìm font: Calibri, Be Vietnam Pro, Serif…" value={fontSearch} onChange={e => setFontSearch(e.target.value)}/><select aria-label="Áp dụng font cho" value={fontTarget} onChange={e => setFontTarget(e.target.value as typeof fontTarget)}><option value="fontBody">Áp dụng cho nội dung</option><option value="fontHeading">Áp dụng cho tiêu đề</option></select></div><p className="font-note">Font hệ thống dùng bản đã cài trên máy. Font web được tải khi chọn; cần kết nối mạng lần đầu.</p><div className="font-library-grid">{FONT_CATALOG.filter(f => `${f.family} ${f.category}`.toLowerCase().includes(fontSearch.toLowerCase())).map(f => <button key={f.family} className={theme[fontTarget] === f.family ? 'selected' : ''} onMouseEnter={() => loadFont(f.family)} onFocus={() => loadFont(f.family)} onClick={() => { loadFont(f.family); changeTheme({ [fontTarget]: f.family }); }}><span style={{ fontFamily: `"${f.family}", ${f.category === 'Serif' ? 'serif' : f.category === 'Monospace' ? 'monospace' : 'sans-serif'}` }}>Sáng tạo từ điều giản dị.</span><strong>{f.family}</strong><small>{f.category} · {f.web ? 'Web font' : 'Font hệ thống'}</small></button>)}</div></Modal>}
    {ocrRetry && ocrRetry.kind !== 'legacy' && <Modal title="OCR giữ bố cục cho CV scan/ảnh" onClose={() => setOcrRetry(null)}>
      <p>OCR cục bộ sẽ nhận diện chữ và tạo các khối chữ để bạn chỉnh sửa. File gốc không bị thay đổi.</p>
      <p className="new-note">Tính năng thử nghiệm: chữ mờ hoặc nhỏ có thể còn sót trong nền. Hãy đối chiếu từng trang, nhất là tên riêng, dấu tiếng Việt, font, màu và xuống dòng trước khi lưu hoặc công khai.</p>
      {!layoutOcrAvailable && <p role="alert">OCR cục bộ chưa sẵn sàng. Bạn vẫn có thể dùng PDF có lớp chữ hoặc chuyển sang mẫu Studio mới.</p>}
      <div className="file-actions">
        <button className="primary" disabled={busy || !layoutOcrAvailable} onClick={startOcrRetry}>Bắt đầu OCR cục bộ</button>
        <button disabled={busy} onClick={chooseTemplateInstead}>Chuyển sang mẫu Studio mới</button>
        <button disabled={busy} onClick={() => setOcrRetry(null)}>Hủy</button>
      </div>
    </Modal>}
    {legacyChoice && <Modal title="Mở CV đã tải lên" onClose={() => { window.location.href = '/Resume'; }}>
      <p>Chọn cách chỉnh sửa CV. File gốc luôn được giữ lại.</p>
      {error && <p role="alert">{error}</p>}
      {ocrRetry?.kind === 'legacy' ? <>
        <p>CV này là scan/ảnh. OCR cục bộ sẽ tạo bản chỉnh sửa thử nghiệm với các khối chữ ước lượng.</p>
        <p className="new-note">Chữ mờ hoặc nhỏ có thể còn sót trong nền; hãy đối chiếu từng trang với file gốc trước khi lưu hoặc công khai.</p>
        {!layoutOcrAvailable && <p role="alert">OCR cục bộ chưa sẵn sàng. File gốc chưa bị thay đổi.</p>}
        <div className="file-actions">
          <button className="primary" disabled={busy || !layoutOcrAvailable} onClick={startOcrRetry}>Bắt đầu OCR cục bộ</button>
          <button disabled={busy} onClick={() => setOcrRetry(null)}>Quay lại lựa chọn</button>
          <button disabled={busy} onClick={chooseTemplateInstead}>Chuyển sang mẫu Studio mới</button>
        </div>
      </> : <>
        <div className="file-actions">
          <button disabled={busy} onClick={() => void importOriginal()}>Giữ bố cục PDF có lớp chữ</button>
          <button disabled={busy || !layoutOcrAvailable} title={layoutOcrAvailable ? 'Nhận diện OCR cục bộ, cần kiểm tra lại từng trang' : 'OCR cục bộ chưa sẵn sàng'} onClick={() => setOcrRetry({ kind: 'legacy' })}>CV scan/ảnh — OCR cục bộ</button>
          <button disabled={busy} onClick={() => void importTemplate()}>Chuyển sang mẫu Studio mới</button>
        </div>
        {!layoutOcrAvailable && <p className="new-note">OCR cục bộ chỉ xuất hiện khi dịch vụ nhận diện trên máy chủ đã sẵn sàng.</p>}
      </>}
    </Modal>}
    {replacement && <Modal title="Lưu thay đổi trước khi thay CV?" onClose={() => { void cancelReplacement(); }}>
      <p>CV đang mở có thay đổi chưa lưu. Chọn lưu để giữ bản hiện tại trước khi chuyển sang CV khác, hoặc xác nhận bỏ các thay đổi này.</p>
      <p className="new-note">Nếu bạn vừa chọn một PDF khác rồi ở lại, file gốc của bản nhập đó sẽ được bỏ an toàn; CV đang mở không bị thay đổi.</p>
      <div className="file-actions">
        <button type="button" disabled={saving || busy} onClick={() => { void cancelReplacement(); }}>Ở lại</button>
        <button type="button" disabled={saving || busy} onClick={confirmReplacement}>Bỏ thay đổi</button>
        <button type="button" className="primary" disabled={saving || busy || layoutOverflow} onClick={() => { void saveThenReplace(); }}>Lưu CV rồi tiếp tục</button>
      </div>
      {layoutOverflow && <p role="alert" className="new-note">Hãy chỉnh chữ vượt khối trước khi lưu, hoặc chọn bỏ thay đổi.</p>}
    </Modal>}
    {newDialog && <Modal title="Bắt đầu một hồ sơ mới" onClose={() => setNewDialog(false)}>
      <p className="new-description">Tạo CV mới hoặc sửa PDF trên bố cục gốc. Chuyển sang mẫu mới là lựa chọn riêng và sẽ thay bố cục.</p>
      {dirty && <p className="new-note">Bản hiện tại có thay đổi chưa lưu. Khi tiếp tục, Studio sẽ hỏi bạn muốn lưu hay bỏ thay đổi.</p>}
      <form className="new-resume-form" onSubmit={e => { e.preventDefault(); const fields = new FormData(e.currentTarget); requestReplacement({ data: blankResume(String(fields.get('name')).trim(), String(fields.get('headline')).trim(), String(fields.get('email')).trim()) }); }}>
        <label>Họ và tên<input name="name" required autoComplete="name"/></label><label>Vị trí / chuyên môn<input name="headline" required/></label><label>Email<input name="email" type="email" required autoComplete="email"/></label><button className="primary" type="submit" disabled={locked}>Tạo từ trang trắng →</button>
      </form>
      <div className="file-actions">
        <button disabled={locked} onClick={() => chooseFile('layout')}>↥ Nhập PDF có lớp chữ / JSON</button>
        <button disabled={locked || !layoutOcrAvailable} title={layoutOcrAvailable ? 'OCR cục bộ thử nghiệm; cần đối chiếu lại từng trang' : 'OCR cục bộ chưa sẵn sàng'} onClick={() => { setNewDialog(false); setOcrRetry({ kind: 'new-file' }); }}>CV scan/ảnh — OCR giữ bố cục</button>
        <button disabled={locked} onClick={() => chooseFile('template')}>Chuyển CV sang mẫu mới</button>
        <button onClick={() => download(current.data, `${current.data.meta.slug}.json`)}>↓ Tải bản JSON hiện tại</button>
        <button disabled={locked} onClick={() => requestReplacement({ data: structuredClone(sample), notice: 'Đang dùng hồ sơ minh họa. Thay thông tin bằng nội dung của bạn.' })}>Dùng nội dung minh họa</button>
      </div>
      {!layoutOcrAvailable && <p className="new-note">OCR cục bộ chỉ xuất hiện khi dịch vụ nhận diện trên máy chủ đã sẵn sàng.</p>}
    </Modal>}
  </div>;
}
