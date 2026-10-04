import { createRoot } from 'react-dom/client';
import { EngineSwitcher } from '../src/Engine';
import { sample } from '../src/sample';
import type { CanonicalResume, RenderMode, TemplateId } from '../src/schema';
import '../src/style.css';
import '../src/extras.css';
import '../src/more.css';

const root = createRoot(document.getElementById('root')!);
const fixture = structuredClone(sample);
fixture.basics.name = 'Alex Canonical';
fixture.basics.summary = '**SUMMARY_SENTINEL**: building dependable products.';
fixture.basics.email = 'canonical@example.org';
fixture.basics.phone = '+84 912 345 678';
fixture.work[0].highlights.push('WORK_SENTINEL: delivered reliable services.');
fixture.work[0].metrics = [{ label: 'METRIC_SENTINEL', value: '42 percent' }];
fixture.work[0].techStack = ['WORKSTACK_SENTINEL'];
fixture.projects[0].title = 'PROJECT_SENTINEL';
fixture.projects[0].liveUrl = 'https://example.org/DEMO_SENTINEL';
fixture.projects[0].repoUrl = 'https://example.org/REPOSITORY_SENTINEL';
fixture.projects[0].stack = ['PROJECTSTACK_SENTINEL'];
fixture.skills[0].items = [{ name: 'SKILL_SENTINEL', level: 'expert', yearsOfExperience: 7 }];
fixture.education[0].institution = 'EDUCATION_SENTINEL';
fixture.education[0].honors = ['HONOR_SENTINEL'];
fixture.customSections = [{ id: 'cert', heading: 'CUSTOM_SENTINEL', type: 'timeline', content: [{ date: '2025', title: 'TIMELINE_SENTINEL' }] }];

declare global { interface Window { renderResume: (id: TemplateId, mode: RenderMode, test?: boolean) => void; resumeFixture: CanonicalResume; } }
window.resumeFixture = fixture;
window.renderResume = (templateId, mode, test = false) => root.render(<EngineSwitcher data={test ? fixture : sample} templateId={templateId} mode={mode} />);
window.renderResume('t1', 'landing');
