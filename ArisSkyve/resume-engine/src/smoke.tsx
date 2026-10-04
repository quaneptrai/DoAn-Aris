import { renderToString } from 'react-dom/server';
import { EngineSwitcher } from './Engine';
import { sample } from './sample';
import type { TemplateId } from './schema';
import { formatResumeDate, Markdown, safeWebUrl } from './content';
import { normalizeEditorDraft } from './Editor';

const fixture = structuredClone(sample);
fixture.basics.name = 'Contract Candidate';
fixture.basics.email = 'contract@example.org';
fixture.basics.phone = '+84 912 345 678';
fixture.basics.summary = '**Canonical impact summary** with [portfolio](https://example.org/profile).';
fixture.work[0].startDate = '';
fixture.work[0].metrics = [{ label: 'Unique measurement label', value: '42% verified' }];
fixture.work[0].techStack = ['UniqueWorkStack'];
fixture.education[0].startDate = '2018';
fixture.education[0].honors = ['Unique education honor'];
fixture.skills[0].items.push({ name: 'UniqueSkillName', level: 'expert', yearsOfExperience: 7 });
fixture.projects[0].liveUrl = 'https://example.org/unique-demo';
fixture.projects[0].repoUrl = 'https://example.org/unique-repository';
fixture.projects[0].stack = ['UniqueProjectStack'];
fixture.customSections = [{ id: 'certifications', heading: 'Unique custom section', type: 'timeline', content: [{ date: '2025', title: 'Unique certification' }] }];
const required = [fixture.basics.name, fixture.basics.email, fixture.basics.phone, 'Canonical impact summary', 'Unique measurement label', '42% verified', 'UniqueWorkStack', 'UniqueSkillName', 'Unique education honor', 'UniqueProjectStack', 'https://example.org/unique-demo', 'https://example.org/unique-repository', 'Unique custom section', 'Unique certification'];

for (let number = 1; number <= 32; number++) {
  const id = `t${number}` as TemplateId;
  for (const mode of ['landing', 'pdf'] as const) {
    const html = renderToString(<EngineSwitcher data={fixture} templateId={id} mode={mode} />);
    for (const value of required) if (!html.includes(value)) throw new Error(`${id}/${mode}: required canonical content missing: ${value}`);
    if (!html.includes(`template-${id}`)) throw new Error(`${id}/${mode}: wrong template rendered`);
    if (mode === 'pdf' && html.includes('action-dock')) throw new Error(`${id}/${mode}: interactive dock leaked`);
    if (mode === 'pdf' && html.includes('is-dimmed')) throw new Error(`${id}/${mode}: project dimming leaked`);
    if (mode === 'pdf' && html.includes('project-actions')) throw new Error(`${id}/${mode}: preview buttons leaked`);
  }
}

for (const value of ['', '2018', '2024-06', '2024-06-15', 'Not provided', null]) {
  if (typeof formatResumeDate(value) !== 'string') throw new Error('Date formatter rejected canonical date');
}
for (const value of ['javascript:alert(1)', 'data:text/html,unsafe', 'https://user:secret@example.org', 'https://example.org/' + 'x'.repeat(2048)]) {
  if (safeWebUrl(value)) throw new Error('Unsafe external URL allowed');
}
if (!safeWebUrl('https://example.org/project')) throw new Error('Valid HTTPS URL rejected');
const markdown = renderToString(<Markdown text={'**Strong** *emphasis* `code` [safe](https://example.org) [bad](javascript:alert) <script>alert(1)</script>\n\n- First\n- Second'} />);
if (markdown.includes('<script>') || markdown.includes('href="javascript:') || !markdown.includes('<strong>Strong</strong>') || !markdown.includes('<ul>')) throw new Error('Safe Markdown rendering failed');
const edited = structuredClone(fixture);
edited.work[0].highlights = ['First bullet', '', ' Second bullet ', ''];
edited.work[0].techStack = ['React', ' TypeScript', ''];
edited.skills[0].items[0] = { name: ' Renamed skill ', level: 'expert', yearsOfExperience: 8 };
const normalized = normalizeEditorDraft(edited);
if (edited.work[0].highlights.length !== 4 || normalized.work[0].highlights.join('|') !== 'First bullet|Second bullet' || normalized.work[0].techStack.join('|') !== 'React|TypeScript') throw new Error('Editor normalization mutated draft or lost bullet separators');
if (normalized.skills[0].items[0].name !== 'Renamed skill' || normalized.skills[0].items[0].level !== 'expert' || normalized.skills[0].items[0].yearsOfExperience !== 8) throw new Error('Editor dropped skill metadata');
console.log('64 template/mode renders preserve canonical content; dates, Markdown/URL safety and editor normalization passed');
