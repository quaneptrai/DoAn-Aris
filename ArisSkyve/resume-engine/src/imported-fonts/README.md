# Imported-layout font fallbacks

The resume engine ships complete local TTF families for PDF text that names
common Office fonts. They use private `Aris ...` CSS family names, so a device
without Office cannot substitute an unrelated installed font.

| Source PDF family | Local fallback | Metric-compatible target |
| --- | --- | --- |
| Calibri | Carlito | Calibri |
| Cambria | Caladea | Cambria |
| Arial / Helvetica | Arimo | Arial |
| Times New Roman | Tinos | Times New Roman |
| Courier New | Cousine | Courier New |

## Provenance and license

The TTF binaries were fetched from the official Google Fonts CSS endpoint on
2026-10-04, using static `400`/`700` normal and italic faces:

`https://fonts.googleapis.com/css2?family=Carlito:ital,wght@0,400;0,700;1,400;1,700&family=Arimo:ital,wght@0,400;0,700;1,400;1,700&family=Tinos:ital,wght@0,400;0,700;1,400;1,700&family=Caladea:ital,wght@0,400;0,700;1,400;1,700&family=Cousine:ital,wght@0,400;0,700;1,400;1,700&display=block`

All five sources use SIL Open Font License 1.1. The unmodified upstream
license texts are stored beside the binaries:

- Carlito: `https://github.com/googlefonts/carlito`
- Arimo: `https://github.com/googlefonts/arimo`
- Tinos: `https://github.com/googlefonts/tinos`
- Caladea: `https://github.com/huertatipografica/Caladea`
- Cousine: `https://github.com/googlefonts/cousine`
