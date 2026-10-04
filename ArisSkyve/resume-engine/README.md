# Aris Resume Studio

One canonical Zod document drives **32 native React layouts**, each with web and PDF rendering. Resume Studio opens inside the existing ASP.NET application at `/Resume/Studio`. Existing CV lists and profile actions link to the editor. Documents persist in `Resumes.BuilderDataJson` under the signed-in account.

The Studio has a Word-style toolbar, categorized layout library, editable resume sections, live preview, and **69 heading/body font choices**. New users can create a blank CV and add their own information. The external discovery tab contains **609 template metadata entries**, including **70 entries with previews listed by JSON Resume**, from the catalog snapshot dated 2026-09-27. Entries expose their source, repository, available license information, and preview links. The 32 native layouts provide the integrated editing, PDF, and portfolio experience.

## Run

Use Node.js 22.18 or newer; Node 24 is supported. From `ArisSkyve/resume-engine`:

```sh
npm ci
npm run build
```

The build validates TypeScript, regenerates `contracts/canonical-resume.schema.json` directly from `src/schema.ts`, compiles Tailwind CSS utilities, bundles the application, and copies the external catalog to `ArisSkyve/wwwroot/resume-engine`. Tailwind's Preflight reset is omitted so the existing document typography and print rules remain authoritative. The output contains `app.js`, `app.css`, `utilities.css`, `external-templates.json`, and `index.html`.

Build and start the existing ASP.NET application, sign in, and open **Resume Studio** from `/Resume`. The static `/resume-engine/index.html` entry also loads the same app. Build the frontend before building/publishing ASP.NET so the embedded JSON schema and browser bundle use the same contract.

For document import, install the parser dependencies and start the local service from this folder:

```sh
python -m pip install -r server/requirements.txt
python -m uvicorn app:app --app-dir server --host 127.0.0.1 --port 8765
```

Set `OPENAI_API_KEY` in the parser process environment. `OPENAI_RESUME_MODEL` optionally selects the model; the configured default is `gpt-4o-mini`. The ASP.NET setting `ResumeEngine:ParserUrl` defaults to `http://127.0.0.1:8765`. Keep this service on a trusted network; authenticated ASP.NET endpoints proxy uploads to it.

### Optional offline OCR for scanned PDFs

The normal parser installation deliberately leaves scan OCR **disabled**. To enable the separate, explicit `layout-ocr` path, provision an offline OCR interpreter and model files first; do not point it at an environment that downloads models at request time.

```powershell
# Create this environment in an operator-controlled location, not in a user's CV folder.
python -m venv D:\ArisOcr\venv
D:\ArisOcr\venv\Scripts\python -m pip install -r server\requirements-ocr.txt

# Copy/pre-provision EasyOCR model files into this directory while following your
# organization's approved software-distribution process, then configure the parser.
$env:RESUME_OCR_PYTHON = 'D:\ArisOcr\venv\Scripts\python.exe'
$env:RESUME_OCR_MODEL_DIR = 'D:\ArisOcr\models'
$env:RESUME_OCR_LANGUAGES = 'vi,en'
$env:RESUME_OCR_GPU = '0'
python -m uvicorn app:app --app-dir server --host 127.0.0.1 --port 8765
```

`GET /api/resume-engine/capabilities` reports whether this opt-in path is available. OCR runs in a separate local process with model download disabled and network proxy variables cleared; it is not a proof that every glyph can be recovered. The Studio requires an explicit start action, then an owner acknowledgement after page-by-page comparison with the original before an OCR layout can be saved or published. PDF originals stay private per account and are removed when their saved Studio CV is deleted.

## Native layouts

| ID | Layout | Structure |
| --- | --- | --- |
| T1 | Executive Minimalist | Single column, serif headings |
| T2 | Asymmetric Modern Duo | Dark sidebar and career column |
| T3 | Bento Dashboard | Independent responsive cards |
| T4 | Terminal Dev-Log | Shell transcript and commit history |
| T5 | Swiss Editorial | Oversized editorial masthead |
| T6 | Timeline Matrix | Connected career spine |
| T7 | Compact Dense Matrix | Three compact compartments |
| T8 | Immersive Showcase | Full hero and split project sections |
| T9 | Academic Dossier | Academic rail and research record |
| T10 | Student Launchpad | Project-first early career profile |
| T11 | Product Casebook | Case studies and career narrative |
| T12 | Monochrome Ledger | Tabular professional record |
| T13 | Creative Poster | Large type and poster composition |
| T14 | Freelance Agency | Services and client portfolio |
| T15 | Corporate Modern | Structured business profile |
| T16 | Aurora Profile | Immersive hero and project gallery |
| T17 | Counsel Brief | Legal letterhead and numbered sections |
| T18 | Clinical Record | Credentials rail and appointment record |
| T19 | Research Laboratory | Abstract, methods, indexed results |
| T20 | Educator Studio | Teaching statement and resource spread |
| T21 | Revenue Scorecard | Recorded metrics and achievement column |
| T22 | Financial Report | Report masthead and experience ledger |
| T23 | Consulting Memo | Memo routing and numbered evidence |
| T24 | Data Notebook | Numbered notebook cells and outputs |
| T25 | Architecture Blueprint | Drawing title block and modular sheet |
| T26 | Journalist Edition | Newspaper masthead and unequal columns |
| T27 | Design Gallery | Asymmetric project exhibition |
| T28 | Campus Graduate | Education-first transcript and projects |
| T29 | Operations Control | Capabilities and delivery dashboard |
| T30 | Hospitality Signature | Centered signature and service menu |
| T31 | Community Impact | Mission band and contribution story |
| T32 | Essential Compact | Compact single-column reading flow |

`EngineSwitcher` accepts `{ data: CanonicalResume, templateId, mode: 'pdf' | 'landing' }`. All layouts use the same canonical fields, safe Markdown and contact rendering, experience metrics, projects, skills, education, and optional custom sections. Collections can be empty when starting a CV. Layouts adapt to a phone-width viewport and keep their structural identity on larger screens.

Web mode includes skill filtering, live project iframe/image previews, dark/light theme, share, email, and PDF actions. Remote sites can block iframe embedding; the dialog also provides a direct project link. Preview dialogs support keyboard dismissal and focus restoration. Web fonts load from Google Fonts when selected; system font availability depends on the device, and fallbacks remain available.

PDF mode uses A4 `@page` with 12 mm vertical and 15 mm horizontal margins. Print styles remove controls, decorative imagery, animation, and shadows; preserve the canonical text and project URLs; and flatten complex grids for pagination. Long documents continue onto additional pages. Native print should use A4, 100% scale, and disabled browser headers/footers. A compact layout cannot guarantee one page for arbitrary content. ATS behavior varies between products; the single-column layouts are the most direct reading order.

## External catalog

The snapshot is stored in `catalog/external-templates.json`. Refresh public metadata when network access is available:

```sh
npm run catalog:refresh
npm run build
```

`sync-templates.py` reads [JSON Resume's theme directory](https://www.jsonresume.org/themes) and npm search metadata, deduplicates package IDs, and records available previews and repository/license links. Refreshing does not install or execute external template packages. Check the linked project's license before integrating its source. Catalog counts can change with upstream availability.

## Document pipeline and storage

The parser accepts PDF, DOCX, UTF-8 text/Markdown, PNG, JPEG, and WebP. Limits include 10 MB per uploaded file, 20 PDF pages, 50,000 extracted text characters, and 10 pages requiring image recognition. PDF text comes from PyMuPDF; DOCX extraction includes paragraphs, tables, headers, and footers. Scanned pages and image files go to model vision. File expansion and decoded-image limits bound extraction work.

The Responses API requests strict structured output, then the server normalizes that extraction into the canonical contract. Its instructions preserve facts and supplied measurements, infer technology tags only from supported text, and improve wording without inventing achievements. Missing required identity information returns a reviewable draft for the editor. Both the parser and ASP.NET persistence validate the JSON schema generated from Zod.

Saved documents use an envelope:

```json
{
  "engine": "aris-resume/v1",
  "templateId": "t3",
  "published": false,
  "data": { "meta": {}, "basics": {}, "work": [], "projects": [], "skills": [], "education": [] }
}
```

The abbreviated `data` object above shows the storage shape; valid documents contain every required canonical field. Existing canonical records migrate to the envelope when saved. The owner query uses the authenticated account ID. New documents start private, template selection persists with the document, and saving an existing document preserves its publication setting.

`GET /api/resume-engine/session` provides the request verification token and authenticated `userId`; browser drafts are scoped to that account. Save, parse, publish, and unpublish requests require the token. Explicit publication exposes `/portfolio/{resumeId}` and its public JSON endpoint. Revoking publication removes public access. Public HTML contains encoded title, description, canonical URL, and Open Graph metadata generated from the resume.

## Verification and boundaries

```sh
npm run check
python -m unittest discover -s server -p "test_*.py"
dotnet build ../ArisSkyve.csproj --no-restore
```

`src/smoke.tsx` checks all 64 layout/mode combinations for preservation of canonical content, project references, and print interaction boundaries. Actual Chrome verification passed 24 Studio interaction checks against an in-memory API. Rendering checks generated 64 PDFs totaling 128 A4 pages, preserving the required text with no detected page overflow for the test fixture. Parser regression tests exercise extraction, normalization, malformed documents, structured response handling, and resource limits with mocked model responses. Ninety isolated C# checks covered schema validation, stored envelopes, publication flags, authentication rejection, antiforgery annotations, and malformed parser replies. The .NET build completed with no errors; existing unrelated warnings remain.

No real OpenAI extraction call was made during these checks. A live import requires server credentials and a reachable model endpoint. Full database-backed save/publication integration must be exercised against the deployment's database and signed-in session. The sample profile is preview content; users explicitly create, import, or save their own document.
