import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import type { CanonicalResume } from './schema';
import { downloadJsonResume } from './jsonResume';
import './external-gallery.css';

const entrySchema = z.object({
  id: z.string(), name: z.string(), packageName: z.string().nullable().optional(),
  version: z.string().default(''), description: z.string().default(''), category: z.string().default('Community'),
  license: z.string().default('Not declared'), source: z.string(), sourceUrl: z.string(),
  repositoryUrl: z.string().nullable().optional(), homepageUrl: z.string().nullable().optional(),
  previewUrl: z.string().nullable().optional(), officialPreview: z.boolean().default(false),
});
const catalogSchema = z.object({ updatedAt: z.string(), entries: z.array(entrySchema).max(5000) });
type Entry = z.infer<typeof entrySchema>;
type Catalog = z.infer<typeof catalogSchema>;
type Props = { data: CanonicalResume; onClose: () => void };
const PAGE_SIZE = 24;
const number = new Intl.NumberFormat('vi-VN');
const categoryLabels: Record<string, string> = {
  'ATS & Corporate': 'ATS & Doanh nghiệp', Technology: 'Công nghệ', Creative: 'Sáng tạo',
  Academic: 'Học thuật', Student: 'Sinh viên', Community: 'Cộng đồng',
};
const categoryStyles: Record<string, string> = {
  'ATS & Corporate': 'corporate', Technology: 'technology', Creative: 'creative',
  Academic: 'academic', Student: 'student', Community: 'community',
};

/** Treat all catalog metadata as external content, including URLs. */
export function safeExternalUrl(value?: string | null): string | undefined {
  if (!value || /[\u0000-\u0020]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}

function officialPreview(entry: Entry): string | undefined {
  const url = safeExternalUrl(entry.previewUrl);
  return entry.officialPreview && url && new URL(url).hostname === 'registry.jsonresume.org' ? url : undefined;
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

function ExternalLink({ url, children, className }: { url?: string | null; children: React.ReactNode; className?: string }) {
  const href = safeExternalUrl(url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={className}>{children}</a> : null;
}

function TemplateCard({ entry }: { entry: Entry }) {
  const preview = officialPreview(entry);
  const license = entry.license === 'Not declared' ? 'Chưa công bố' : entry.license === 'See source repository' ? 'Xem tại nguồn' : entry.license;
  return <article className={`external-card external-card--${categoryStyles[entry.category] || 'community'}`}>
    <div className="external-card-banner">
      <span className="external-card-mark" aria-hidden="true">{entry.name.slice(0, 2)}</span>
      <span className="external-card-origin">COMMUNITY<br />THEME</span>
      <span className="external-card-category">{categoryLabels[entry.category] || entry.category}</span>
    </div>
    <div className="external-card-body">
      <div className="external-card-status"><span className="external-availability">Dùng ở nguồn ngoài</span>{preview && <span className="external-preview-tag">Có demo</span>}</div>
      <h3>{entry.name}</h3>
      <p className="external-card-description">{entry.description || 'Theme của cộng đồng JSON Resume. Xem chi tiết và hướng dẫn sử dụng tại trang nguồn.'}</p>
      <dl className="external-card-meta"><div><dt>Giấy phép</dt><dd title={license}>{license}</dd></div><div><dt>Phiên bản</dt><dd>{entry.version || 'Xem tại nguồn'}</dd></div></dl>
      <p className="external-card-source">{entry.source}</p>
      <div className="external-card-actions">
        {preview ? <ExternalLink url={preview} className="external-card-primary">Xem demo <span aria-hidden="true">↗</span></ExternalLink>
          : <ExternalLink url={entry.sourceUrl} className="external-card-primary">Khám phá mẫu <span aria-hidden="true">↗</span></ExternalLink>}
        {preview && <ExternalLink url={entry.sourceUrl}>Nguồn ↗</ExternalLink>}
        <ExternalLink url={entry.repositoryUrl}>Code ↗</ExternalLink>
        {safeExternalUrl(entry.homepageUrl) !== safeExternalUrl(entry.repositoryUrl) && <ExternalLink url={entry.homepageUrl}>Website ↗</ExternalLink>}
      </div>
      {entry.packageName && <code className="external-package" title={entry.packageName}>{entry.packageName}</code>}
    </div>
  </article>;
}

export function ExternalGallery({ data, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const searchId = useId();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [previewOnly, setPreviewOnly] = useState(false);
  const [sort, setSort] = useState('featured');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    fetch('/resume-engine/external-templates.json', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Không tải được thư viện mẫu.');
        return catalogSchema.parse(await response.json());
      })
      .then(value => { setCatalog(value); setPage(1); })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error instanceof z.ZodError ? 'Dữ liệu thư viện chưa hợp lệ. Hãy thử tải lại.' : 'Không tải được thư viện mẫu. Hãy kiểm tra kết nối và thử lại.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const entries = catalog?.entries || [];
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);
  const officialCount = useMemo(() => entries.filter(entry => officialPreview(entry)).length, [catalog]);
  const matches = useMemo(() => {
    const terms = fold(query.trim()).split(/\s+/).filter(Boolean);
    return entries.filter(entry => {
      if (category !== 'all' && entry.category !== category) return false;
      if (previewOnly && !officialPreview(entry)) return false;
      const haystack = fold([entry.name, entry.packageName, entry.description, entry.category, entry.license, categoryLabels[entry.category]].join(' '));
      return terms.every(term => haystack.includes(term));
    }).sort((a, b) => sort === 'featured' ? Number(Boolean(officialPreview(b))) - Number(Boolean(officialPreview(a))) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
  }, [catalog, query, category, previewOnly, sort]);
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const shown = matches.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const date = catalog && !Number.isNaN(Date.parse(catalog.updatedAt)) ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(catalog.updatedAt)) : '';
  const clearFilters = () => { setQuery(''); setCategory('all'); setPreviewOnly(false); setPage(1); };
  const changePage = (value: number) => { setPage(value); results.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); results.current?.focus({ preventScroll: true }); };
  const exportResume = () => {
    try { downloadJsonResume(data); setNotice('Đã tải hồ sơ JSON Resume. Mở hướng dẫn tại trang nguồn của mẫu để sử dụng.'); }
    catch { setNotice('Chưa xuất được hồ sơ. Hãy kiểm tra dữ liệu hoặc thử lại.'); }
  };

  return <dialog ref={dialog} className="external-gallery interactive-only" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="external-gallery-shell">
      <header className="external-gallery-top"><span><b className="external-brand-mark">A</b> aris <span className="external-top-divider">/</span> template library</span><button type="button" className="external-close" onClick={onClose} aria-label="Đóng thư viện mẫu"><span aria-hidden="true">×</span></button></header>
      <section className="external-gallery-hero">
        <div><span className="external-eyebrow">BEYOND THE BUILDER</span><h2 id={titleId}>Tìm một mẫu.<br /><em>Kể câu chuyện của bạn.</em></h2><p id={descriptionId}>Khám phá mẫu cộng đồng từ JSON Resume và npm. Mẫu trong thư viện này được sử dụng tại nguồn ngoài; mỗi nguồn có hướng dẫn và giấy phép riêng.</p><div className="external-hero-actions"><button type="button" className="external-export" onClick={exportResume}>Tải hồ sơ JSON Resume <span aria-hidden="true">↓</span></button><ExternalLink url="https://www.jsonresume.org/getting-started">Hướng dẫn sử dụng ↗</ExternalLink></div></div>
        <div className="external-gallery-numbers" aria-label="Quy mô thư viện"><div><strong>{loading ? '—' : number.format(entries.length)}</strong><span>mẫu từ cộng đồng</span></div><div><strong>{loading ? '—' : number.format(officialCount)}</strong><span>demo được JSON Resume liệt kê</span></div><p>Demo dùng hồ sơ mẫu của nguồn.<br />Mở demo không gửi hồ sơ của bạn.</p></div>
      </section>
      <div className="external-gallery-tools">
        <div className="external-search-row"><label className="external-search" htmlFor={searchId}><span aria-hidden="true">⌕</span><input id={searchId} type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm theo tên, phong cách, nghề nghiệp…" aria-label="Tìm mẫu cộng đồng" /></label><label className="external-preview-filter"><input type="checkbox" checked={previewOnly} onChange={event => { setPreviewOnly(event.target.checked); setPage(1); }} /> Có demo chính thức</label><label className="external-sort"><span>Sắp xếp</span><select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="featured">Ưu tiên có demo</option><option value="name">Tên A–Z</option></select></label></div>
        <nav className="external-categories" aria-label="Danh mục mẫu bên ngoài"><button type="button" aria-pressed={category === 'all'} onClick={() => { setCategory('all'); setPage(1); }}>Tất cả <span>{number.format(entries.length)}</span></button>{categoryCounts.map(([name, count]) => <button key={name} type="button" aria-pressed={category === name} onClick={() => { setCategory(name); setPage(1); }}>{categoryLabels[name] || name} <span>{number.format(count)}</span></button>)}</nav>
      </div>
      <div className="external-gallery-results" ref={results} tabIndex={-1}>
        <div className="external-results-heading"><p role="status" aria-live="polite">{loading ? 'Đang tải thư viện…' : `${number.format(matches.length)} mẫu${query ? ` cho “${query}”` : ''}`}</p><span>{date ? `Cập nhật ${date}` : 'Danh mục từ nguồn công khai'}</span></div>
        {loadError ? <div className="external-empty" role="alert"><span aria-hidden="true">↻</span><h3>Thư viện chưa sẵn sàng</h3><p>{loadError}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Thử tải lại</button></div>
          : loading ? <div className="external-loading" aria-busy="true"><span className="external-loading-orbit" aria-hidden="true" /><p>Đang chuẩn bị thư viện của bạn</p></div>
          : shown.length ? <div className="external-template-grid">{shown.map(entry => <TemplateCard entry={entry} key={entry.id} />)}</div>
          : <div className="external-empty"><span aria-hidden="true">⌕</span><h3>Chưa có mẫu khớp bộ lọc</h3><p>Thử từ khóa ngắn hơn hoặc khám phá toàn bộ thư viện.</p><button type="button" onClick={clearFilters}>Xóa bộ lọc</button></div>}
        {!loading && !loadError && matches.length > PAGE_SIZE && <nav className="external-pagination" aria-label="Phân trang thư viện"><button type="button" disabled={activePage === 1} onClick={() => changePage(activePage - 1)}>← Trang trước</button><span>Trang <b>{activePage}</b> / {pageCount}</span><button type="button" disabled={activePage === pageCount} onClick={() => changePage(activePage + 1)}>Trang sau →</button></nav>}
      </div>
      <footer className="external-gallery-footer"><div><strong>Mang hồ sơ đến mẫu bạn chọn.</strong><p>Tệp JSON Resume giữ toàn bộ bản gốc Aris; cách hiển thị các mục tùy thuộc từng theme.</p></div><button type="button" onClick={exportResume}>Tải hồ sơ .json ↓</button></footer>
      {notice && <div className="external-export-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Đóng thông báo">×</button></div>}
    </div>
  </dialog>;
}
