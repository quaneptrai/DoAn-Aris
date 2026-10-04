let selectedTemplateId = null;

const BUILDER_DRAFT_KEY = "cv-builder-data";
const BUILDER_TARGET_KEY = "cv-builder-resume-id";

function validResumeId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function clearNewDraft() {
  // A fresh template must not inherit either the contents or the server target
  // of the CV that happened to be edited previously in this browser.
  localStorage.removeItem(BUILDER_DRAFT_KEY);
  localStorage.removeItem(BUILDER_TARGET_KEY);
}

// ---------- Sample CV used to render a live preview thumbnail for every template ----------
// (Same rendering engine as the real builder — sectionsHtmlMap is built once with
// sections.js's renderSectionPreviewHtml and reused across every template card.)

const SAMPLE_PERSONAL = {
  name: "Jane Doe",
  title: "Product Designer",
  email: "jane@example.com",
  phone: "+1 555 123 4567",
  location: "New York, NY",
  website: "linkedin.com/in/janedoe",
  photo: ""
};

const SAMPLE_SECTIONS = [
  { id: "summary", catalogId: "summary", type: "text",
    content: "Product designer with 6+ years crafting user-centered interfaces for SaaS products." },
  { id: "experience", catalogId: "experience", type: "entries", entries: [
    { role: "Senior Product Designer", company: "Acme Inc.", start: "2022-01-01", end: "",
      description: "Led design for the core dashboard, improving activation by 18%." },
    { role: "Product Designer", company: "Northwind Co.", start: "2019-03-01", end: "2021-12-01",
      description: "Owned end-to-end design for the onboarding flow." }
  ]},
  { id: "education", catalogId: "education", type: "entries", entries: [
    { school: "State University", degree: "B.A. Graphic Design", start: "2015-09-01", end: "2019-05-01" }
  ]},
  { id: "skills", catalogId: "skills", type: "tags",
    items: ["Figma", "Design Systems", "User Research", "Prototyping"] }
];

// A representative accent color per template, so each preview keeps its own
// identity instead of every card showing the same default blue.
const PREVIEW_ACCENTS = {
  modern: "#3b6fed", classic: "#2f6fed", executive: "#7a4a52", elegant: "#b82a38",
  banner: "#f4a623", compact: "#1f3a52", ivy: "#1c1f26", timeline: "#c2660b",
  condensed: "#2f6fed", boxed: "#2f6fed", ledger: "#14171f", halo: "#d63384",
  sidelight: "#1f3a52", ribbon: "#495057", mono: "#43aa8b", panel: "#6f5cf2"
};

function buildSampleSectionsHtmlMap() {
  const map = {};
  SAMPLE_SECTIONS.forEach(s => { map[s.id] = renderSectionPreviewHtml(s); });
  return map;
}

function renderGallery() {
  const gallery = document.getElementById("templateGallery");
  const sectionsHtmlMap = buildSampleSectionsHtmlMap();

  gallery.innerHTML = Object.entries(TEMPLATES).map(([id, tmpl]) => `
    <button type="button" class="template-card" data-template-id="${id}">
      <div class="template-card-preview">
        <div class="template-card-cv-stage" style="--accent:${PREVIEW_ACCENTS[id] || "#2f6fed"};">
          <div class="cv ${tmpl.skinClass}">${tmpl.layout(SAMPLE_PERSONAL, sectionsHtmlMap, SAMPLE_SECTIONS)}</div>
        </div>
      </div>
      <div class="template-card-label">${tmpl.label}</div>
    </button>
  `).join("");
}

const modal = {
  backdrop: document.getElementById("startModalBackdrop"),
  templateName: document.getElementById("modalTemplateName"),
  closeBtn: document.getElementById("modalCloseBtn"),
  scratchOption: document.getElementById("scratchOption"),
  importOption: document.getElementById("importOption"),
  importNote: document.getElementById("importNote"),
};

function openModal(templateId) {
  selectedTemplateId = templateId;
  modal.templateName.textContent = TEMPLATES[templateId].label;
  modal.importNote.classList.add("hidden");
  modal.backdrop.classList.remove("hidden");
}

function closeModal() {
  modal.backdrop.classList.add("hidden");
  selectedTemplateId = null;
}

document.getElementById("templateGallery").addEventListener("click", (e) => {
  const card = e.target.closest(".template-card");
  if (!card) return;
  openModal(card.dataset.templateId);
});

modal.closeBtn.addEventListener("click", closeModal);
modal.backdrop.addEventListener("click", (e) => {
  if (e.target === modal.backdrop) closeModal();
});

modal.scratchOption.addEventListener("click", async () => {
  if (!selectedTemplateId) return;
  // Mint a target row before entering the builder.  Never fall back to a URL without
  // resumeId: the old fallback could save into the candidate's first CV.
  modal.scratchOption.disabled = true;
  try {
    const headers = await window.ArisCsrf.headers();
    const res = await fetch("/Resume/CreateBlank", { method: "POST", headers });
    if (!res.ok) throw new Error("CreateBlank failed (" + res.status + ")");
    const result = await res.json();
    const resumeId = validResumeId(result && result.resumeId);
    if (!resumeId) throw new Error("CreateBlank did not return a resume id");
    // Keep the old local draft intact until the server has actually minted a
    // distinct target.  If this request fails, the user can still return to it.
    clearNewDraft();
    location.href = "builder.html?template=" + encodeURIComponent(selectedTemplateId) + "&resumeId=" + encodeURIComponent(resumeId);
  } catch {
    modal.importNote.textContent = "Không thể tạo CV mới lúc này. CV hiện có của bạn chưa bị thay đổi; vui lòng thử lại.";
    modal.importNote.classList.remove("hidden");
    modal.scratchOption.disabled = false;
  }
});

modal.importOption.addEventListener("click", () => {
  modal.importNote.classList.remove("hidden");
});

// ---------- "Continue your CV" banner (only shown if a saved CV exists) ----------

function renderResumeBanner() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(BUILDER_DRAFT_KEY)); } catch { saved = null; }
  if (!saved) return;

  const hasContent = (saved.personal && (saved.personal.name || saved.personal.title))
    || (Array.isArray(saved.sections) && saved.sections.length > 0);
  if (!hasContent) return;

  const name = (saved.personal && saved.personal.name) || "Untitled CV";
  const tmpl = TEMPLATES[saved.template];
  document.getElementById("resumeBannerSub").textContent = `${name} · ${tmpl ? tmpl.label : "Custom"} template`;
  const targetId = validResumeId(localStorage.getItem(BUILDER_TARGET_KEY));
  // Keep the continuation URL explicit when the draft already belongs to a
  // saved CV.  A local-only draft intentionally has no id and will create its
  // own row on the first normal save.
  if (targetId) {
    document.getElementById("resumeBannerBtn").href = "builder.html?resumeId=" + encodeURIComponent(targetId);
  }
  document.getElementById("resumeBanner").classList.remove("hidden");
}

renderGallery();
renderResumeBanner();
