import type { TemplateId } from './schema';
import { additionalTemplateCatalog } from './additional';

export type TemplateEntry = { id: TemplateId; name: string; categories: string[]; note: string };
export const templates: TemplateEntry[] = [
  { id: 't1', name: 'Executive Minimalist', categories: ['ATS & Corporate', 'Leadership'], note: 'Một cột · Finance, Legal' },
  { id: 't2', name: 'Asymmetric Modern Duo', categories: ['Technology', 'Leadership'], note: 'Sidebar · Senior Engineer' },
  { id: 't3', name: 'Bento Dashboard', categories: ['Creative', 'Technology'], note: 'Card grid · Product, UX' },
  { id: 't4', name: 'Terminal Dev-Log', categories: ['Technology'], note: 'CLI · Backend, DevOps' },
  { id: 't5', name: 'Swiss Editorial', categories: ['Creative'], note: 'Magazine · Marketing' },
  { id: 't6', name: 'Timeline Matrix', categories: ['Technology', 'Leadership'], note: 'Career spine · Full-stack' },
  { id: 't7', name: 'Compact Dense Matrix', categories: ['ATS & Corporate', 'Leadership'], note: 'Ba cột · Architect' },
  { id: 't8', name: 'Immersive Showcase', categories: ['Creative', 'Freelance'], note: 'Web-first · Founder' },
  { id: 't9', name: 'Academic Dossier', categories: ['Academic', 'ATS & Corporate'], note: 'Research · Education' },
  { id: 't10', name: 'Student Launchpad', categories: ['Student', 'Technology'], note: 'Early career · Project-first' },
  { id: 't11', name: 'Product Casebook', categories: ['Creative', 'Technology'], note: 'Case studies · Product' },
  { id: 't12', name: 'Monochrome Ledger', categories: ['ATS & Corporate', 'Leadership'], note: 'Record table · Operations' },
  { id: 't13', name: 'Creative Poster', categories: ['Creative'], note: 'Big type · Art direction' },
  { id: 't14', name: 'Freelance Agency', categories: ['Freelance', 'Creative'], note: 'Services · Client work' },
  { id: 't15', name: 'Corporate Modern', categories: ['ATS & Corporate', 'Leadership'], note: 'Structured · Business' },
  { id: 't16', name: 'Aurora Profile', categories: ['Freelance', 'Technology'], note: 'Immersive · Digital maker' },
  ...additionalTemplateCatalog,
];
export const categories = ['Tất cả', ...new Set(templates.flatMap(t => t.categories))];
export const validTemplate = (value: unknown): value is TemplateId => templates.some(x => x.id === value);
