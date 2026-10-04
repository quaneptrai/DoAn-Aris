import type { ReactNode } from 'react';
import type { CanonicalResume, RenderMode, TemplateId } from './schema';
import './additional.css';

export type AdditionalTemplateProps = {
  data: CanonicalResume;
  mode: RenderMode;
  skill: string | null;
  onSkill: (skill: string) => void;
  onPreview: (id: string, kind?: 'live' | 'images') => void;
};

export type AdditionalTemplateParts = {
  work: (props: AdditionalTemplateProps) => ReactNode;
  skills: (props: AdditionalTemplateProps) => ReactNode;
  project: (props: AdditionalTemplateProps, variant: string) => ReactNode;
  education: (props: AdditionalTemplateProps) => ReactNode;
  custom: (data: CanonicalResume) => ReactNode;
  contact: (data: CanonicalResume) => ReactNode;
  summary: (text: string) => ReactNode;
};

export const additionalTemplateCatalog: { id: TemplateId; name: string; categories: string[]; note: string; structure: string }[] = [
  { id: 't17', name: 'Counsel Brief', categories: ['ATS & Corporate', 'Legal'], note: 'Legal brief · Numbered sections', structure: 'legal-brief' },
  { id: 't18', name: 'Clinical Record', categories: ['Healthcare', 'ATS & Corporate'], note: 'Clinical dossier · Credential rail', structure: 'clinical-record' },
  { id: 't19', name: 'Research Laboratory', categories: ['Academic', 'Technology'], note: 'Research atlas · Methods and findings', structure: 'research-lab' },
  { id: 't20', name: 'Educator Studio', categories: ['Academic', 'Education'], note: 'Teaching portfolio · Learning blocks', structure: 'educator-studio' },
  { id: 't21', name: 'Revenue Scorecard', categories: ['Sales', 'Leadership'], note: 'Results dashboard · Career evidence', structure: 'revenue-scorecard' },
  { id: 't22', name: 'Financial Report', categories: ['Finance', 'ATS & Corporate'], note: 'Annual report · Ledger columns', structure: 'financial-report' },
  { id: 't23', name: 'Consulting Memo', categories: ['Leadership', 'ATS & Corporate'], note: 'Executive memo · Recommendation flow', structure: 'consulting-memo' },
  { id: 't24', name: 'Data Notebook', categories: ['Technology', 'Academic'], note: 'Notebook cells · Analysis narrative', structure: 'data-notebook' },
  { id: 't25', name: 'Architecture Blueprint', categories: ['Architecture', 'Technology'], note: 'Drawing sheet · Modular title block', structure: 'architecture-blueprint' },
  { id: 't26', name: 'Journalist Edition', categories: ['Creative', 'Media'], note: 'Newspaper · Feature and dispatches', structure: 'journalist-edition' },
  { id: 't27', name: 'Design Gallery', categories: ['Creative', 'Freelance'], note: 'Gallery wall · Project exhibition', structure: 'design-gallery' },
  { id: 't28', name: 'Campus Graduate', categories: ['Student', 'Academic'], note: 'Education first · Project seminar', structure: 'campus-graduate' },
  { id: 't29', name: 'Operations Control', categories: ['Operations', 'Leadership'], note: 'Command board · Process modules', structure: 'operations-control' },
  { id: 't30', name: 'Hospitality Signature', categories: ['Hospitality', 'Freelance'], note: 'Service portfolio · Menu typography', structure: 'hospitality-signature' },
  { id: 't31', name: 'Community Impact', categories: ['Nonprofit', 'Leadership'], note: 'Impact report · Community story', structure: 'community-impact' },
  { id: 't32', name: 'Essential Compact', categories: ['ATS & Corporate', 'Student'], note: 'Compact single column · Direct reading', structure: 'essential-compact' },
];

type SectionProps = { title: string; children: ReactNode; className?: string; show: boolean; number?: string };
function Section({ title, children, className = '', show, number }: SectionProps) {
  if (!show) return null;
  return <section className={`ax-section ${className}`}><h2>{number && <span className="ax-section-number" aria-hidden="true">{number}</span>}{title}</h2>{children}</section>;
}
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(-2).map(x => x[0]).join('');
const customExists = (data: CanonicalResume) => Boolean(data.customSections?.length);

/** Each entry owns its document structure. Content primitives share only canonical data rendering. */
export function createAdditionalTemplates(parts: AdditionalTemplateParts) {
  const { work, skills, project, education, custom, contact, summary } = parts;
  const Contact = ({ data, className = '' }: { data: CanonicalResume; className?: string }) => <address className={`ax-contact ${className}`}>{contact(data)}</address>;
  const Summary = ({ data }: { data: CanonicalResume }) => data.basics.summary.trim() ? <div className="ax-summary">{summary(data.basics.summary)}</div> : null;
  const Projects = ({ p, variant }: { p: AdditionalTemplateProps; variant: string }) => <div className={`ax-projects ${variant}-projects`}>{project(p, `ax-project ${variant}-project`)}</div>;
  const Extras = ({ data }: { data: CanonicalResume }) => customExists(data) ? <div className="ax-extras">{custom(data)}</div> : null;
  const Location = ({ data }: { data: CanonicalResume }) => <span>{[data.basics.location.city, data.basics.location.country].filter(Boolean).join(' · ')}</span>;
  const MetricCards = ({ data }: { data: CanonicalResume }) => {
    const metrics = data.work.flatMap(job => (job.metrics || []).map((metric, i) => ({ ...metric, key: `${job.id}-${i}`, company: job.company })));
    return metrics.length ? <dl className="ax-metrics">{metrics.map(metric => <div key={metric.key}><dt>{metric.label}</dt><dd>{metric.value}</dd><small>{metric.company}</small></div>)}</dl> : null;
  };

  function CounselBrief(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-counsel" data-render-mode={p.mode}>
      <header className="counsel-letterhead"><span className="counsel-seal" aria-hidden="true">{initials(d.basics.name)}</span><div><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p></div><Contact data={d} /></header>
      <main className="counsel-document">
        <Section title="Professional statement" number="I" show={Boolean(d.basics.summary)} className="counsel-statement"><Summary data={d} /></Section>
        <Section title="Professional experience" number="II" show={d.work.length > 0}>{work(p)}</Section>
        <Section title="Selected work & matters" number="III" show={d.projects.length > 0}><Projects p={p} variant="counsel" /></Section>
        <div className="counsel-qualifications"><Section title="Practice & expertise" number="IV" show={d.skills.length > 0}>{skills(p)}</Section><Section title="Education" number="V" show={d.education.length > 0}>{education(p)}</Section></div>
        <Extras data={d} />
      </main><footer className="counsel-foot"><span>{d.basics.name}</span><span>Curriculum vitae · {d.meta.version}</span></footer>
    </article>;
  }

  function ClinicalRecord(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-clinical" data-render-mode={p.mode}>
      <header className="clinical-header"><div className="clinical-identity"><span className="ax-kicker">Professional profile</span><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p></div><div className="clinical-directory"><Contact data={d} /></div></header>
      <div className="clinical-record">
        <aside className="clinical-credentials"><Section title="Education & training" show={d.education.length > 0}>{education(p)}</Section><Section title="Competencies" show={d.skills.length > 0}>{skills(p)}</Section><div className="clinical-reference"><small>LOCATION</small><Location data={d} /><small>WORK PREFERENCE</small><span>{d.basics.location.remoteStatus}</span></div></aside>
        <main className="clinical-main"><Section title="Profile" show={Boolean(d.basics.summary)}><Summary data={d} /></Section><Section title="Experience & appointments" show={d.work.length > 0} className="clinical-rounds">{work(p)}</Section><Section title="Projects & initiatives" show={d.projects.length > 0}><Projects p={p} variant="clinical" /></Section><Extras data={d} /></main>
      </div>
    </article>;
  }

  function ResearchLaboratory(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-laboratory" data-render-mode={p.mode}>
      <header className="lab-title"><div><span className="ax-kicker">Research portfolio / {d.meta.version}</span><h1>{d.basics.name}</h1></div><p className="ax-headline">{d.basics.headline}</p></header>
      <main className="lab-grid"><section className="lab-abstract"><span className="lab-label">A / Abstract</span><Summary data={d} /><Contact data={d} /></section>
        <Section title="Methods & tools" show={d.skills.length > 0} className="lab-methods" number="B">{skills(p)}</Section>
        <Section title="Research & projects" show={d.projects.length > 0} className="lab-results" number="C"><Projects p={p} variant="lab" /></Section>
        <Section title="Appointments" show={d.work.length > 0} className="lab-history" number="D">{work(p)}</Section>
        <Section title="Academic foundation" show={d.education.length > 0} className="lab-foundation" number="E">{education(p)}</Section>
        <div className="lab-supplement"><Extras data={d} /></div>
      </main>
    </article>;
  }

  function EducatorStudio(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-educator" data-render-mode={p.mode}>
      <header className="educator-cover"><div className="educator-monogram" aria-hidden="true">{initials(d.basics.name)}</div><div><span className="ax-kicker">Learning · Practice · Growth</span><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p></div></header>
      <Contact data={d} className="educator-contact" />
      <main><Section title="My approach" show={Boolean(d.basics.summary)} className="educator-philosophy"><Summary data={d} /></Section>
        <div className="educator-columns"><Section title="Experience" show={d.work.length > 0} className="educator-experience"><span className="educator-tab" aria-hidden="true">01</span>{work(p)}</Section><div className="educator-resources"><Section title="Qualifications" show={d.education.length > 0}>{education(p)}</Section><Section title="Teaching toolkit" show={d.skills.length > 0}>{skills(p)}</Section></div></div>
        <Section title="Projects & learning resources" show={d.projects.length > 0} className="educator-projects"><Projects p={p} variant="educator" /></Section><Extras data={d} />
      </main>
    </article>;
  }

  function RevenueScorecard(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-revenue" data-render-mode={p.mode}>
      <header className="revenue-banner"><div><span className="ax-kicker">Performance portfolio</span><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p></div><Contact data={d} /></header>
      <div className="revenue-scoreboard"><MetricCards data={d} /></div>
      <main className="revenue-body"><aside className="revenue-overview"><Section title="The approach" show={Boolean(d.basics.summary)}><Summary data={d} /></Section><Section title="Capabilities" show={d.skills.length > 0}>{skills(p)}</Section><Section title="Education" show={d.education.length > 0}>{education(p)}</Section></aside>
        <div className="revenue-results"><Section title="Track record" show={d.work.length > 0}>{work(p)}</Section><Section title="Selected initiatives" show={d.projects.length > 0}><Projects p={p} variant="revenue" /></Section><Extras data={d} /></div>
      </main>
    </article>;
  }

  function FinancialReport(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-finance" data-render-mode={p.mode}>
      <header className="finance-mast"><span>PROFESSIONAL REPORT</span><span>VERSION {d.meta.version}</span></header>
      <div className="finance-title"><h1>{d.basics.name}</h1><div><p className="ax-headline">{d.basics.headline}</p><Contact data={d} /></div></div>
      <main><div className="finance-opening"><Section title="Profile overview" number="01" show={Boolean(d.basics.summary)}><Summary data={d} /></Section><Section title="Core competencies" number="02" show={d.skills.length > 0}>{skills(p)}</Section></div>
        <Section title="Professional record" number="03" show={d.work.length > 0} className="finance-ledger">{work(p)}</Section>
        <div className="finance-closing"><Section title="Selected engagements" number="04" show={d.projects.length > 0}><Projects p={p} variant="finance" /></Section><Section title="Education & qualifications" number="05" show={d.education.length > 0}>{education(p)}</Section></div><Extras data={d} />
      </main><footer className="finance-foot"><span>{d.basics.name}</span><Location data={d} /></footer>
    </article>;
  }

  function ConsultingMemo(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-consulting" data-render-mode={p.mode}>
      <header className="memo-header"><span className="ax-kicker">Professional memorandum</span><h1>{d.basics.name}</h1><dl className="memo-routing"><div><dt>Expertise</dt><dd>{d.basics.headline}</dd></div><div><dt>Contact</dt><dd><Contact data={d} /></dd></div></dl></header>
      <main><Section title="Executive profile" number="01" show={Boolean(d.basics.summary)} className="memo-summary"><Summary data={d} /></Section><Section title="Experience & outcomes" number="02" show={d.work.length > 0} className="memo-experience">{work(p)}</Section>
        <div className="memo-evidence"><Section title="Selected engagements" number="03" show={d.projects.length > 0}><Projects p={p} variant="memo" /></Section><aside><Section title="Capabilities" number="04" show={d.skills.length > 0}>{skills(p)}</Section><Section title="Education" number="05" show={d.education.length > 0}>{education(p)}</Section></aside></div><Extras data={d} />
      </main>
    </article>;
  }

  function DataNotebook(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-notebook" data-render-mode={p.mode}>
      <header className="notebook-bar"><span className="notebook-kernel" aria-hidden="true" /><span>{d.meta.slug}.ipynb</span><span>Professional notebook</span></header>
      <main className="notebook-cells"><section className="notebook-cell notebook-intro"><span className="notebook-prompt" aria-hidden="true">[01]</span><div className="notebook-output"><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p><Summary data={d} /><Contact data={d} /></div></section>
        {d.skills.length > 0 && <section className="notebook-cell"><span className="notebook-prompt" aria-hidden="true">[02]</span><div className="notebook-output notebook-imports"><h2>Tools & methods</h2>{skills(p)}</div></section>}
        {d.projects.length > 0 && <section className="notebook-cell"><span className="notebook-prompt" aria-hidden="true">[03]</span><div className="notebook-output"><h2>Selected analyses & projects</h2><Projects p={p} variant="notebook" /></div></section>}
        {d.work.length > 0 && <section className="notebook-cell"><span className="notebook-prompt" aria-hidden="true">[04]</span><div className="notebook-output"><h2>Experience</h2>{work(p)}</div></section>}
        {d.education.length > 0 && <section className="notebook-cell"><span className="notebook-prompt" aria-hidden="true">[05]</span><div className="notebook-output"><h2>Education</h2>{education(p)}</div></section>}
        {customExists(d) && <div className="notebook-cell"><span className="notebook-prompt" aria-hidden="true">[06]</span><div className="notebook-output"><Extras data={d} /></div></div>}
      </main>
    </article>;
  }

  function ArchitectureBlueprint(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-blueprint" data-render-mode={p.mode}>
      <header className="blueprint-titleblock"><div className="blueprint-name"><span className="ax-kicker">Professional portfolio</span><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p></div><div className="blueprint-drawing"><span>PROFILE</span><strong>A — 01</strong><span>Revision {d.meta.version}</span></div><Contact data={d} /></header>
      <main className="blueprint-sheet"><Section title="Design statement" number="A" show={Boolean(d.basics.summary)} className="blueprint-statement"><Summary data={d} /></Section><Section title="Tools & disciplines" number="B" show={d.skills.length > 0} className="blueprint-tools">{skills(p)}</Section><Section title="Selected projects" number="C" show={d.projects.length > 0} className="blueprint-projects"><Projects p={p} variant="blueprint" /></Section><Section title="Professional experience" number="D" show={d.work.length > 0} className="blueprint-experience">{work(p)}</Section><Section title="Education" number="E" show={d.education.length > 0} className="blueprint-education">{education(p)}</Section><div className="blueprint-notes"><Extras data={d} /></div></main>
    </article>;
  }

  function JournalistEdition(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-journalist" data-render-mode={p.mode}>
      <header className="journalist-mast"><div className="journalist-edition"><span>THE PROFESSIONAL EDITION</span><Location data={d} /><span>VOL. {d.meta.version}</span></div><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p><Contact data={d} /></header>
      <main><div className="journalist-lead"><Section title="Profile" show={Boolean(d.basics.summary)} className="journalist-feature"><Summary data={d} /></Section><Section title="On the record" show={d.skills.length > 0} className="journalist-beats">{skills(p)}</Section></div><div className="journalist-columns"><Section title="The career story" show={d.work.length > 0} className="journalist-career">{work(p)}</Section><Section title="Selected dispatches" show={d.projects.length > 0} className="journalist-dispatches"><Projects p={p} variant="journalist" /></Section><aside className="journalist-education"><Section title="Education" show={d.education.length > 0}>{education(p)}</Section><Extras data={d} /></aside></div></main>
    </article>;
  }

  function DesignGallery(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-gallery" data-render-mode={p.mode}>
      <header className="gallery-identity"><div className="gallery-wordmark">{initials(d.basics.name)}<span aria-hidden="true">®</span></div><div><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p></div><Location data={d} /></header>
      <main><Section title="Selected work" show={d.projects.length > 0} className="gallery-exhibition"><Projects p={p} variant="gallery" /></Section><div className="gallery-biography"><section className="gallery-about"><span className="ax-kicker">The person behind the work</span><Summary data={d} /><Contact data={d} /></section><Section title="Practice" show={d.skills.length > 0}>{skills(p)}</Section></div><div className="gallery-history"><Section title="Experience" show={d.work.length > 0}>{work(p)}</Section><Section title="Education" show={d.education.length > 0}>{education(p)}</Section></div><Extras data={d} /></main>
    </article>;
  }

  function CampusGraduate(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-campus" data-render-mode={p.mode}>
      <header className="campus-banner"><span className="campus-crest" aria-hidden="true">{initials(d.basics.name)}</span><div><span className="ax-kicker">Graduate portfolio</span><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p></div></header><Contact data={d} className="campus-contact" />
      <main><Section title="Education" show={d.education.length > 0} className="campus-transcript">{education(p)}</Section><div className="campus-study"><div className="campus-profile"><Section title="About me" show={Boolean(d.basics.summary)}><Summary data={d} /></Section><Section title="Skills in practice" show={d.skills.length > 0}>{skills(p)}</Section></div><Section title="Projects & coursework" show={d.projects.length > 0} className="campus-seminar"><Projects p={p} variant="campus" /></Section></div><Section title="Experience & involvement" show={d.work.length > 0} className="campus-experience">{work(p)}</Section><Extras data={d} /></main>
    </article>;
  }

  function OperationsControl(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-operations" data-render-mode={p.mode}>
      <header className="operations-topline"><span>CAREER OVERVIEW</span><span>{d.meta.slug} / {d.meta.version}</span></header>
      <main className="operations-board"><section className="operations-identity"><span className="ax-kicker">Profile</span><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p><Contact data={d} /></section><Section title="Operating principles" show={Boolean(d.basics.summary)} className="operations-summary"><Summary data={d} /></Section><Section title="Capabilities" show={d.skills.length > 0} className="operations-capabilities">{skills(p)}</Section><Section title="Delivery record" show={d.work.length > 0} className="operations-record">{work(p)}</Section><Section title="Projects & improvements" show={d.projects.length > 0} className="operations-programs"><Projects p={p} variant="operations" /></Section><Section title="Qualifications" show={d.education.length > 0} className="operations-qualifications">{education(p)}</Section><div className="operations-extras"><Extras data={d} /></div></main>
    </article>;
  }

  function HospitalitySignature(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-hospitality" data-render-mode={p.mode}>
      <header className="hospitality-welcome"><span className="hospitality-mark" aria-hidden="true">{initials(d.basics.name)}</span><span className="ax-kicker">A personal introduction</span><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p><Contact data={d} /></header>
      <main><Section title="The art of service" show={Boolean(d.basics.summary)} className="hospitality-philosophy"><Summary data={d} /></Section><div className="hospitality-menu"><Section title="Experience" show={d.work.length > 0} className="hospitality-experience">{work(p)}</Section><aside className="hospitality-specialties"><Section title="Specialties" show={d.skills.length > 0}>{skills(p)}</Section><Section title="Education & training" show={d.education.length > 0}>{education(p)}</Section></aside></div><Section title="Signature projects" show={d.projects.length > 0} className="hospitality-projects"><Projects p={p} variant="hospitality" /></Section><Extras data={d} /></main><footer className="hospitality-footer"><Location data={d} /><span>{d.basics.name}</span></footer>
    </article>;
  }

  function CommunityImpact(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-community" data-render-mode={p.mode}>
      <header className="community-header"><div><span className="ax-kicker">People · Purpose · Progress</span><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p></div><Contact data={d} /></header>
      <main>{d.basics.summary.trim() && <section className="community-mission"><span className="community-chapter" aria-hidden="true">01</span><div><h2>My purpose</h2><Summary data={d} /></div></section>}<div className="community-impact"><MetricCards data={d} /></div><Section title="Work in action" number="02" show={d.projects.length > 0} className="community-programs"><Projects p={p} variant="community" /></Section><div className="community-path"><Section title="Experience" number="03" show={d.work.length > 0}>{work(p)}</Section><div className="community-foundations"><Section title="Skills to contribute" number="04" show={d.skills.length > 0}>{skills(p)}</Section><Section title="Education" number="05" show={d.education.length > 0}>{education(p)}</Section></div></div><Extras data={d} /></main>
    </article>;
  }

  function EssentialCompact(p: AdditionalTemplateProps) {
    const d = p.data;
    return <article className="resume ax-resume ax-essential" data-render-mode={p.mode}>
      <header className="essential-header"><h1>{d.basics.name}</h1><p className="ax-headline">{d.basics.headline}</p><Contact data={d} /></header>
      <main><Section title="Profile" show={Boolean(d.basics.summary)}><Summary data={d} /></Section><Section title="Experience" show={d.work.length > 0}>{work(p)}</Section><Section title="Projects" show={d.projects.length > 0}><Projects p={p} variant="essential" /></Section><Section title="Skills" show={d.skills.length > 0} className="essential-skills">{skills(p)}</Section><Section title="Education" show={d.education.length > 0}>{education(p)}</Section><Extras data={d} /></main>
    </article>;
  }

  return { t17: CounselBrief, t18: ClinicalRecord, t19: ResearchLaboratory, t20: EducatorStudio, t21: RevenueScorecard, t22: FinancialReport, t23: ConsultingMemo, t24: DataNotebook, t25: ArchitectureBlueprint, t26: JournalistEdition, t27: DesignGallery, t28: CampusGraduate, t29: OperationsControl, t30: HospitalitySignature, t31: CommunityImpact, t32: EssentialCompact };
}
