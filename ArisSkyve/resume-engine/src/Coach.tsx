import { useEffect, useMemo, useRef, useState } from 'react';
import type { CanonicalResume } from './schema';
import type { EditorTab } from './Editor';
import { assessResume, proposalForCheck, type CoachProposal } from './coach-rules';
import './coach.css';

type Role = { title: string; postings: number; coverage: number; matched: string[]; missing: string[] };
type Step = { skill: string; stage: number; stage_label: string; related_to: string[]; after: string[]; active_postings: number; opens: number };
type Target = {
  query: string; postings: number; sample_titles: string[];
  skills: { skill: string; share: number; postings: number; have: boolean }[];
  plan: { coverage: { now: number | null; after_stage1: number | null }; steps: Step[]; total_steps: number; soft_skills: string[] };
};
type CoachResult = { status?: string; cv_skills?: string[]; roles?: Role[]; target?: Target; titles_indexed?: boolean; error?: string };
type Props = {
  data: CanonicalResume;
  post: (url: string, body: unknown) => Promise<CoachResult>;
  onEdit: (tab: EditorTab) => void;
  onPropose: (proposal: CoachProposal) => void;
  onClose: () => void;
};

const STAGE_HINT: Record<number, string> = { 1: 'gần với kỹ năng bạn đã có', 2: 'học sau chặng 1', 3: 'mới so với hồ sơ' };
const verdict = (s: number) => s >= 85 ? 'Rất tốt' : s >= 70 ? 'Khá' : s >= 50 ? 'Cần cải thiện' : 'Còn sơ sài';

export function Coach({ data, post, onEdit, onPropose, onClose }: Props) {
  const assessment = useMemo(() => assessResume(data), [data]);
  const [target, setTarget] = useState(data.basics.headline || '');
  const [result, setResult] = useState<CoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const cvNames = new Set(data.skills.flatMap(g => g.items.map(i => i.name.trim().toLowerCase())));

  const analyze = async (query: string) => {
    const id = ++seq.current;
    setLoading(true); setError('');
    try {
      const r = await post('/api/resume-engine/coach', { data, target: query.trim() });
      if (id !== seq.current) return;
      if (r.error) throw new Error(r.error);
      setResult(r);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : 'Trợ lý CV chưa phản hồi.');
    } finally {
      if (id === seq.current) setLoading(false);
    }
  };
  useEffect(() => { setResult(null); const timer = setTimeout(() => void analyze(target), 400); return () => { clearTimeout(timer); seq.current++; }; }, [data]); // lần đầu mở: phân tích theo chức danh trong CV

  const ring = 2 * Math.PI * 30;
  const t = result?.target;
  const byStage = (n: number) => (t?.plan.steps || []).filter(s => s.stage === n);

  return <aside className="coach-panel interactive-only" aria-label="Trợ lý CV">
    <header className="coach-head">
      <div><small>ARIS AI</small><h2>Trợ lý CV</h2></div>
      <button onClick={onClose} aria-label="Đóng trợ lý">×</button>
    </header>

    {data.importedLayout ? <p className="coach-muted">Đang phân tích chữ trên bản PDF đã chỉnh sửa. Điểm theo các mục của mẫu CV không áp dụng cho bố cục gốc.</p> : <><section className="coach-card">
      <div className="coach-score">
        <svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="30" className="track"/><circle cx="36" cy="36" r="30" className="fill" data-tier={assessment.score >= 70 ? 'good' : assessment.score >= 50 ? 'mid' : 'low'} strokeDasharray={ring} strokeDashoffset={ring * (1 - assessment.score / 100)}/></svg>
        <div><b>{assessment.score}</b><span>/100</span></div>
      </div>
      <div className="coach-score-text">
        <strong>Chất lượng trình bày: {verdict(assessment.score)}</strong>
        <p>Chấm theo cách nhà tuyển dụng đọc CV: rõ vị trí, có kết quả bằng số, đủ kỹ năng và liên hệ. Sửa từ mục đỏ trước.</p>
      </div>
    </section>
    <ol className="coach-checks">
      {assessment.checks.map(c => {
        const proposal = proposalForCheck(data, c);
        return <li key={c.id} data-status={c.status}>
        <span className="coach-dot" aria-hidden="true">{c.status === 'ok' ? '✓' : c.status === 'warn' ? '!' : '×'}</span>
        <div><strong>{c.label}</strong><p>{c.detail}</p></div>
        {c.status !== 'ok' && (proposal
          ? <button onClick={() => onPropose(proposal)}>Xem đề xuất</button>
          : <button onClick={() => onEdit(c.tab)}>Mở mục sửa</button>)}
      </li>;
      })}
    </ol></>}

    <section className="coach-section">
      <h3>Bạn muốn ứng tuyển vị trí nào?</h3>
      <form className="coach-target" onSubmit={e => { e.preventDefault(); void analyze(target); }}>
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder="vd: Data Analyst, Kế toán, Backend .NET" aria-label="Vị trí muốn ứng tuyển"/>
        <button type="submit" disabled={loading}>{loading ? '…' : 'Phân tích'}</button>
      </form>
      {error && <p className="coach-error" role="alert">{error}</p>}
      {loading && !result && <p className="coach-muted">Đang đối chiếu CV với kho tin đã lập chỉ mục…</p>}
      {t && (t.postings === 0
        ? <p className="coach-muted">Chưa có bản ghi phù hợp trong kho tin đã lập chỉ mục cho "{t.query}". Thử tên ngắn hơn, vd "kế toán", "backend", "marketing".</p>
        : <div className="coach-target-result">
          <p className="coach-muted">Dựa trên <b>{t.postings}</b> bản ghi trong kho tin đã lập chỉ mục cho "{t.query}"{t.sample_titles.length ? ` (vd: ${t.sample_titles.slice(0, 2).join(', ')})` : ''}.</p>
          <p className="coach-evidence-note"><b>Phạm vi tham khảo:</b> kho tin dùng để nhận diện chủ đề thường xuất hiện, không xác nhận tin còn mở và không chứng minh bạn đã có một kỹ năng.</p>
          {t.plan.coverage.now != null && <div className="coach-cov">
            <div><span>Độ phủ tham khảo: <b>{t.plan.coverage.now}%</b> so với kỹ năng trong kho tin</span>{(t.plan.coverage.after_stage1 ?? 0) > (t.plan.coverage.now ?? 0) && <span className="gain">→ {t.plan.coverage.after_stage1}% nếu hoàn thành chặng 1</span>}</div>
            <i><b style={{ width: `${t.plan.coverage.after_stage1 ?? 0}%` }} className="next"/><b style={{ width: `${t.plan.coverage.now}%` }}/></i>
          </div>}
          <div className="coach-chips">
            {t.skills.map(s => {
              const inCv = cvNames.has(s.skill.trim().toLowerCase());
              return <span key={s.skill} className={inCv ? 'have' : 'miss'} title={`${Math.round(s.share * 100)}% bản ghi trong kho tin có nhắc đến`}>
                {inCv ? '✓ ' : ''}{s.skill}<small>{Math.round(s.share * 100)}%</small>
                {!inCv && <small className="coach-skill-status">cần xác thực</small>}
              </span>;
            })}
          </div>
          <p className="coach-note">Các kỹ năng màu vàng là hướng học hoặc mục cần xác thực, không phải đề nghị thêm vào CV. Aris không tự thêm kỹ năng từ nhu cầu thị trường; chỉ tự sửa sau khi bạn xác minh bằng kinh nghiệm hoặc dự án của mình.</p>
          {t.plan.steps.length > 0 && <div className="coach-plan">
            <h4>Nên học thêm để đạt vị trí này</h4>
            {[1, 2, 3].map(n => byStage(n).length > 0 && <div key={n} className="coach-stage" data-stage={n}>
              <div className="coach-stage-head"><span>{n}</span><b>{byStage(n)[0].stage_label}</b><small>{STAGE_HINT[n]}</small></div>
              <ul>{byStage(n).map(s => <li key={s.skill}><b>{s.skill}</b><small>{[s.related_to.length ? `dựa trên ${s.related_to.join(', ')}` : '', s.after.length ? `sau ${s.after.join(', ')}` : '', s.active_postings ? `${s.active_postings} bản ghi tham khảo` : ''].filter(Boolean).join(' · ')}</small></li>)}</ul>
            </div>)}
          </div>}
        </div>)}
    </section>

    {result?.roles && result.roles.length > 0 && <section className="coach-section">
      <h3>Hướng nghề hợp với CV của bạn</h3>
      <p className="coach-muted">Xếp theo độ phủ kỹ năng trong kho tin đã lập chỉ mục. Bấm để xem dữ kiện tham khảo cho vị trí đó.</p>
      <div className="coach-roles">
        {result.roles.map(r => <button key={r.title} onClick={() => { setTarget(r.title); void analyze(r.title); }}>
          <span className="coach-role-top"><b>{r.title}</b><em>{r.coverage}%</em></span>
          <small>{r.postings} bản ghi · khớp {r.matched.slice(0, 3).join(', ')}{r.missing.length ? ` · cần xác thực/học ${r.missing.slice(0, 2).join(', ')}` : ''}</small>
        </button>)}
      </div>
    </section>}
    {result && result.titles_indexed === false && <p className="coach-muted">Gợi ý hướng nghề cần đồ thị kỹ năng mới (dựng lại ở dashboard AiCore).</p>}

    <footer className="coach-foot">Sau khi bạn <b>Lưu CV</b>, Aris cập nhật nội dung cho AI: điểm phù hợp với từng tin đổi ngay, gợi ý việc làm cập nhật sau khoảng 1 phút.</footer>
  </aside>;
}
