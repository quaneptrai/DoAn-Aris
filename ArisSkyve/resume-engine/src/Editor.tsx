import { useEffect, useRef, useState } from 'react';
import { CanonicalResumeSchema, type CanonicalResume } from './schema';
import './editor-fixes.css';

export type EditorTab = 'profile' | 'work' | 'projects' | 'skills' | 'education' | 'custom' | 'json';
type Props = { value: CanonicalResume; onSave: (candidate: unknown) => boolean; onClose: () => void; documentKey?: string; initialTab?: EditorTab };
type Collection = 'work' | 'projects' | 'skills' | 'education' | 'customSections';
const tabs: { id: EditorTab; label: string }[] = [{ id: 'profile', label: 'Thông tin' }, { id: 'work', label: 'Kinh nghiệm' }, { id: 'projects', label: 'Dự án' }, { id: 'skills', label: 'Kỹ năng' }, { id: 'education', label: 'Học vấn' }, { id: 'custom', label: 'Mục khác' }, { id: 'json', label: 'JSON' }];
const trimList = (items: string[]) => items.map(item => item.trim()).filter(Boolean);
const optional = (value: string | undefined) => value?.trim() || undefined;

export function normalizeEditorDraft(source: CanonicalResume): CanonicalResume {
  const d = structuredClone(source);
  d.basics.name = d.basics.name.trim(); d.basics.headline = d.basics.headline.trim();
  d.basics.email = d.basics.email.trim(); d.basics.phone = d.basics.phone.trim();
  d.basics.avatarUrl = optional(d.basics.avatarUrl);
  d.basics.location.city = d.basics.location.city.trim(); d.basics.location.country = d.basics.location.country.trim();
  d.basics.links = d.basics.links.filter(link => link.label.trim() || link.url.trim()).map(link => ({ ...link, label: link.label.trim(), url: link.url.trim() }));
  d.work = d.work.map(job => ({ ...job, company: job.company.trim(), role: job.role.trim(), startDate: job.startDate.trim(), endDate: job.isCurrent ? null : job.endDate?.trim() || '', highlights: trimList(job.highlights), techStack: trimList(job.techStack), metrics: job.metrics?.filter(metric => metric.label.trim() || metric.value.trim()).map(metric => ({ label: metric.label.trim(), value: metric.value.trim() })) }));
  d.projects = d.projects.map(project => ({ ...project, title: project.title.trim(), tagline: project.tagline.trim(), liveUrl: optional(project.liveUrl), repoUrl: optional(project.repoUrl), stack: trimList(project.stack), media: project.media ? trimList(project.media) : undefined }));
  d.skills = d.skills.map(group => ({ ...group, category: group.category.trim(), items: group.items.filter(item => item.name.trim()).map(item => ({ ...item, name: item.name.trim() })) }));
  d.education = d.education.map(item => ({ ...item, institution: item.institution.trim(), degree: item.degree.trim(), field: item.field.trim(), startDate: item.startDate.trim(), endDate: item.endDate.trim(), gpa: optional(item.gpa), honors: item.honors ? trimList(item.honors) : undefined }));
  d.customSections = d.customSections?.map(section => ({ ...section, heading: section.heading.trim(), content: section.type === 'badge-grid' && Array.isArray(section.content) && section.content.every(item => typeof item === 'string') ? trimList(section.content) : section.content }));
  return d;
}

function MarkdownField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  const field = useRef<HTMLTextAreaElement>(null);
  const apply = (kind: 'bold' | 'italic' | 'list') => {
    const node = field.current;
    if (!node) return;
    let start = node.selectionStart, end = node.selectionEnd;
    if (kind === 'list') { start = value.lastIndexOf('\n', start - 1) + 1; const lineEnd = value.indexOf('\n', end); end = lineEnd === -1 ? value.length : lineEnd; }
    const selection = value.slice(start, end);
    const delimiter = kind === 'bold' ? '**' : '*';
    const replacement = kind === 'list' ? (selection || 'Nội dung').split('\n').map(line => /^\s*[-*+]\s/.test(line) ? line : `- ${line}`).join('\n') : `${delimiter}${selection || 'Nội dung'}${delimiter}`;
    onChange(value.slice(0, start) + replacement + value.slice(end));
    requestAnimationFrame(() => { node.focus(); node.setSelectionRange(start + (kind === 'list' ? 2 : delimiter.length), start + replacement.length - (kind === 'list' ? 0 : delimiter.length)); });
  };
  return <div className="editor-markdown"><span className="editor-field-label">{label}</span><div className="markdown-toolbar" role="toolbar" aria-label={`Định dạng ${label}`}><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => apply('bold')} aria-label="In đậm"><strong>B</strong></button><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => apply('italic')} aria-label="In nghiêng"><em>I</em></button><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => apply('list')} aria-label="Danh sách gạch đầu dòng">• Danh sách</button><span>Markdown</span></div><textarea ref={field} aria-label={label} value={value} onChange={e => onChange(e.target.value)} /></div>;
}

export function ResumeEditor({ value, onSave, onClose, documentKey, initialTab = 'profile' }: Props) {
  const [draft, setDraft] = useState<CanonicalResume>(() => structuredClone(value));
  const [tab, setTab] = useState<EditorTab>(initialTab);
  const [raw, setRaw] = useState(JSON.stringify(value, null, 2));
  const [customRaw, setCustomRaw] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const documentRef = useRef(documentKey);
  const theme = JSON.stringify(value.meta.theme);
  useEffect(() => {
    if (documentRef.current !== documentKey) {
      documentRef.current = documentKey; setDraft(structuredClone(value)); setRaw(JSON.stringify(value, null, 2)); setCustomRaw({}); setError(''); setStatus(''); setTab(initialTab);
    }
  }, [documentKey, value, initialTab]);
  useEffect(() => {
    const nextTheme = JSON.parse(theme) as CanonicalResume['meta']['theme'];
    setDraft(current => ({ ...current, meta: { ...current.meta, theme: nextTheme } }));
    setRaw(current => { try { const candidate = JSON.parse(current); if (candidate?.meta) { candidate.meta.theme = nextTheme; return JSON.stringify(candidate, null, 2); } } catch { /* Preserve unfinished JSON text. */ } return current; });
  }, [theme]);
  const change = (fn: (next: CanonicalResume) => void) => { setDraft(current => { const next = structuredClone(current); fn(next); return next; }); setStatus(''); setError(''); };
  const input = (label: string, current: string, setter: (next: string) => void, type = 'text', placeholder?: string) => <label>{label}<input type={type} value={current} placeholder={placeholder} onChange={e => setter(e.target.value)} /></label>;
  const textarea = (label: string, current: string, setter: (next: string) => void) => <label>{label}<textarea value={current} onChange={e => setter(e.target.value)} /></label>;
  const materialize = (): CanonicalResume | null => {
    try {
      let candidate: unknown;
      if (tab === 'json') candidate = JSON.parse(raw);
      else {
        const next = structuredClone(draft);
        for (const section of next.customSections || []) if (customRaw[section.id] !== undefined && section.type !== 'rich-text' && section.type !== 'badge-grid') {
          try { section.content = JSON.parse(customRaw[section.id]); } catch { throw new Error(`Mục “${section.heading || 'Chưa đặt tên'}”: nội dung JSON chưa hợp lệ.`); }
        }
        candidate = normalizeEditorDraft(next);
      }
      const parsed = CanonicalResumeSchema.safeParse(candidate);
      if (!parsed.success) { setError(parsed.error.issues.slice(0, 4).map(issue => `${issue.path.join('.')}: ${issue.message}`).join(' · ')); return null; }
      setError(''); return parsed.data;
    } catch (caught) { setError(caught instanceof SyntaxError ? 'JSON chưa hợp lệ. Kiểm tra dấu phẩy, dấu ngoặc và chuỗi văn bản.' : caught instanceof Error ? caught.message : 'Không đọc được dữ liệu.'); return null; }
  };
  const selectTab = (next: EditorTab) => {
    if (next === tab) return;
    if (tab === 'json') { const candidate = materialize(); if (!candidate) return; setDraft(candidate); setCustomRaw({}); }
    if (next === 'json') { const candidate = materialize(); if (!candidate) return; setDraft(candidate); setRaw(JSON.stringify(candidate, null, 2)); }
    setError(''); setTab(next);
  };
  const initialTabRef = useRef(initialTab);
  useEffect(() => { if (initialTabRef.current !== initialTab) { initialTabRef.current = initialTab; selectTab(initialTab); } }, [initialTab]);
  const save = () => {
    const candidate = materialize();
    if (!candidate) return;
    if (!onSave(candidate)) { setError('Chưa lưu được hồ sơ. Hãy kiểm tra thông tin được đánh dấu.'); return; }
    setDraft(candidate); setRaw(JSON.stringify(candidate, null, 2)); setCustomRaw({}); setStatus('Đã lưu hồ sơ.');
  };
  const move = (collection: Collection, index: number, direction: number) => change(next => { const items = next[collection]; if (!items || index + direction < 0 || index + direction >= items.length) return; const removed = items.splice(index, 1)[0]; (items as unknown[]).splice(index + direction, 0, removed); });
  const changeCustomType = (index: number, type: NonNullable<CanonicalResume['customSections']>[number]['type']) => {
    const section = draft.customSections![index];
    let content: unknown = section.content;
    if (customRaw[section.id] !== undefined) { try { content = JSON.parse(customRaw[section.id]); } catch { setError('Nội dung JSON chưa hợp lệ. Hãy sửa trước khi đổi dạng nội dung.'); return; } }
    if (type === 'rich-text') content = typeof content === 'string' ? content : JSON.stringify(content, null, 2) || '';
    else if (type === 'badge-grid') content = typeof content === 'string' ? content.split('\n') : Array.isArray(content) ? content : content && typeof content === 'object' ? Object.entries(content).map(([key, item]) => `${key}: ${String(item)}`) : [];
    else if (type === 'key-value' && (typeof content !== 'object' || content === null || Array.isArray(content))) content = content ? { 'Nội dung': content } : {};
    else if (type === 'timeline' && !Array.isArray(content)) content = content ? [{ description: content }] : [];
    change(d => { d.customSections![index] = { ...d.customSections![index], type, content }; });
    setCustomRaw(current => { const next = { ...current }; delete next[section.id]; return next; });
  };
  const controls = (collection: Collection, index: number, count: number, label: string) => <div className="entry-controls"><button type="button" disabled={index === 0} onClick={() => move(collection, index, -1)} aria-label={`Di chuyển ${label} ${index + 1} lên`}>↑ Lên</button><button type="button" disabled={index === count - 1} onClick={() => move(collection, index, 1)} aria-label={`Di chuyển ${label} ${index + 1} xuống`}>↓ Xuống</button><button type="button" className="delete-section" onClick={() => change(next => { next[collection]?.splice(index, 1); })}>Xóa {label}</button></div>;

  return <aside className="resume-editor interactive-only" aria-label="Chỉnh sửa CV"><header><div><small>NỘI DUNG HỒ SƠ</small><h2>Chỉnh sửa hồ sơ</h2></div><button type="button" onClick={onClose} aria-label="Đóng">✕</button></header><nav aria-label="Các phần CV">{tabs.map(item => <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => selectTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}>{item.label}</button>)}</nav><div className="editor-fields">{error && <p role="alert" className="editor-error">{error}</p>}
    {tab === 'profile' && <><div className="editor-grid">
      {input('Họ và tên', draft.basics.name, x => change(d => { d.basics.name = x; }))}
      {input('Vị trí / chuyên môn', draft.basics.headline, x => change(d => { d.basics.headline = x; }))}
      {input('Email', draft.basics.email, x => change(d => { d.basics.email = x; }), 'email')}
      {input('Điện thoại', draft.basics.phone, x => change(d => { d.basics.phone = x; }), 'tel')}
      {input('Thành phố', draft.basics.location.city, x => change(d => { d.basics.location.city = x; }))}
      {input('Quốc gia', draft.basics.location.country, x => change(d => { d.basics.location.country = x; }))}
      <MarkdownField label="Giới thiệu bản thân" value={draft.basics.summary} onChange={x => change(d => { d.basics.summary = x; })} />
      <label>Hình thức làm việc<select value={draft.basics.location.remoteStatus} onChange={e => change(d => { d.basics.location.remoteStatus = e.target.value as typeof d.basics.location.remoteStatus; })}><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></label>
      {input('URL ảnh đại diện', draft.basics.avatarUrl || '', x => change(d => { d.basics.avatarUrl = x; }), 'url', 'https://...')}
    </div><div className="editor-section-head"><h3>Liên kết</h3><button type="button" onClick={() => change(d => d.basics.links.push({ platform: 'custom', label: '', url: '' }))}>+ Thêm liên kết</button></div>{draft.basics.links.map((link, i) => <fieldset key={i}><legend>Liên kết {i + 1}</legend><div className="editor-grid"><label>Nền tảng<select value={link.platform} onChange={e => change(d => { d.basics.links[i].platform = e.target.value as typeof link.platform; })}>{['github', 'linkedin', 'x', 'portfolio', 'custom'].map(platform => <option key={platform}>{platform}</option>)}</select></label>{input('Nhãn hiển thị', link.label, x => change(d => { d.basics.links[i].label = x; }))}{input('URL', link.url, x => change(d => { d.basics.links[i].url = x; }), 'url')}</div><button type="button" className="delete-section" onClick={() => change(d => { d.basics.links.splice(i, 1); })}>Xóa liên kết</button></fieldset>)}</>}
    {tab === 'work' && <><div className="editor-section-head"><p>Mô tả kết quả thật và số liệu có thể xác minh.</p><button type="button" onClick={() => change(d => d.work.push({ id: crypto.randomUUID(), company: '', role: '', startDate: '', endDate: null, isCurrent: true, highlights: [], techStack: [] }))}>+ Thêm công việc</button></div>{draft.work.map((job, i) => <fieldset key={job.id}><legend>Công việc {i + 1}</legend><div className="editor-grid">{input('Công ty', job.company, x => change(d => { d.work[i].company = x; }))}{input('Chức danh', job.role, x => change(d => { d.work[i].role = x; }))}{input('Bắt đầu', job.startDate, x => change(d => { d.work[i].startDate = x; }), 'text', 'YYYY-MM hoặc năm')}{input('Kết thúc', job.endDate || '', x => change(d => { d.work[i].endDate = x || null; d.work[i].isCurrent = !x; }), 'text', 'Để trống nếu hiện tại')}<label className="editor-check"><input type="checkbox" checked={job.isCurrent} onChange={e => change(d => { d.work[i].isCurrent = e.target.checked; d.work[i].endDate = e.target.checked ? null : ''; })} /> Đang làm việc tại đây</label>{textarea('Thành tựu · mỗi dòng một ý', job.highlights.join('\n'), x => change(d => { d.work[i].highlights = x.split('\n'); }))}{input('Công nghệ · cách nhau bằng dấu phẩy', job.techStack.join(','), x => change(d => { d.work[i].techStack = x.split(','); }))}</div><div className="editor-section-head"><h4>Số liệu tác động</h4><button type="button" onClick={() => change(d => { (d.work[i].metrics ||= []).push({ label: '', value: '' }); })}>+ Thêm số liệu</button></div>{job.metrics?.map((metric, n) => <div className="editor-metric-row" key={n}>{input('Tên chỉ số', metric.label, x => change(d => { d.work[i].metrics![n].label = x; }))}{input('Kết quả', metric.value, x => change(d => { d.work[i].metrics![n].value = x; }))}<button type="button" aria-label={`Xóa số liệu ${n + 1}`} onClick={() => change(d => { d.work[i].metrics!.splice(n, 1); })}>✕</button></div>)}{controls('work', i, draft.work.length, 'công việc')}</fieldset>)}</>}
    {tab === 'projects' && <><div className="editor-section-head"><p>Thêm dự án, bản demo và hình ảnh.</p><button type="button" onClick={() => change(d => d.projects.push({ id: crypto.randomUUID(), title: '', tagline: '', description: '', featured: false, stack: [] }))}>+ Thêm dự án</button></div>{draft.projects.map((project, i) => <fieldset key={project.id}><legend>Dự án {i + 1}</legend><div className="editor-grid">{input('Tên dự án', project.title, x => change(d => { d.projects[i].title = x; }))}{input('Tagline', project.tagline, x => change(d => { d.projects[i].tagline = x; }))}<MarkdownField label="Mô tả dự án" value={project.description} onChange={x => change(d => { d.projects[i].description = x; })} />{input('Live URL', project.liveUrl || '', x => change(d => { d.projects[i].liveUrl = x; }), 'url')}{input('Repo URL', project.repoUrl || '', x => change(d => { d.projects[i].repoUrl = x; }), 'url')}{input('Công nghệ · dấu phẩy', project.stack.join(','), x => change(d => { d.projects[i].stack = x.split(','); }))}{textarea('URL hình ảnh · mỗi dòng một URL', (project.media || []).join('\n'), x => change(d => { d.projects[i].media = x.split('\n'); }))}<label className="editor-check"><input type="checkbox" checked={project.featured} onChange={e => change(d => { d.projects[i].featured = e.target.checked; })} /> Dự án nổi bật</label></div>{controls('projects', i, draft.projects.length, 'dự án')}</fieldset>)}</>}
    {tab === 'skills' && <><div className="editor-section-head"><p>Đổi tên kỹ năng vẫn giữ cấp độ và số năm kinh nghiệm.</p><button type="button" onClick={() => change(d => d.skills.push({ category: '', items: [] }))}>+ Thêm nhóm</button></div>{draft.skills.map((group, i) => <fieldset key={i}><legend>Nhóm {i + 1}</legend>{input('Tên nhóm', group.category, x => change(d => { d.skills[i].category = x; }))}{group.items.map((item, n) => <div className="editor-skill-row" key={n}>{input('Kỹ năng', item.name, x => change(d => { d.skills[i].items[n].name = x; }))}<label>Cấp độ<select value={item.level || ''} onChange={e => change(d => { d.skills[i].items[n].level = (e.target.value || undefined) as typeof item.level; })}><option value="">Không hiển thị</option><option value="beginner">Beginner</option><option value="competent">Competent</option><option value="expert">Expert</option></select></label><label>Số năm<input type="number" min="0" step="0.5" value={item.yearsOfExperience ?? ''} onChange={e => { const x = e.target.value; change(d => { d.skills[i].items[n].yearsOfExperience = x === '' ? undefined : Number(x); }); }} /></label><button type="button" aria-label={`Xóa kỹ năng ${n + 1}`} onClick={() => change(d => { d.skills[i].items.splice(n, 1); })}>✕</button></div>)}<button type="button" className="editor-add-item" onClick={() => change(d => { d.skills[i].items.push({ name: '' }); })}>+ Thêm kỹ năng</button>{controls('skills', i, draft.skills.length, 'nhóm')}</fieldset>)}</>}
    {tab === 'education' && <><div className="editor-section-head"><p>Thêm học vấn, bằng cấp và thành tích.</p><button type="button" onClick={() => change(d => d.education.push({ institution: '', degree: '', field: '', startDate: '', endDate: '' }))}>+ Thêm học vấn</button></div>{draft.education.map((item, i) => <fieldset key={i}><legend>Học vấn {i + 1}</legend><div className="editor-grid">{input('Trường', item.institution, x => change(d => { d.education[i].institution = x; }))}{input('Bằng cấp', item.degree, x => change(d => { d.education[i].degree = x; }))}{input('Ngành', item.field, x => change(d => { d.education[i].field = x; }))}{input('Bắt đầu', item.startDate, x => change(d => { d.education[i].startDate = x; }), 'text', 'YYYY-MM hoặc năm')}{input('Kết thúc', item.endDate, x => change(d => { d.education[i].endDate = x; }), 'text', 'YYYY-MM, năm hoặc để trống')}{input('GPA', item.gpa || '', x => change(d => { d.education[i].gpa = x; }))}{textarea('Thành tích · mỗi dòng một ý', (item.honors || []).join('\n'), x => change(d => { d.education[i].honors = x.split('\n'); }))}</div>{controls('education', i, draft.education.length, 'học vấn')}</fieldset>)}</>}
    {tab === 'custom' && <><div className="editor-section-head"><p>Chứng chỉ, giải thưởng, ngôn ngữ hoặc mục tùy chọn.</p><button type="button" onClick={() => change(d => { (d.customSections ||= []).push({ id: crypto.randomUUID(), heading: '', type: 'rich-text', content: '' }); })}>+ Thêm mục</button></div>{draft.customSections?.map((section, i) => <fieldset key={section.id}><legend>Mục {i + 1}</legend>{input('Tiêu đề', section.heading, x => change(d => { d.customSections![i].heading = x; }))}<label>Dạng nội dung<select value={section.type} onChange={e => changeCustomType(i, e.target.value as typeof section.type)}><option value="rich-text">Văn bản Markdown</option><option value="badge-grid">Danh sách nhãn</option><option value="key-value">Thuộc tính / Giá trị</option><option value="timeline">Dòng thời gian</option></select></label>{section.type === 'rich-text' ? <MarkdownField label="Nội dung" value={typeof section.content === 'string' ? section.content : (JSON.stringify(section.content, null, 2) || '')} onChange={x => change(d => { d.customSections![i].content = x; })} /> : section.type === 'badge-grid' ? textarea('Mỗi dòng một nhãn', Array.isArray(section.content) ? section.content.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('\n') : String(section.content || ''), x => change(d => { d.customSections![i].content = x.split('\n'); })) : <><p>{section.type === 'key-value' ? 'Đối tượng JSON, ví dụ: {"Ngôn ngữ":"Tiếng Việt", "Trình độ":"Bản ngữ"}' : 'Mảng JSON, ví dụ: [{"date":"2025", "title":"Chứng chỉ", "description":"Nội dung"}]'}</p><textarea aria-label={`Nội dung JSON của ${section.heading || `mục ${i + 1}`}`} className="custom-json" spellCheck={false} value={customRaw[section.id] ?? (JSON.stringify(section.content, null, 2) || '')} onChange={e => { setCustomRaw(current => ({ ...current, [section.id]: e.target.value })); setStatus(''); }} /></>}{controls('customSections', i, draft.customSections!.length, 'mục')}</fieldset>)}</>}
    {tab === 'json' && <><p>Toàn bộ dữ liệu hồ sơ. JSON được kiểm tra trước khi lưu hoặc chuyển sang tab khác.</p><textarea aria-label="Dữ liệu JSON của hồ sơ" className="editor-json" value={raw} onChange={e => { setRaw(e.target.value); setStatus(''); }} spellCheck={false} /></>}
  </div><footer><span className="editor-save-status" role="status">{status}</span><button type="button" onClick={onClose}>Đóng</button><button type="button" onClick={save}>Áp dụng thay đổi</button></footer></aside>;
}
