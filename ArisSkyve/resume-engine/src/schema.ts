import { z } from 'zod';

const month = z.string();
const url = z.string().url();
const LayoutText = z.object({
  id: z.string().max(80), text: z.string().max(10000),
  x: z.number().min(-2000).max(4000), y: z.number().min(-2000).max(4000),
  width: z.number().positive().max(4000), height: z.number().positive().max(4000),
  fontSize: z.number().positive().max(500), fontFamily: z.string().max(150), href: z.string().url().optional(),
  // Persisted after save: a deliberately changed line must never be silently
  // squeezed to fit like a source-PDF line can be.
  textEdited: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/), bold: z.boolean(), italic: z.boolean(),
});
export const ImportedLayoutSchema = z.object({
  version: z.literal(1), sourceName: z.string().max(200), sourceId: z.string().regex(/^[a-f0-9]{32}$/).optional(),
  // The first painted span is often a document heading (for example
  // "CURRICULUM VITAE"), not the applicant. The editor stores the owner’s
  // explicit choice instead of guessing again on every save.
  nameElementId: z.string().max(80).optional(),
  // OCR can only make a best-effort clean background. Keep the acknowledgement in
  // the canonical document so the API can enforce it before saving or publishing.
  ocrReviewRequired: z.boolean().optional(), ocrReviewConfirmed: z.boolean().optional(),
  warnings: z.array(z.string().max(1000)).max(30),
  pages: z.array(z.object({
    width: z.number().min(10).max(2000), height: z.number().min(10).max(2000),
    background: z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/).max(8000000),
    elements: z.array(LayoutText).max(1500),
  })).min(1).max(20),
});
export type ImportedLayout = z.infer<typeof ImportedLayoutSchema>;
export const CanonicalResumeSchema = z.object({
  meta: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    version: z.string(),
    theme: z.object({
      primaryColor: z.string(),
      accentColor: z.string(),
      fontHeading: z.string(),
      fontBody: z.string(),
      radius: z.enum(['none', 'sm', 'md', 'full']),
    }),
    atsOptimized: z.boolean().default(true),
  }),
  basics: z.object({
    name: z.string(),
    headline: z.string(),
    avatarUrl: url.optional(),
    email: z.string().email().or(z.literal('')),
    phone: z.string(),
    location: z.object({ city: z.string(), country: z.string(), remoteStatus: z.enum(['remote', 'hybrid', 'onsite']) }),
    summary: z.string(),
    links: z.array(z.object({ platform: z.enum(['github', 'linkedin', 'x', 'portfolio', 'custom']), label: z.string(), url })),
  }),
  work: z.array(z.object({
    id: z.string(), company: z.string(), role: z.string(), startDate: month, endDate: month.nullable(),
    isCurrent: z.boolean(), highlights: z.array(z.string()),
    metrics: z.array(z.object({ label: z.string(), value: z.string() })).optional(), techStack: z.array(z.string()),
  })),
  projects: z.array(z.object({
    id: z.string(), title: z.string(), tagline: z.string(), description: z.string(),
    liveUrl: url.optional(), repoUrl: url.optional(), featured: z.boolean().default(false),
    stack: z.array(z.string()), media: z.array(url).optional(),
  })),
  skills: z.array(z.object({ category: z.string(), items: z.array(z.object({
    name: z.string(), level: z.enum(['beginner', 'competent', 'expert']).optional(), yearsOfExperience: z.number().optional(),
  })) })),
  education: z.array(z.object({
    institution: z.string(), degree: z.string(), field: z.string(), startDate: month, endDate: month,
    gpa: z.string().optional(), honors: z.array(z.string()).optional(),
  })),
  customSections: z.array(z.object({ id: z.string(), heading: z.string(), type: z.enum(['rich-text', 'key-value', 'timeline', 'badge-grid']), content: z.any() })).optional(),
  importedLayout: ImportedLayoutSchema.optional(),
});

export type CanonicalResume = z.infer<typeof CanonicalResumeSchema>;
export type TemplateId = `t${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32}`;
export type RenderMode = 'pdf' | 'landing';
