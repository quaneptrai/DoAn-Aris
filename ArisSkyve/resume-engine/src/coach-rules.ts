import { CanonicalResumeSchema, type CanonicalResume } from './schema';
import type { EditorTab } from './Editor';

// Chấm chất lượng trình bày CV ngay trên trình duyệt (không gọi AI): mỗi tiêu chí có trọng số,
// trạng thái và một câu hướng dẫn cụ thể + mục cần mở để sửa. Đây là "CV viết tốt chưa"; còn
// "CV khớp vị trí nào, thiếu kỹ năng gì" do AiCore trả về trong Coach.tsx.
export type CheckStatus = 'ok' | 'warn' | 'fail';
export type Check = { id: string; label: string; status: CheckStatus; detail: string; tab: EditorTab; weight: number; earned: number };
export type Assessment = { score: number; checks: Check[] };
// Proposals are small, reviewable patches rather than opaque replacements of a
// resume. `changes` is the complete allow-list of fields they may touch.
export type ProposalChange = { path: string; label: string; before: string; after: string };
export type ProposalEvidence = { path: string; label: string; value: string };
export type CoachProposal = {
  id: string;
  title: string;
  detail: string;
  tab: EditorTab;
  before: string;
  after: string;
  candidate: CanonicalResume;
  changes: ProposalChange[];
  evidence: ProposalEvidence[];
  verificationNote: string;
};

const ACTION_VERBS = [
  'xây dựng', 'phát triển', 'thiết kế', 'tối ưu', 'triển khai', 'quản lý', 'dẫn dắt', 'điều phối', 'giảm', 'tăng',
  'cải thiện', 'tự động', 'nghiên cứu', 'phân tích', 'tích hợp', 'đề xuất', 'hướng dẫn', 'đào tạo', 'chịu trách nhiệm',
  'lập', 'thực hiện', 'viết', 'vận hành', 'đạt', 'hoàn thành', 'tổ chức', 'đàm phán', 'mở rộng', 'chuyển đổi', 'xử lý',
  'built', 'developed', 'designed', 'led', 'improved', 'reduced', 'increased', 'implemented', 'created', 'launched',
  'managed', 'optimized', 'automated', 'delivered', 'migrated', 'integrated', 'analyzed', 'owned', 'shipped', 'mentored',
];
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const hasNumber = (text: string) => /\d/.test(text);
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
const containsSkill = (text: string, skill: string) => normalize(text).includes(normalize(skill));
const equalJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function textAtPath(source: CanonicalResume, path: string): string | null {
  // Proposal paths are read-only and generated locally. Refuse prototype-ish
  // paths so a malformed response cannot make this resolver walk them.
  if (!path || /(?:__proto__|constructor|prototype)/.test(path)) return null;
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: unknown = source;
  for (const key of keys) {
    if (current === null || typeof current !== 'object' || !(key in current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' || typeof current === 'number' ? String(current) : null;
}

function currentEvidence(source: CanonicalResume, evidence: ProposalEvidence): boolean {
  // Target-job data is useful context, but is never proof that the candidate
  // has a skill. CV evidence is checked against the live working copy.
  if (evidence.path.startsWith('target.')) return evidence.value.trim().length > 0;
  const current = textAtPath(source, evidence.path);
  const cited = normalize(evidence.value).replace(/…/g, '').trim();
  return Boolean(current && cited && normalize(current).includes(cited));
}

function excerpt(text: string, skill?: string): string {
  const clean = text.trim();
  if (clean.length <= 180) return clean;
  const index = skill ? normalize(clean).indexOf(normalize(skill)) : -1;
  if (index < 0) return `${clean.slice(0, 177).trimEnd()}…`;
  const start = Math.max(0, index - 55);
  const end = Math.min(clean.length, index + Math.max(skill!.length, 16) + 105);
  return `${start ? '…' : ''}${clean.slice(start, end).trim()}${end < clean.length ? '…' : ''}`;
}

/**
 * Find explicit, candidate-authored evidence that a skill belongs in the list.
 * A target job saying it is desirable is intentionally not enough evidence.
 */
export function findSkillEvidence(source: CanonicalResume, skill: string): ProposalEvidence[] {
  const clean = skill.trim();
  if (!clean) return [];
  const found: ProposalEvidence[] = [];
  const add = (path: string, label: string, value: string) => {
    if (found.length >= 3 || !containsSkill(value, clean)) return;
    found.push({ path, label, value: excerpt(value, clean) });
  };
  source.work.forEach((work, workIndex) => {
    const context = work.role || work.company || `Kinh nghiệm ${workIndex + 1}`;
    work.techStack.forEach((value, stackIndex) => add(`work[${workIndex}].techStack[${stackIndex}]`, `${context} · công nghệ`, value));
    work.highlights.forEach((value, highlightIndex) => add(`work[${workIndex}].highlights[${highlightIndex}]`, `${context} · mô tả`, value));
    work.metrics?.forEach((metric, metricIndex) => add(`work[${workIndex}].metrics[${metricIndex}].label`, `${context} · chỉ số`, metric.label));
  });
  source.projects.forEach((project, projectIndex) => {
    const context = project.title || `Dự án ${projectIndex + 1}`;
    project.stack.forEach((value, stackIndex) => add(`projects[${projectIndex}].stack[${stackIndex}]`, `${context} · công nghệ`, value));
    add(`projects[${projectIndex}].tagline`, `${context} · mô tả ngắn`, project.tagline);
    add(`projects[${projectIndex}].description`, `${context} · mô tả`, project.description);
  });
  add('basics.summary', 'Giới thiệu hiện có', source.basics.summary);
  return found;
}

function summaryFacts(source: CanonicalResume): ProposalEvidence[] {
  const facts: ProposalEvidence[] = [];
  const add = (path: string, label: string, value: string) => {
    if (value.trim()) facts.push({ path, label, value: excerpt(value) });
  };
  if (source.basics.summary.trim()) add('basics.summary', 'Giới thiệu hiện có', source.basics.summary);
  add('basics.headline', 'Chức danh trong CV', source.basics.headline);
  const recent = source.work[0];
  if (recent?.role) add('work[0].role', 'Vị trí gần nhất', recent.role);
  if (recent?.company) add('work[0].company', 'Công ty gần nhất', recent.company);
  source.skills.flatMap((group, groupIndex) => group.items.map((item, itemIndex) => ({ item, groupIndex, itemIndex }))).slice(0, 4)
    .forEach(({ item, groupIndex, itemIndex }) => add(`skills[${groupIndex}].items[${itemIndex}].name`, 'Kỹ năng đã liệt kê', item.name));
  return facts;
}

function summaryDraft(source: CanonicalResume): { after: string; evidence: ProposalEvidence[] } | null {
  const before = source.basics.summary.trim();
  const headline = source.basics.headline.trim();
  const skills = listedSkills(source).slice(0, 4);
  const recent = source.work[0];
  const factCount = Number(Boolean(headline)) + Number(Boolean(recent?.role || recent?.company)) + Number(skills.length > 0);
  // A draft needs more than one fact; otherwise the result is generic.
  if (!headline || skills.length === 0 || factCount < 2) return null;
  const sentences = before ? [/[.!?]$/.test(before) ? before : `${before}.`] : [headline];
  const recentLabel = [recent?.role, recent?.company].filter(Boolean).join(' tại ');
  if (recentLabel) sentences.push(`Kinh nghiệm gần nhất: ${recentLabel}.`);
  sentences.push(`Kỹ năng đã liệt kê: ${skills.join(', ')}.`);
  return { after: sentences.join(' '), evidence: summaryFacts(source) };
}
const startsWithAction = (text: string) => { const t = text.trim().toLowerCase().replace(/^[-*•\s]+/, ''); return ACTION_VERBS.some(v => t.startsWith(v)); };

function check(id: string, label: string, tab: EditorTab, weight: number, ratio: number, detail: string, warnAt = 0.5): Check {
  const r = Math.max(0, Math.min(1, ratio));
  return { id, label, tab, weight, earned: Math.round(weight * r * 10) / 10, status: r >= 0.999 ? 'ok' : r >= warnAt ? 'warn' : 'fail', detail };
}

export function assessResume(d: CanonicalResume): Assessment {
  const checks: Check[] = [];
  const b = d.basics;
  const highlights = d.work.flatMap(w => w.highlights.filter(h => h.trim()));
  const skillCount = d.skills.reduce((n, g) => n + g.items.filter(i => i.name.trim()).length, 0);

  const headline = b.headline.trim();
  checks.push(check('headline', 'Chức danh mục tiêu', 'profile', 8, headline ? (headline.length <= 70 ? 1 : 0.6) : 0,
    !headline ? 'Ghi rõ vị trí bạn nhắm tới, vd "Backend Developer (.NET)" — nhà tuyển dụng đọc dòng này đầu tiên.'
      : headline.length > 70 ? 'Rút gọn chức danh dưới 70 ký tự; phần còn lại đưa vào tóm tắt.' : 'Chức danh rõ ràng.'));

  const contactParts = [/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email) && !b.email.endsWith('@example.com'), Boolean(b.phone.trim()), Boolean(b.location.city.trim())];
  const contactRatio = contactParts.filter(Boolean).length / 3;
  checks.push(check('contact', 'Thông tin liên hệ', 'profile', 8, contactRatio,
    contactRatio === 1 ? 'Đủ email, điện thoại, nơi ở.' : `Bổ sung ${[!contactParts[0] && 'email thật', !contactParts[1] && 'số điện thoại', !contactParts[2] && 'thành phố'].filter(Boolean).join(', ')}.`));

  const sw = words(b.summary);
  checks.push(check('summary', 'Đoạn giới thiệu', 'profile', 12, sw === 0 ? 0 : sw < 25 ? 0.5 : sw <= 120 ? 1 : 0.7,
    sw === 0 ? 'Viết 2–4 câu: bạn làm gì, giỏi nhất ở đâu, đang tìm vị trí nào.'
      : sw < 25 ? `Đoạn giới thiệu mới ${sw} từ — thêm 1–2 câu về thế mạnh và kết quả nổi bật.`
        : sw > 120 ? `Đoạn giới thiệu ${sw} từ — rút còn dưới 120 từ để người đọc nắm nhanh.` : 'Độ dài phù hợp.'));

  const entries = d.work.length + d.projects.length;
  checks.push(check('experience', 'Kinh nghiệm hoặc dự án', d.work.length ? 'work' : 'projects', 12, entries >= 2 ? 1 : entries === 1 ? 0.6 : 0,
    entries === 0 ? 'Thêm ít nhất một công việc, thực tập hoặc dự án (đồ án, dự án cá nhân đều được).'
      : entries === 1 ? 'Thêm một dự án hoặc kinh nghiệm nữa để CV có chiều sâu.' : `${d.work.length} kinh nghiệm, ${d.projects.length} dự án.`));

  if (d.work.length) {
    const thin = d.work.filter(w => w.highlights.filter(h => h.trim()).length < 2);
    checks.push(check('bullets', 'Mô tả công việc', 'work', 12, 1 - thin.length / d.work.length,
      thin.length ? `Mỗi vị trí nên có 2–5 gạch đầu dòng. Còn thiếu ở: ${thin.map(w => w.role || w.company || 'chưa đặt tên').slice(0, 3).join(', ')}.` : 'Mỗi vị trí đều có mô tả.'));
  }

  if (highlights.length) {
    const metricsAttached = d.work.some(w => w.metrics?.length);
    const ratio = highlights.filter(hasNumber).length / highlights.length;
    checks.push(check('metrics', 'Kết quả có con số', 'work', 14, metricsAttached ? Math.max(ratio / 0.4, 0.7) : ratio / 0.4,
      ratio >= 0.4 || metricsAttached ? 'Nhiều dòng đã có số liệu cụ thể.'
        : 'Thêm con số vào thành tích: "giảm 30% thời gian truy vấn", "phục vụ 5.000 người dùng", "hoàn thành trước hạn 2 tuần".'));
    const verbRatio = highlights.filter(startsWithAction).length / highlights.length;
    checks.push(check('verbs', 'Mở đầu bằng động từ hành động', 'work', 6, verbRatio / 0.6,
      verbRatio >= 0.6 ? 'Các dòng mô tả bắt đầu bằng hành động.' : 'Bắt đầu mỗi dòng bằng động từ: "Xây dựng…", "Tối ưu…", "Dẫn dắt…" thay vì "Có nhiệm vụ…".'));
  }

  checks.push(check('skills', 'Kỹ năng', 'skills', 10, skillCount >= 6 ? (d.skills.length >= 2 || skillCount < 10 ? 1 : 0.85) : skillCount / 6,
    skillCount < 6 ? `Mới có ${skillCount} kỹ năng — liệt kê 6–15 kỹ năng bạn thật sự dùng được.`
      : d.skills.length < 2 && skillCount >= 10 ? 'Chia kỹ năng thành nhóm (Ngôn ngữ, Framework, Công cụ…) cho dễ đọc.' : `${skillCount} kỹ năng.`));

  if (d.projects.length) {
    const linked = d.projects.filter(p => p.liveUrl || p.repoUrl).length;
    checks.push(check('project-links', 'Liên kết dự án', 'projects', 6, linked / d.projects.length,
      linked === d.projects.length ? 'Dự án đều có liên kết.' : 'Gắn link GitHub hoặc bản chạy thử cho dự án — người tuyển dụng hay bấm vào xem.'));
  }

  checks.push(check('links', 'GitHub / LinkedIn / Portfolio', 'profile', 6, b.links.length ? 1 : 0,
    b.links.length ? 'Đã có liên kết cá nhân.' : 'Thêm LinkedIn hoặc GitHub để nhà tuyển dụng xem thêm.'));
  checks.push(check('education', 'Học vấn', 'education', 6, d.education.length ? 1 : 0,
    d.education.length ? 'Đã có học vấn.' : 'Thêm trường, ngành và năm tốt nghiệp (dự kiến).'));

  const total = checks.reduce((n, c) => n + c.weight, 0);
  const earned = checks.reduce((n, c) => n + c.earned, 0);
  const order: Record<CheckStatus, number> = { fail: 0, warn: 1, ok: 2 };
  checks.sort((a, c) => order[a.status] - order[c.status] || c.weight - a.weight);
  return { score: Math.round((earned / total) * 100), checks };
}

export function addSkill(d: CanonicalResume, name: string): CanonicalResume {
  const next = structuredClone(d);
  const clean = name.trim();
  if (!clean || next.skills.some(g => g.items.some(i => i.name.trim().toLowerCase() === clean.toLowerCase()))) return next;
  const group = next.skills.find(g => /kỹ năng|skills?/i.test(g.category)) ?? next.skills[0];
  if (group) group.items.push({ name: clean });
  else next.skills.push({ category: 'Kỹ năng', items: [{ name: clean }] });
  return next;
}

const listedSkills = (d: CanonicalResume) => [...new Set(d.skills.flatMap(group => group.items.map(item => item.name.trim()).filter(Boolean)))];

export function proposalForCheck(d: CanonicalResume, item: Check): CoachProposal | null {
  if (item.id !== 'summary') return null;
  const before = d.basics.summary.trim();
  if (words(before) >= 25) return null;
  const draft = summaryDraft(d);
  if (!draft || draft.after === before) return null;
  const candidate = structuredClone(d);
  candidate.basics.summary = draft.after;
  return {
    id: 'summary-facts',
    title: 'Bản nháp giới thiệu có dẫn chứng',
    detail: 'Bản nháp chỉ ghép các dữ kiện đang có trong CV. Không thêm thành tích, số liệu, công nghệ hoặc kinh nghiệm mới.',
    tab: 'profile',
    before: before || 'Chưa có đoạn giới thiệu.',
    after: draft.after,
    candidate,
    changes: [{ path: 'basics.summary', label: 'Đoạn giới thiệu', before, after: draft.after }],
    evidence: draft.evidence,
    verificationNote: 'Hãy đối chiếu từng dữ kiện bên dưới. Chỉ áp dụng khi chúng đúng với hồ sơ của bạn; Aris không tự tạo thành tích, số liệu hoặc kỹ năng mới.',
  };
}

// Target-job demand is a learning/verification signal, not proof that the
// candidate possesses a skill. Keep this export as a safe compatibility shim
// for callers that previously asked Coach to add a missing skill directly.
export function proposalToAddSkill(d: CanonicalResume, name: string): CoachProposal | null {
  void d;
  void name;
  return null;
}

/**
 * Defense in depth for the preview/apply boundary. Even a future AI response
 * cannot replace arbitrary parts of a resume: it must be our deterministic,
 * evidence-backed summary draft and declare precisely the field it changes.
 */
export function validateCoachProposal(source: CanonicalResume, proposal: CoachProposal): boolean {
  if (proposal.id !== 'summary-facts' || proposal.tab !== 'profile') return false;
  if (!proposal.title.trim() || !proposal.detail.trim() || !proposal.verificationNote.trim()) return false;
  const parsed = CanonicalResumeSchema.safeParse(proposal.candidate);
  if (!parsed.success) return false;
  const draft = summaryDraft(source);
  if (!draft || proposal.after !== draft.after || parsed.data.basics.summary !== draft.after) return false;
  const expected = structuredClone(source);
  expected.basics.summary = draft.after;
  if (!equalJson(expected, parsed.data)) return false;
  const [change] = proposal.changes;
  if (proposal.changes.length !== 1 || !change || change.path !== 'basics.summary' || change.label !== 'Đoạn giới thiệu') return false;
  if (change.before !== source.basics.summary.trim() || change.after !== draft.after) return false;
  if (proposal.before !== (source.basics.summary.trim() || 'Chưa có đoạn giới thiệu.') || proposal.after !== change.after) return false;
  // At least two current CV facts are displayed, and every cited value still
  // belongs to the current working copy. Target-demand evidence alone cannot
  // validate a proposal.
  const cvEvidence = proposal.evidence.filter(evidence => !evidence.path.startsWith('target.'));
  return cvEvidence.length >= 2 && proposal.evidence.every(evidence => currentEvidence(source, evidence));
}
