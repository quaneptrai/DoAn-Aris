import { useEffect, useMemo, useRef, useState } from 'react';
import { CanonicalResumeSchema, type CanonicalResume, type RenderMode, type TemplateId } from './schema';
import { formatResumeDate as date, Markdown, plainText as plain, SafeLink, safeWebUrl } from './content';
import { createAdditionalTemplates } from './additional';
import { FONT_CATALOG, loadFont } from './fonts';
import './fixes.css';

type Props = { data: CanonicalResume; templateId: TemplateId | string; mode: RenderMode };
type TemplateProps = { data: CanonicalResume; mode: RenderMode; skill: string | null; onSkill: (skill: string) => void; onPreview: (id: string, kind?: 'live' | 'images') => void };
const copyErrorMessage = 'Không sao chép được. Hãy sao chép địa chỉ trên thanh trình duyệt.';

const matches = (stack: string[], skill: string | null) => !skill || stack.some(x => x.toLowerCase() === skill.toLowerCase());
const contact = (data: CanonicalResume) => <><a href={`mailto:${data.basics.email}`}>{data.basics.email}</a>{data.basics.phone && <span>{data.basics.phone}</span>}{[data.basics.location.city, data.basics.location.country].filter(Boolean).length > 0 && <span>{[data.basics.location.city, data.basics.location.country].filter(Boolean).join(', ')}</span>}<span>{data.basics.location.remoteStatus}</span>{data.basics.links.map((l, i) => <SafeLink key={i} url={l.url}>{l.label}<span className="print-url">: {l.url}</span></SafeLink>)}</>;
const skills = (p: TemplateProps) => p.data.skills.map((g, index) => <div className="skill-group" key={index}><h3>{g.category}</h3><div className="skill-list">{g.items.map((item, i) => { const label = <>{item.name}{(item.level || item.yearsOfExperience !== undefined) && <small className="skill-detail">{[item.level, item.yearsOfExperience !== undefined ? `${item.yearsOfExperience} năm` : ''].filter(Boolean).join(' · ')}</small>}</>; return p.mode === 'landing' ? <button type="button" key={i} className={`skill-pill ${p.skill === item.name ? 'is-active' : ''}`} onClick={() => p.onSkill(item.name)} aria-pressed={p.skill === item.name}>{label}</button> : <span className="skill-text" key={i}>{label}</span>; })}</div></div>);
function WorkMetrics({ job }: { job: CanonicalResume['work'][number] }) { return job.metrics?.length ? <dl className="work-metrics">{job.metrics.map((metric, i) => <div key={i}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl> : null; }
const work = (p: TemplateProps) => p.data.work.map(job => <article className="work-item page-break-avoid" key={job.id}><div className="work-top"><div><h3>{job.role}</h3><strong>{job.company}</strong></div><time>{date(job.startDate)} — {date(job.isCurrent ? null : job.endDate)}</time></div><ul>{job.highlights.map((line, i) => <li key={i}>{line}</li>)}</ul><WorkMetrics job={job} /><div className="tags work-stack">{job.techStack.map((x, i) => <span key={i}>{x}</span>)}</div></article>);
const education = (p: TemplateProps) => p.data.education.map((e, i) => <article className="education-item page-break-avoid" key={i}><strong>{e.degree} · {e.field}</strong><span>{e.institution}</span><time>{date(e.startDate)} — {date(e.endDate)}</time>{e.gpa && <small>GPA {e.gpa}</small>}{e.honors?.map(x => <small key={x}>{x}</small>)}</article>);
const project = (p: TemplateProps, variant: string) => p.data.projects.map(item => <article key={item.id} className={`${variant} page-break-avoid ${p.mode === 'landing' && !matches(item.stack, p.skill) ? 'is-dimmed' : ''}`}><div className="project-art" aria-hidden="true">{safeWebUrl(item.media?.[0]) ? <img src={safeWebUrl(item.media?.[0])} alt="" loading="lazy" /> : <span>{item.title.slice(0, 2).toUpperCase()}</span>}</div><div className="project-copy"><div className="project-meta">{item.featured ? 'Featured project' : 'Selected work'}</div><h3>{item.title}</h3><strong>{item.tagline}</strong><Markdown text={item.description} /><div className="tags project-stack">{item.stack.map((x, i) => <span key={i}>{x}</span>)}</div><div className="project-references">{item.liveUrl && <SafeLink url={item.liveUrl}>Demo: {item.liveUrl}</SafeLink>}{item.repoUrl && <SafeLink url={item.repoUrl}>Source: {item.repoUrl}</SafeLink>}</div>{p.mode === 'landing' && <div className="project-actions">{safeWebUrl(item.liveUrl) && <button type="button" onClick={() => p.onPreview(item.id, 'live')}>Live preview ↗</button>}{safeWebUrl(item.repoUrl) && <SafeLink url={item.repoUrl!}>Source ↗</SafeLink>}{item.media?.some(x => safeWebUrl(x)) ? <button type="button" onClick={() => p.onPreview(item.id, 'images')}>View images ↗</button> : null}</div>}</div></article>);

function ContentValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return <ul>{value.map((item, i) => <li key={i}><ContentValue value={item} /></li>)}</ul>;
  if (typeof value === 'object') return <dl>{Object.entries(value).map(([key, item]) => <div key={key}><dt>{key}</dt><dd><ContentValue value={item} /></dd></div>)}</dl>;
  return <Markdown text={String(value)} />;
}

function CustomSections({ data }: { data: CanonicalResume }) {
  return <>{data.customSections?.map(section => <section className="custom-section page-break-avoid" key={section.id}><h2>{section.heading}</h2>{section.type === 'badge-grid' && Array.isArray(section.content) ? <div className="tags">{section.content.map((x: unknown, i: number) => <div className="custom-badge" key={i}><ContentValue value={x} /></div>)}</div> : section.type === 'timeline' && Array.isArray(section.content) ? <ol className="custom-timeline">{section.content.map((item: unknown, i: number) => <li key={i}><ContentValue value={item} /></li>)}</ol> : <ContentValue value={section.content} />}</section>)}</>;
}

function Executive(p: TemplateProps) {
  const d = p.data;
  return <article className="resume executive"><header className="executive-header"><div className="eyebrow">Professional résumé / {d.meta.version}</div><h1>{d.basics.name}</h1><p className="headline">{d.basics.headline}</p><div className="contact-line">{contact(d)}</div></header><main><section className="executive-summary"><h2>Profile</h2><div className="resume-summary"><Markdown text={d.basics.summary} /></div></section><section><h2>Professional experience</h2>{work(p)}</section><section><h2>Selected projects</h2><div className="executive-projects">{project(p, 'executive-project')}</div></section><section><h2>Expertise</h2><div className="executive-skills">{skills(p)}</div></section><section><h2>Education</h2>{education(p)}</section><CustomSections data={d} /></main><footer>© {new Date().getFullYear()} {d.basics.name}</footer></article>;
}

function Bento(p: TemplateProps) {
  const d = p.data;
  return <article className="resume bento"><header className="bento-nav"><span className="brand-mark">{d.basics.name.split(' ').slice(-2).map(x => x[0]).join('')}</span><span>Portfolio / {d.meta.version}</span><a href={`mailto:${d.basics.email}`}>Let's talk ↗</a></header><main className="bento-grid"><section className="bento-hero"><div className="eyebrow">Available for meaningful work <span className="status-dot" /></div><h1>Hi, I'm <em>{d.basics.name}.</em></h1><p>{d.basics.headline}</p><div className="hero-bottom"><span>{d.basics.location.city} · {d.basics.location.remoteStatus}</span><span>↓ Explore work</span></div></section><section className="bento-about"><div className="card-label">01 / About</div><div className="resume-summary"><Markdown text={d.basics.summary} /></div><div className="canonical-contact">{contact(d)}</div></section><section className="bento-metrics"><div className="card-label">At a glance</div><strong>{d.work.length.toString().padStart(2, '0')}</strong><span>roles across my career</span><strong>{d.projects.length.toString().padStart(2, '0')}</strong><span>selected projects</span></section><section className="bento-projects"><div className="section-heading"><span>02 / Selected work</span><h2>Things I've built</h2></div><div className="bento-project-grid">{project(p, 'bento-project')}</div></section><section className="bento-experience"><div className="section-heading"><span>03 / Experience</span><h2>Where I've made an impact</h2></div>{work(p)}</section><section className="bento-skills"><div className="card-label">04 / Toolkit · tap to filter projects</div>{skills(p)}</section><section className="bento-education"><div className="card-label">05 / Education</div>{education(p)}</section><CustomSections data={d} /></main><footer className="bento-footer"><span>{d.basics.name} / {new Date().getFullYear()}</span><a href={`mailto:${d.basics.email}`}>Start a conversation ↗</a></footer></article>;
}

function Terminal(p: TemplateProps) {
  const d = p.data;
  return <article className="resume terminal"><div className="terminal-window"><header className="terminal-bar"><div className="window-dots"><i /><i /><i /></div><span>{d.meta.slug} — portfolio.sh</span><span>⌘</span></header><main className="terminal-body"><div className="terminal-line"><span className="prompt">visitor@{d.meta.slug}:~$</span> cat about.md</div><section className="terminal-intro"><p className="comment"># Hello, world. I'm</p><h1>{d.basics.name}<span className="cursor">_</span></h1><p className="terminal-headline">{d.basics.headline}</p><div className="resume-summary"><Markdown text={d.basics.summary} /></div><div className="terminal-contact">{contact(d)}</div></section><div className="terminal-line"><span className="prompt">visitor@{d.meta.slug}:~$</span> git log --experience</div><section className="terminal-history"><h2>~/experience</h2>{d.work.map((job, i) => <article className="terminal-commit page-break-avoid" key={job.id}><div className="commit-header"><span>commit {String(i + 1).padStart(7, '0')}</span><time>{date(job.startDate)} → {date(job.isCurrent ? null : job.endDate)}</time></div><h3>+ {job.role} <small>@ {job.company}</small></h3>{job.highlights.map((line, j) => <p className="diff-line" key={j}>+ {line}</p>)}<WorkMetrics job={job} /><div className="tags work-stack">{job.techStack.map((x, n) => <span key={n}>{x}</span>)}</div></article>)}</section><div className="terminal-line"><span className="prompt">visitor@{d.meta.slug}:~$</span> ls ./projects</div><section className="terminal-projects"><h2>~/projects</h2>{project(p, 'terminal-project')}</section><div className="terminal-line"><span className="prompt">visitor@{d.meta.slug}:~$</span> cat skills.json</div><section className="terminal-skills"><h2>~/skills</h2>{skills(p)}</section><div className="terminal-line"><span className="prompt">visitor@{d.meta.slug}:~$</span> cat education.txt</div><section className="terminal-education">{education(p)}</section><CustomSections data={d} /><div className="terminal-line end-line"><span className="prompt">visitor@{d.meta.slug}:~$</span><span className="cursor">_</span></div></main></div></article>;
}

function Duo(p: TemplateProps) {
  const d = p.data;
  return <article className="resume duo"><aside className="duo-side"><div className="duo-monogram">{d.basics.name.split(' ').map(x => x[0]).slice(-2).join('')}</div><small>PROFILE / {d.meta.version}</small><h1>{d.basics.name}</h1><p>{d.basics.headline}</p><div className="duo-contact">{contact(d)}</div><section><h2>Expertise</h2>{skills(p)}</section><section><h2>Education</h2>{education(p)}</section></aside><main className="duo-main"><header><span>01 / The story</span><h2>Building better digital experiences.</h2><div className="resume-summary"><Markdown text={d.basics.summary} /></div></header><section><div className="duo-section-title"><span>02</span><h2>Experience</h2></div><div className="duo-timeline">{work(p)}</div></section><section><div className="duo-section-title"><span>03</span><h2>Selected work</h2></div><div className="duo-projects">{project(p, 'duo-project')}</div></section><CustomSections data={d} /></main></article>;
}

function Editorial(p: TemplateProps) {
  const d = p.data;
  return <article className="resume editorial"><header className="editorial-mast"><span>THE PORTFOLIO ISSUE</span><span>{d.basics.location.city} · {new Date().getFullYear()}</span><span>NO. 001</span></header><div className="editorial-hero"><div className="editorial-kicker">Design / Technology / Human experience</div><h1>{d.basics.name}</h1><div className="editorial-sub"><span>{d.basics.headline}</span><span>◢</span></div></div><main className="editorial-columns"><aside><span className="editorial-number">01.</span><h2>In brief</h2><div className="resume-summary"><Markdown text={d.basics.summary} /></div><div className="editorial-contact">{contact(d)}</div><div className="editorial-skill-block"><h2>Tools of the trade</h2>{skills(p)}</div></aside><div className="editorial-content"><section><div className="editorial-section-head"><span>02.</span><h2>A record of work</h2></div>{work(p)}</section><section><div className="editorial-section-head"><span>03.</span><h2>Selected projects</h2></div>{project(p, 'editorial-project')}</section><section><div className="editorial-section-head"><span>04.</span><h2>Education</h2></div>{education(p)}</section><CustomSections data={d} /></div></main><footer>© {d.basics.name} / Made to matter.</footer></article>;
}

function Timeline(p: TemplateProps) {
  const d = p.data;
  return <article className="resume timeline"><header className="timeline-hero"><span className="eyebrow">Career / Journey / Impact</span><h1>{d.basics.name}</h1><p>{d.basics.headline}</p><div className="timeline-contact">{contact(d)}</div></header><main><section className="timeline-overview"><div className="timeline-big-number">{d.work.length.toString().padStart(2, '0')}<small>chapters</small></div><div className="resume-summary"><Markdown text={d.basics.summary} /></div></section><section className="timeline-path"><h2>My journey</h2><div className="timeline-spine">{d.work.map((job, i) => <article className={`timeline-node page-break-avoid ${p.mode === 'landing' && !matches(job.techStack, p.skill) ? 'is-dimmed' : ''}`} key={job.id}><div className="timeline-date">{date(job.startDate)}<span>{date(job.isCurrent ? null : job.endDate)}</span></div><div className="timeline-dot">0{i + 1}</div><div className="timeline-card"><small>{job.company}</small><h3>{job.role}</h3><ul>{job.highlights.map((x, n) => <li key={n}>{x}</li>)}</ul><WorkMetrics job={job} /><div className="tags work-stack">{job.techStack.map((x, n) => <span key={n}>{x}</span>)}</div></div></article>)}</div></section><section className="timeline-work"><h2>Built along the way</h2>{project(p, 'timeline-project')}</section><section className="timeline-toolkit"><h2>Skills & tools</h2>{skills(p)}</section><section className="timeline-school"><h2>Foundations</h2>{education(p)}</section><CustomSections data={d} /></main></article>;
}

function Dense(p: TemplateProps) {
  const d = p.data;
  return <article className="resume dense"><header className="dense-head"><div><small>PROFESSIONAL PROFILE</small><h1>{d.basics.name}</h1><p>{d.basics.headline}</p></div><div>{contact(d)}</div></header><main className="dense-columns"><aside className="dense-left"><section><h2>Profile</h2><div className="resume-summary"><Markdown text={d.basics.summary} /></div></section><section><h2>Core skills</h2>{skills(p)}</section></aside><section className="dense-center"><h2>Career record</h2>{work(p)}</section><aside className="dense-right"><section><h2>Projects</h2>{project(p, 'dense-project')}</section><section><h2>Education</h2>{education(p)}</section><CustomSections data={d} /></aside></main><footer>{d.meta.slug} / {d.meta.version}</footer></article>;
}

function Showcase(p: TemplateProps) {
  const d = p.data;
  const [contactOpen, setContactOpen] = useState(false);
  return <article className="resume showcase"><header className="showcase-nav"><a href="#top" className="showcase-brand">{d.basics.name}<span>●</span></a><nav><a href="#showcase-work">Work</a><a href="#showcase-about">About</a><button type="button" className="showcase-contact-trigger" onClick={() => setContactOpen(true)} aria-haspopup="dialog" aria-expanded={contactOpen} aria-controls="showcase-contact-drawer">Contact</button></nav></header><main id="top"><section className="showcase-hero"><div className="showcase-overline">PORTFOLIO · {new Date().getFullYear()}</div><h1>Ideas into<br /><em>impact.</em></h1><div className="canonical-contact">{contact(d)}</div><div className="showcase-hero-bottom"><p>{d.basics.name}<br /><span>{d.basics.headline}</span></p><a href="#showcase-work">Explore ↓</a></div></section><section id="showcase-work" className="showcase-work"><div className="showcase-section-head"><span>01 / SELECTED WORK</span><h2>Made to be used.<br />Built to last.</h2></div>{project(p, 'showcase-project')}</section><section id="showcase-about" className="showcase-about"><div><small>02 / ABOUT ME</small><h2>Curiosity is my<br />operating system.</h2></div><div><div className="resume-summary"><Markdown text={d.basics.summary} /></div><div className="showcase-skill-groups">{skills(p)}</div></div></section><section className="showcase-career"><small>03 / THE PATH</small><h2>Experience</h2>{work(p)}<h2>Education</h2>{education(p)}</section><CustomSections data={d} /></main><footer><h2>Let's build something good.</h2><a href={`mailto:${d.basics.email}`}>{d.basics.email} ↗</a></footer>{p.mode === 'landing' && contactOpen && <ContactDrawer data={d} onClose={() => setContactOpen(false)} />}</article>;
}

function Academic(p: TemplateProps) {
  const d = p.data;
  return <article className="resume academic"><header><span>CURRICULUM VITAE</span><h1>{d.basics.name}</h1><p>{d.basics.headline}</p><div className="academic-contact">{contact(d)}</div></header><main><aside><h2>Education</h2>{education(p)}<h2>Research areas & skills</h2>{skills(p)}</aside><div><section><h2>Research statement</h2><div className="resume-summary"><Markdown text={d.basics.summary} /></div></section><section><h2>Appointments</h2>{work(p)}</section><section><h2>Selected work</h2>{project(p, 'academic-project')}</section><CustomSections data={d} /></div></main></article>;
}

function Launchpad(p: TemplateProps) {
  const d = p.data;
  return <article className="resume launchpad"><header><span className="launch-badge">OPEN TO OPPORTUNITIES ↗</span><h1>{d.basics.name}<span>.</span></h1><p>{d.basics.headline}</p><div>{contact(d)}</div></header><main><section className="launch-intro"><span>01 / MY STORY</span><div className="resume-summary"><Markdown text={d.basics.summary} /></div></section><section className="launch-stack"><span>02 / WHAT I KNOW</span><div>{skills(p)}</div></section><section className="launch-projects"><span>03 / THINGS I'VE MADE</span><div>{project(p, 'launch-project')}</div></section><section className="launch-background"><div><span>04 / EXPERIENCE</span>{work(p)}</div><div><span>05 / EDUCATION</span>{education(p)}</div></section><CustomSections data={d} /></main></article>;
}

function Casebook(p: TemplateProps) {
  const d = p.data;
  return <article className="resume casebook"><header><div className="casebook-identity"><span>CASEBOOK / {d.meta.version}</span><h1>{d.basics.name}</h1><p>{d.basics.headline}</p></div><div className="casebook-index"><a href="#cases">01 Case studies</a><a href="#career">02 Career</a><a href="#about">03 About</a></div></header><main><section className="casebook-lead" id="about"><small>THE PERSON BEHIND THE WORK</small><div className="resume-summary"><Markdown text={d.basics.summary} /></div><div>{contact(d)}</div></section><section id="cases" className="casebook-cases"><h2>Selected case studies</h2>{project(p, 'casebook-project')}</section><section id="career" className="casebook-career"><div><h2>Experience</h2>{work(p)}</div><aside><h2>Capabilities</h2>{skills(p)}<h2>Education</h2>{education(p)}</aside></section><CustomSections data={d} /></main></article>;
}

function Ledger(p: TemplateProps) {
  const d = p.data;
  return <article className="resume ledger"><header><span>RESUME / {new Date().getFullYear()}</span><h1>{d.basics.name}</h1><div>{d.basics.headline}</div><div className="ledger-contact">{contact(d)}</div></header><main><section className="ledger-intro"><strong>PROFILE</strong><div className="resume-summary"><Markdown text={d.basics.summary} /></div></section><section className="ledger-work"><div className="ledger-heading"><span>PERIOD</span><span>ROLE / ORGANIZATION</span><span>CONTRIBUTION</span></div>{d.work.map(job => <article className="ledger-row page-break-avoid" key={job.id}><time>{date(job.startDate)}<br />{date(job.isCurrent ? null : job.endDate)}</time><div><h3>{job.role}</h3><strong>{job.company}</strong><WorkMetrics job={job} /><div className="tags work-stack">{job.techStack.map((x, n) => <span key={n}>{x}</span>)}</div></div><ul>{job.highlights.map((line, i) => <li key={i}>{line}</li>)}</ul></article>)}</section><section className="ledger-lower"><div><h2>Projects</h2>{project(p, 'ledger-project')}</div><div><h2>Skills</h2>{skills(p)}<h2>Education</h2>{education(p)}</div></section><CustomSections data={d} /></main></article>;
}

function Poster(p: TemplateProps) {
  const d = p.data;
  return <article className="resume poster"><header><div className="poster-side-label">PORTFOLIO / {new Date().getFullYear()}</div><div className="poster-title"><span>THE WORK OF</span><h1>{d.basics.name}</h1><p>{d.basics.headline}</p></div><div className="poster-shape" aria-hidden="true">✳</div></header><main><section className="poster-about"><small>001 — ABOUT</small><div className="resume-summary"><Markdown text={d.basics.summary} /></div><div>{contact(d)}</div></section><section className="poster-work"><small>002 — WORK</small><div>{project(p, 'poster-project')}</div></section><section className="poster-bottom"><div><small>003 — CAREER</small>{work(p)}</div><div><small>004 — TOOLKIT</small>{skills(p)}<small>005 — EDUCATION</small>{education(p)}</div></section><CustomSections data={d} /></main></article>;
}

function Agency(p: TemplateProps) {
  const d = p.data;
  return <article className="resume agency"><header><div><strong>{d.basics.name}</strong><span>Independent portfolio</span></div><a href={`mailto:${d.basics.email}`}>Let's collaborate ↗</a></header><main><section className="agency-hero"><div className="agency-print-name">{d.basics.name}</div><div className="canonical-contact">{contact(d)}</div><small>STRATEGY · DESIGN · TECHNOLOGY</small><h1>{d.basics.headline}</h1><div className="resume-summary"><Markdown text={d.basics.summary} /></div><a href={`mailto:${d.basics.email}`}>Discuss a project ↗</a></section><section className="agency-services"><div><span>01</span><h2>What I bring</h2></div><div>{skills(p)}</div></section><section className="agency-work"><div><span>02</span><h2>Selected partnerships</h2></div>{project(p, 'agency-project')}</section><section className="agency-history"><div><span>03</span><h2>Where I've worked</h2></div><div>{work(p)}<h3>Education</h3>{education(p)}</div></section><CustomSections data={d} /></main><footer><strong>Have something in mind?</strong><a href={`mailto:${d.basics.email}`}>{d.basics.email} ↗</a></footer></article>;
}

function Corporate(p: TemplateProps) {
  const d = p.data;
  return <article className="resume corporate"><header><div className="corporate-accent" /><div className="corporate-head"><div><h1>{d.basics.name}</h1><p>{d.basics.headline}</p></div><div>{contact(d)}</div></div></header><main><section className="corporate-summary"><span>PROFESSIONAL PROFILE</span><div className="resume-summary"><Markdown text={d.basics.summary} /></div></section><div className="corporate-content"><div><section><h2>Experience</h2>{work(p)}</section><section><h2>Projects</h2>{project(p, 'corporate-project')}</section></div><aside><section><h2>Key strengths</h2>{skills(p)}</section><section><h2>Education</h2>{education(p)}</section></aside></div><CustomSections data={d} /></main></article>;
}

function Aurora(p: TemplateProps) {
  const d = p.data;
  return <article className="resume aurora"><header><nav><span>{d.basics.name}</span><a href={`mailto:${d.basics.email}`}>Contact ↗</a></nav><div className="aurora-orb" aria-hidden="true" /><span className="aurora-kicker">DIGITAL EXPERIENCE / {new Date().getFullYear()}</span><h1>{d.basics.name}</h1><p>{d.basics.headline}</p><div className="aurora-contact">{contact(d)}</div></header><main><section className="aurora-intro"><span>01 / THE INTRODUCTION</span><div className="resume-summary"><Markdown text={d.basics.summary} /></div></section><section className="aurora-gallery"><div><span>02 / PROJECTS</span><h2>Ideas in motion</h2></div><div>{project(p, 'aurora-project')}</div></section><section className="aurora-milestones"><span>03 / EXPERIENCE</span><div>{work(p)}</div></section><section className="aurora-base"><div><span>04 / TOOLKIT</span>{skills(p)}</div><div><span>05 / STUDIES</span>{education(p)}</div></section><CustomSections data={d} /></main></article>;
}

function ContactDrawer({ data, onClose }: { data: CanonicalResume; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    node?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { node?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} id="showcase-contact-drawer" className="contact-drawer interactive-only" aria-modal="true" aria-labelledby="contact-drawer-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) { const bounds = e.currentTarget.getBoundingClientRect(); if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose(); } }}><header><span>CONTACT</span><button type="button" autoFocus onClick={onClose} aria-label="Đóng thông tin liên hệ">✕</button></header><div className="contact-drawer-body"><h2 id="contact-drawer-title">Let's connect.</h2><p className="contact-drawer-name">{data.basics.name}</p><p>{data.basics.headline}</p><address className="contact-drawer-details">{contact(data)}</address></div><footer><a className="contact-drawer-email" href={`mailto:${data.basics.email}`}>Gửi email ↗</a></footer></dialog>;
}

type PreviewTarget = { id: string; kind: 'live' | 'images' };

function Preview({ data, id, kind, onClose }: { data: CanonicalResume; id: string; kind: 'live' | 'images'; onClose: () => void }) {
  const item = data.projects.find(x => x.id === id);
  const [image, setImage] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    node?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { node?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => setImage(0), [id, kind]);
  if (!item) return null;
  const live = safeWebUrl(item.liveUrl);
  const media = item.media?.map(safeWebUrl).filter((url): url is string => Boolean(url)) || [];
  return <dialog ref={dialog} className="preview-dialog interactive-only" aria-modal="true" aria-label={`${item.title} preview`} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) { const bounds = e.currentTarget.getBoundingClientRect(); if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose(); } }}><header><div><small>PROJECT PREVIEW</small><h2>{item.title}</h2></div><button type="button" autoFocus onClick={onClose} aria-label="Close preview">✕</button></header><div className="preview-content">{kind === 'images' && media.length ? <><img src={media[image] || media[0]} alt={`${item.title} screenshot ${image + 1}`} /><div className="preview-images">{media.map((src, i) => <button key={`${src}-${i}`} type="button" aria-label={`Image ${i + 1}`} aria-pressed={image === i} className={image === i ? 'is-active' : ''} onClick={() => setImage(i)}>{i + 1}</button>)}</div></> : live ? <iframe src={live} title={`${item.title} live preview`} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" /> : <Markdown text={item.description} />}</div>{live && <><p className="preview-note">Nếu website chặn nhúng, mở dự án trong tab mới.</p><SafeLink className="preview-external" url={live}>Open website ↗</SafeLink></>}</dialog>;
}

const additionalViews = createAdditionalTemplates({ work, skills, project, education, contact, custom: data => <CustomSections data={data} />, summary: text => <Markdown text={text} /> });
const views = { t1: Executive, t2: Duo, t3: Bento, t4: Terminal, t5: Editorial, t6: Timeline, t7: Dense, t8: Showcase, t9: Academic, t10: Launchpad, t11: Casebook, t12: Ledger, t13: Poster, t14: Agency, t15: Corporate, t16: Aurora, ...additionalViews };
function safeColor(value: string, fallback: string) { return value.length <= 80 && !/[;{}]/.test(value) && (typeof CSS !== 'undefined' ? CSS.supports('color', value) : /^(#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%/+-]+\))$/i.test(value)) ? value : fallback; }

export function EngineSwitcher({ data, templateId, mode }: Props) {
  const parsed = useMemo(() => CanonicalResumeSchema.parse(data), [data]);
  const [skill, setSkill] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [dark, setDark] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState('');
  const template: TemplateId = Object.prototype.hasOwnProperty.call(views, templateId) ? templateId as TemplateId : 't1';
  useEffect(() => {
    const title = `${parsed.basics.name} — ${parsed.basics.headline}`;
    const description = plain(parsed.basics.summary).slice(0, 160);
    document.title = title;
    const set = (selector: string, attr: string, value: string) => { let el = document.head.querySelector<HTMLMetaElement>(selector); if (!el) { el = document.createElement('meta'); document.head.appendChild(el); } el.setAttribute(attr, value); };
    set('meta[name="description"]', 'name', 'description');
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    const avatar = safeWebUrl(parsed.basics.avatarUrl);
    if (!avatar) document.head.querySelector('meta[property="og:image"]')?.remove();
    for (const [property, content] of [['og:title', title], ['og:description', description], ['og:type', 'profile'], ['og:url', window.location.href], ...(avatar ? [['og:image', avatar]] : [])]) {
      set(`meta[property="${property}"]`, 'property', property);
      document.querySelector(`meta[property="${property}"]`)?.setAttribute('content', content);
    }
  }, [parsed]);
  const props: TemplateProps = { data: parsed, mode, skill: mode === 'pdf' ? null : skill, onSkill: value => setSkill(current => current === value ? null : value), onPreview: (id, kind = 'live') => setPreview({ id, kind }) };
  const View = views[template];
  const fontPresets: Record<TemplateId, [string, string]> = {
    t1: ['Merriweather', 'Inter'], t2: ['Plus Jakarta Sans', 'Plus Jakarta Sans'],
    t3: ['Space Grotesk', 'Inter'], t4: ['Fira Code', 'Fira Code'],
    t5: ['Playfair Display', 'Inter'], t6: ['DM Sans', 'DM Sans'],
    t7: ['Inter', 'Inter'], t8: ['Space Grotesk', 'Inter'],
    t9: ['Merriweather', 'Inter'], t10: ['Space Grotesk', 'Inter'],
    t11: ['Space Grotesk', 'Inter'], t12: ['Inter', 'Inter'],
    t13: ['Playfair Display', 'Inter'], t14: ['Plus Jakarta Sans', 'Inter'],
    t15: ['Inter', 'Inter'], t16: ['Space Grotesk', 'Inter'],
    t17: ['Merriweather', 'Inter'], t18: ['DM Sans', 'Inter'],
    t19: ['IBM Plex Serif', 'IBM Plex Sans'], t20: ['Lora', 'DM Sans'],
    t21: ['Sora', 'Inter'], t22: ['Libre Baskerville', 'Inter'],
    t23: ['Merriweather', 'Inter'], t24: ['JetBrains Mono', 'IBM Plex Sans'],
    t25: ['Space Grotesk', 'IBM Plex Mono'], t26: ['Playfair Display', 'Source Serif 4'],
    t27: ['Syne', 'Inter'], t28: ['Plus Jakarta Sans', 'Inter'],
    t29: ['Space Grotesk', 'IBM Plex Sans'], t30: ['Cormorant Garamond', 'Lora'],
    t31: ['DM Sans', 'Inter'], t32: ['Inter', 'Inter'],
  };
  const headingFont = FONT_CATALOG.some(x => x.family === parsed.meta.theme.fontHeading) ? parsed.meta.theme.fontHeading : fontPresets[template][0];
  const bodyFont = FONT_CATALOG.some(x => x.family === parsed.meta.theme.fontBody) ? parsed.meta.theme.fontBody : fontPresets[template][1];
  useEffect(() => { loadFont(headingFont); loadFont(bodyFont); }, [headingFont, bodyFont]);
  const radius = { none: '0', sm: '8px', md: '20px', full: '32px' }[parsed.meta.theme.radius];
  return <div className={`engine-root template-${template} mode-${mode} ${dark ? 'dark' : ''}`} style={{ '--primary': safeColor(parsed.meta.theme.primaryColor, '#172c3d'), '--accent': safeColor(parsed.meta.theme.accentColor, '#b5efce'), '--heading-font': headingFont, '--body-font': bodyFont, '--theme-radius': radius } as React.CSSProperties}><View {...props} />{mode === 'landing' && <><nav className="action-dock interactive-only" aria-label="Portfolio actions"><button type="button" onClick={() => window.print()} title="Download or print PDF">↓ <span>PDF</span></button><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setShareError(''); window.setTimeout(() => setCopied(false), 1800); } catch { setShareError(copyErrorMessage); } }} title="Copy link">{copied ? '✓' : '↗'} <span>{copied ? 'Copied' : 'Share'}</span></button><a href={`mailto:${parsed.basics.email}`} title="Email">✉ <span>Email</span></a><button type="button" onClick={() => setDark(x => !x)} title="Switch theme" aria-pressed={dark}>{dark ? '☀' : '◐'} <span>Theme</span></button></nav>{shareError && <p className="share-message interactive-only" role="status">{shareError}</p>}{preview && <Preview key={`${preview.id}-${preview.kind}`} data={parsed} {...preview} onClose={() => setPreview(null)} />}</>}</div>;
}
