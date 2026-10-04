import type { CanonicalResume } from './schema';

/** JSON Resume permits YYYY, YYYY-MM and YYYY-MM-DD; partial prose stays in the source extension. */
function exportDate(value: string | null): string | undefined {
  const date = value?.trim();
  return date && /^[12]\d{3}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(date) ? date : undefined;
}

function httpUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

/** Adapt the canonical document for community themes; keep the complete source for round trips. */
export function toJsonResume(data: CanonicalResume) {
  const country = data.basics.location.country.trim();
  const portfolio = data.basics.links.find(link => link.platform === 'portfolio');
  const networkNames = { github: 'GitHub', linkedin: 'LinkedIn', x: 'X', portfolio: 'Portfolio', custom: 'Website' };
  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/master/schema.json',
    basics: {
      name: data.basics.name,
      label: data.basics.headline,
      image: httpUrl(data.basics.avatarUrl),
      email: data.basics.email,
      phone: data.basics.phone,
      url: httpUrl(portfolio?.url),
      summary: data.basics.summary,
      location: {
        city: data.basics.location.city,
        countryCode: /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : undefined,
        country,
      },
      profiles: data.basics.links.flatMap(link => {
        const url = httpUrl(link.url);
        return url ? [{ network: link.platform === 'custom' ? link.label : networkNames[link.platform], url }] : [];
      }),
    },
    work: data.work.map(item => ({
      name: item.company,
      position: item.role,
      startDate: exportDate(item.startDate),
      endDate: item.isCurrent ? undefined : exportDate(item.endDate),
      highlights: [...item.highlights, ...(item.metrics || []).map(metric => `${metric.label}: ${metric.value}`)],
      keywords: [...item.techStack],
    })),
    education: data.education.map(item => ({
      institution: item.institution,
      area: item.field,
      studyType: item.degree,
      startDate: exportDate(item.startDate),
      endDate: exportDate(item.endDate),
      score: item.gpa,
      honors: item.honors ? [...item.honors] : undefined,
    })),
    skills: data.skills.map(group => ({ name: group.category, keywords: group.items.map(item => item.name) })),
    projects: data.projects.map(project => ({
      name: project.title,
      description: project.description,
      highlights: project.tagline ? [project.tagline] : [],
      keywords: [...project.stack],
      url: httpUrl(project.liveUrl) || httpUrl(project.repoUrl),
    })),
    meta: { version: '1.0.0', exportedFrom: 'Aris Resume Studio' },
    // JSON Resume allows extensions. Preserve custom sections, unknown dates, theme and full skill details.
    xAris: { canonicalResume: structuredClone(data) },
  };
}

export function downloadJsonResume(data: CanonicalResume): void {
  const blob = new Blob([JSON.stringify(toJsonResume(data), null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${data.meta.slug || 'resume'}.json`;
  document.body.append(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
