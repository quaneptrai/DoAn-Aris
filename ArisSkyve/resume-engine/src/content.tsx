import { Fragment, type ReactNode } from 'react';

/** Rendering accepts the canonical contract's freeform dates without throwing. */
export function formatResumeDate(value: string | null): string {
  if (value === null) return 'Hiện tại';
  const trimmed = value.trim();
  if (!trimmed || /^\d{4}$/.test(trimmed)) return trimmed;
  const month = /^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/.exec(trimmed);
  if (!month) return trimmed;
  const date = new Date(0);
  date.setUTCFullYear(Number(month[1]), Number(month[2]) - 1, 1);
  return new Intl.DateTimeFormat('vi-VN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function safeWebUrl(value: string | undefined): string | undefined {
  if (!value || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function SafeLink({ url, children, className }: { url: string; children: ReactNode; className?: string }) {
  const href = safeWebUrl(url);
  return href ? <a href={href} className={className} target="_blank" rel="noopener noreferrer">{children}</a> : <span className={className}>{children}</span>;
}

export function plainText(value: string) {
  return value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
}

/** A deliberately small Markdown renderer: no HTML interpretation or unsafe URLs. */
function inline(text: string): ReactNode[] {
  const pattern = /(\[[^\]\n]+\]\([^\s)]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  const result: ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > offset) result.push(text.slice(offset, match.index));
    const token = match[0];
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
    if (link) result.push(<SafeLink key={match.index} url={link[2]}>{link[1]}</SafeLink>);
    else if (token.startsWith('**') || token.startsWith('__')) result.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) result.push(<code key={match.index}>{token.slice(1, -1)}</code>);
    else result.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    offset = match.index! + token.length;
  }
  result.push(text.slice(offset));
  return result;
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  return <>{blocks.filter(Boolean).map((block, index) => {
    const lines = block.split('\n');
    if (lines.every(line => /^\s*[-*+]\s+/.test(line))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*+]\s+/, ''))}</li>)}</ul>;
    if (lines.every(line => /^\s*\d+[.)]\s+/.test(line))) return <ol key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>)}</ol>;
    return <p key={index}>{lines.map((line, i) => <Fragment key={i}>{i > 0 && <br />}{/^#{1,6}\s/.test(line) ? <strong>{inline(line.replace(/^#{1,6}\s+/, ''))}</strong> : inline(line)}</Fragment>)}</p>;
  })}</>;
}
