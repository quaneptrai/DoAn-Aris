export type FontEntry = { family: string; category: 'System' | 'Sans serif' | 'Serif' | 'Display' | 'Monospace'; web: boolean };
const system = ['Arial', 'Calibri', 'Cambria', 'Times New Roman', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Garamond', 'Palatino Linotype', 'Courier New', 'Consolas', 'Helvetica'];
const sans = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito Sans', 'DM Sans', 'Plus Jakarta Sans', 'Manrope', 'Work Sans', 'Source Sans 3', 'Noto Sans', 'Be Vietnam Pro', 'IBM Plex Sans', 'Figtree', 'Outfit', 'Public Sans', 'Ubuntu', 'Barlow', 'Mulish', 'Rubik', 'Quicksand', 'Karla'];
const serif = ['Merriweather', 'Playfair Display', 'Lora', 'Libre Baskerville', 'Source Serif 4', 'Noto Serif', 'IBM Plex Serif', 'DM Serif Display', 'Cormorant Garamond', 'Bitter', 'Crimson Pro', 'Spectral', 'PT Serif', 'Zilla Slab'];
const display = ['Space Grotesk', 'Oswald', 'Bebas Neue', 'Archivo Black', 'Sora', 'Syne', 'Anton', 'Lexend', 'Righteous', 'Josefin Sans'];
const mono = ['Fira Code', 'JetBrains Mono', 'IBM Plex Mono', 'Space Mono', 'Roboto Mono', 'Source Code Pro', 'Inconsolata'];
export const FONT_CATALOG: FontEntry[] = [
  ...system.map(family => ({ family, category: 'System' as const, web: false })),
  ...sans.map(family => ({ family, category: 'Sans serif' as const, web: true })),
  ...serif.map(family => ({ family, category: 'Serif' as const, web: true })),
  ...display.map(family => ({ family, category: 'Display' as const, web: true })),
  ...mono.map(family => ({ family, category: 'Monospace' as const, web: true })),
];
const loaded = new Set<string>();
export function loadFont(family: string): void {
  if (typeof document === 'undefined' || loaded.has(family) || !FONT_CATALOG.some(x => x.family === family && x.web)) return;
  loaded.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`;
  link.dataset.resumeFont = family;
  document.head.append(link);
}
