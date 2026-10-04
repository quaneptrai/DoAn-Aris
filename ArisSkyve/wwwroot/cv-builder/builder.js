const STORAGE_KEY = "cv-builder-data";

const defaultData = {
  template: "modern",
  accent: "#2f6fed",
  design: {
    bg: "#ffffff",
    textColor: "#1c1f26",
    fontFamily: "system",
    headingFontFamily: "", // "" = same as body font
    headerAlign: "left",
    colorMode: "multi", // "single" | "multi"
    baseSize: SCALE_MID,
    nameSize: SCALE_MID,
    headingSize: SCALE_MID,
    entrySize: SCALE_MID,
    lineHeight: SCALE_MID,
    spacing: SCALE_MID,
    marginH: 0,
    marginV: 0,
    headingStyle: "bar",
    headingCase: "uppercase", // "uppercase" | "capitalize" | "none"
    accentTargets: { name: false, title: true, headings: true, line: true, dates: false, subtitle: false },
    arrangement: "wrap", // "wrap" | "grid"
    delimiter: "dot", // "dot" | "bullet" | "bar"
    entryDatePos: "right", // "right" | "left"
    subtitlePlacement: "next", // "next" | "same"
    linkUnderline: false,
    linkAccent: false,
    pageFormat: "a4", // "a4" | "letter"
    footer: { name: false, email: false }
  },
  personal: { name: "", title: "", email: "", phone: "", location: "", website: "", photo: "" },
  sections: [] // blank by default — nothing pre-added, nothing pre-filled
};

// Old saves stored a single sm/md/lg font-size step — map to the new 9-step base-size slider.
const LEGACY_FONT_SIZE_TO_BASE_SIZE = { sm: 2, md: 4, lg: 6 };

// Converts a pre-section-engine saved CV (summary/experience/education/skills
// as top-level fields) into the new `sections` array shape.
function migrateLegacy(parsed) {
  if (parsed.sections) return parsed;
  const sections = [];
  if (parsed.summary) {
    sections.push({ id: "summary", catalogId: "summary", type: "text", content: parsed.summary });
  }
  if (Array.isArray(parsed.experience) && parsed.experience.length) {
    sections.push({ id: "experience", catalogId: "experience", type: "entries", entries: parsed.experience });
  }
  if (Array.isArray(parsed.education) && parsed.education.length) {
    sections.push({ id: "education", catalogId: "education", type: "entries", entries: parsed.education });
  }
  if (Array.isArray(parsed.skills) && parsed.skills.length) {
    sections.push({ id: "skills", catalogId: "skills", type: "tags", items: parsed.skills });
  }
  const { summary, experience, education, skills, ...rest } = parsed;
  return { ...rest, sections };
}

// Old saves predate the sidebar/main placement control — every section
// defaults to "auto" (falls back to the template's own default set).
function migrateSections(sections) {
  return (sections || []).map(s => ({ placement: "auto", ...s }));
}

function migrateDesign(oldDesign) {
  const design = { ...defaultData.design, ...(oldDesign || {}) };
  if (oldDesign && oldDesign.fontSize && LEGACY_FONT_SIZE_TO_BASE_SIZE[oldDesign.fontSize] !== undefined) {
    design.baseSize = LEGACY_FONT_SIZE_TO_BASE_SIZE[oldDesign.fontSize];
  }
  delete design.fontSize;
  design.accentTargets = { ...defaultData.design.accentTargets, ...(oldDesign && oldDesign.accentTargets) };
  design.footer = { ...defaultData.design.footer, ...(oldDesign && oldDesign.footer) };
  return design;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    const parsed = migrateLegacy(JSON.parse(raw));
    const merged = {
      ...structuredClone(defaultData),
      ...parsed,
      design: migrateDesign(parsed.design),
      personal: { ...defaultData.personal, ...(parsed.personal || {}) },
      sections: migrateSections(parsed.sections)
    };
    return merged;
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  pushHistory();
}

let data = loadData();

const urlTemplate = new URLSearchParams(location.search).get("template");
if (urlTemplate && TEMPLATES[urlTemplate]) {
  data.template = urlTemplate;
}

// ---------- DOM refs ----------

const el = {
  templateSelect: document.getElementById("templateSelect"),
  accentColorBtn: document.getElementById("accentColorBtn"),
  bgColorBtn: document.getElementById("bgColorBtn"),
  textColorBtn: document.getElementById("textColorBtn"),
  fontFamilySelect: document.getElementById("fontFamilySelect"),
  headingFontSelect: document.getElementById("headingFontSelect"),
  alignLeftBtn: document.getElementById("alignLeftBtn"),
  alignCenterBtn: document.getElementById("alignCenterBtn"),
  resetBtn: document.getElementById("resetBtn"),
  exportBtn: document.getElementById("exportBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),

  colorModeSingleBtn: document.getElementById("colorModeSingleBtn"),
  colorModeMultiBtn: document.getElementById("colorModeMultiBtn"),
  accentTargetsList: document.getElementById("accentTargetsList"),
  headingStyleGroup: document.getElementById("headingStyleGroup"),
  headingCaseGroup: document.getElementById("headingCaseGroup"),
  delimiterGroup: document.getElementById("delimiterGroup"),

  baseSizeSlider: document.getElementById("baseSizeSlider"),
  baseSizeVal: document.getElementById("baseSizeVal"),
  nameSizeSlider: document.getElementById("nameSizeSlider"),
  nameSizeVal: document.getElementById("nameSizeVal"),
  headingSizeSlider: document.getElementById("headingSizeSlider"),
  headingSizeVal: document.getElementById("headingSizeVal"),
  entrySizeSlider: document.getElementById("entrySizeSlider"),
  entrySizeVal: document.getElementById("entrySizeVal"),
  lineHeightSlider: document.getElementById("lineHeightSlider"),
  lineHeightVal: document.getElementById("lineHeightVal"),
  spacingSlider: document.getElementById("spacingSlider"),
  spacingVal: document.getElementById("spacingVal"),
  marginHSlider: document.getElementById("marginHSlider"),
  marginHVal: document.getElementById("marginHVal"),
  marginVSlider: document.getElementById("marginVSlider"),
  marginVVal: document.getElementById("marginVVal"),

  arrangementWrapBtn: document.getElementById("arrangementWrapBtn"),
  arrangementGridBtn: document.getElementById("arrangementGridBtn"),

  pageA4Btn: document.getElementById("pageA4Btn"),
  pageLetterBtn: document.getElementById("pageLetterBtn"),
  dateRightBtn: document.getElementById("dateRightBtn"),
  dateLeftBtn: document.getElementById("dateLeftBtn"),
  subtitleNextBtn: document.getElementById("subtitleNextBtn"),
  subtitleSameBtn: document.getElementById("subtitleSameBtn"),

  linkUnderlineChk: document.getElementById("linkUnderlineChk"),
  linkUnderlinePill: document.getElementById("linkUnderlinePill"),
  linkAccentChk: document.getElementById("linkAccentChk"),
  linkAccentPill: document.getElementById("linkAccentPill"),
  footerNameChk: document.getElementById("footerNameChk"),
  footerNamePill: document.getElementById("footerNamePill"),
  footerEmailChk: document.getElementById("footerEmailChk"),
  footerEmailPill: document.getElementById("footerEmailPill"),

  photoPreview: document.getElementById("photoPreview"),
  photoInput: document.getElementById("photoInput"),
  photoRemove: document.getElementById("photoRemove"),

  fullName: document.getElementById("fullName"),
  jobTitle: document.getElementById("jobTitle"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  location: document.getElementById("location"),
  website: document.getElementById("website"),

  sectionsContainer: document.getElementById("sectionsContainer"),
  addSectionBtn: document.getElementById("addSectionBtn"),

  cvScaleWrap: document.getElementById("cvScaleWrap"),
  cvPreview: document.getElementById("cvPreview"),
  cvPrintFooter: document.getElementById("cvPrintFooter")
};

const colorPopover = {
  root: document.getElementById("colorPopover"),
  grid: document.getElementById("colorGrid"),
  customInput: document.getElementById("colorCustomInput"),
};
let activeColorTarget = null; // "accent" | "bg" | "text"

const datePicker = {
  root: document.getElementById("datePickerPopover"),
  monthSelect: document.getElementById("datePickerMonthSelect"),
  yearSelect: document.getElementById("datePickerYearSelect"),
  grid: document.getElementById("datePickerGrid"),
  prevBtn: document.getElementById("datePickerPrevBtn"),
  nextBtn: document.getElementById("datePickerNextBtn"),
  todayBtn: document.getElementById("datePickerTodayBtn"),
  clearBtn: document.getElementById("datePickerClearBtn"),
};
let activeDateTarget = null; // { sectionId, index, field, buttonEl }
let dateViewMonth = null; // Date set to the 1st of the month currently shown

const sectionModal = {
  backdrop: document.getElementById("sectionModalBackdrop"),
  closeBtn: document.getElementById("sectionModalCloseBtn"),
  list: document.getElementById("sectionModalList"),
  customForm: document.getElementById("customSectionForm"),
  customInput: document.getElementById("customSectionName"),
  cancelCustomBtn: document.getElementById("cancelCustomBtn"),
  confirmCustomBtn: document.getElementById("confirmCustomBtn"),
};

// ---------- Init ----------

function populateTemplateSelect() {
  el.templateSelect.innerHTML = Object.entries(TEMPLATES).map(([id, tmpl]) =>
    `<option value="${id}">${escapeHtml(tmpl.label)}</option>`
  ).join("");
}

function populateFontFamilySelect() {
  el.fontFamilySelect.innerHTML = Object.entries(FONT_STACKS).map(([id, stack]) =>
    `<option value="${id}">${escapeHtml(stack.label)}</option>`
  ).join("");
}

function populateHeadingFontSelect() {
  el.headingFontSelect.innerHTML = `<option value="">Same as body</option>` + Object.entries(FONT_STACKS).map(([id, stack]) =>
    `<option value="${id}">${escapeHtml(stack.label)}</option>`
  ).join("");
}

function populateStaticSelects() {
  populateTemplateSelect();
  populateFontFamilySelect();
  populateHeadingFontSelect();
}

// ---------- Slider rows (9-step scales: size / spacing / margins) ----------

const sliderSyncFns = [];

function fmtPx(v) { return (Math.round(v * 10) / 10) + "px"; }
function fmtPct(v) { return Math.round(v * 100) + "%"; }
function fmtRatio(v) { return v.toFixed(2); }

function bindSlider(input, key, scaleArr, labelEl, fmt) {
  const sync = () => {
    input.value = data.design[key];
    labelEl.textContent = fmt(scaleAt(scaleArr, data.design[key]));
  };
  input.min = 0;
  input.max = scaleArr.length - 1;
  input.addEventListener("input", () => {
    data.design[key] = Number(input.value);
    sync();
    applyDesignToPreview();
    saveData();
  });
  sliderSyncFns.push(sync);
  sync();
}

function bindAllSliders() {
  bindSlider(el.baseSizeSlider, "baseSize", BASE_SIZE_PX, el.baseSizeVal, fmtPx);
  bindSlider(el.nameSizeSlider, "nameSize", NAME_SCALE, el.nameSizeVal, fmtPct);
  bindSlider(el.headingSizeSlider, "headingSize", HEADING_SCALE, el.headingSizeVal, fmtPct);
  bindSlider(el.entrySizeSlider, "entrySize", ENTRY_SCALE, el.entrySizeVal, fmtPct);
  bindSlider(el.lineHeightSlider, "lineHeight", LINE_HEIGHT_VALS, el.lineHeightVal, fmtRatio);
  bindSlider(el.spacingSlider, "spacing", SPACING_MULT, el.spacingVal, fmtPct);
  bindSlider(el.marginHSlider, "marginH", MARGIN_H_PX, el.marginHVal, fmtPx);
  bindSlider(el.marginVSlider, "marginV", MARGIN_V_PX, el.marginVVal, fmtPx);
}

// ---------- Toggle-button option groups (heading style / case / delimiter) ----------

function renderToggleOptions(container, optionsMap, current) {
  container.innerHTML = Object.entries(optionsMap).map(([key, label]) =>
    `<button type="button" class="ribbon-toggle-btn${key === current ? " is-active" : ""}" data-value="${escapeAttr(key)}">${escapeHtml(label)}</button>`
  ).join("");
}

function bindToggleGroup(container, renderFn, onPick) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    onPick(btn.dataset.value);
    renderFn();
    applyDesignToPreview();
    saveData();
  });
}

// ---------- Accent-color "apply to" checklist ----------

const ACCENT_TARGET_LABELS = { name: "Name", title: "Job title", headings: "Headings", line: "Heading line", dates: "Dates", subtitle: "Subtitle" };

function renderAccentTargetsList() {
  const t = data.design.accentTargets;
  el.accentTargetsList.innerHTML = Object.entries(ACCENT_TARGET_LABELS).map(([key, label]) => `
    <label class="ribbon-check-pill${t[key] ? " is-active" : ""}" data-key="${key}">
      <input type="checkbox" ${t[key] ? "checked" : ""}>${escapeHtml(label)}
    </label>
  `).join("");
}

el.accentTargetsList.addEventListener("change", (e) => {
  const label = e.target.closest("[data-key]");
  if (!label) return;
  data.design.accentTargets[label.dataset.key] = e.target.checked;
  label.classList.toggle("is-active", e.target.checked);
  applyDesignToPreview();
  saveData();
});

// ---------- Combined ribbon UI sync (called at init and after undo/redo) ----------

function updateDesignUI() {
  const d = data.design;

  updateColorSwatchButtons();
  el.bgColorBtn.disabled = d.colorMode === "single";
  el.textColorBtn.disabled = d.colorMode === "single";
  el.colorModeSingleBtn.classList.toggle("is-active", d.colorMode === "single");
  el.colorModeMultiBtn.classList.toggle("is-active", d.colorMode === "multi");

  renderToggleOptions(el.headingStyleGroup, HEADING_STYLES, d.headingStyle);
  renderToggleOptions(el.headingCaseGroup, HEADING_CASES, d.headingCase);
  renderToggleOptions(el.delimiterGroup, DELIMITERS, d.delimiter);
  renderAccentTargetsList();

  el.alignLeftBtn.classList.toggle("is-active", d.headerAlign === "left");
  el.alignCenterBtn.classList.toggle("is-active", d.headerAlign === "center");
  el.arrangementWrapBtn.classList.toggle("is-active", d.arrangement === "wrap");
  el.arrangementGridBtn.classList.toggle("is-active", d.arrangement === "grid");

  el.pageA4Btn.classList.toggle("is-active", d.pageFormat === "a4");
  el.pageLetterBtn.classList.toggle("is-active", d.pageFormat === "letter");
  el.dateRightBtn.classList.toggle("is-active", d.entryDatePos === "right");
  el.dateLeftBtn.classList.toggle("is-active", d.entryDatePos === "left");
  el.subtitleNextBtn.classList.toggle("is-active", d.subtitlePlacement === "next");
  el.subtitleSameBtn.classList.toggle("is-active", d.subtitlePlacement === "same");

  el.linkUnderlineChk.checked = d.linkUnderline;
  el.linkUnderlinePill.classList.toggle("is-active", d.linkUnderline);
  el.linkAccentChk.checked = d.linkAccent;
  el.linkAccentPill.classList.toggle("is-active", d.linkAccent);
  el.footerNameChk.checked = d.footer.name;
  el.footerNamePill.classList.toggle("is-active", d.footer.name);
  el.footerEmailChk.checked = d.footer.email;
  el.footerEmailPill.classList.toggle("is-active", d.footer.email);

  sliderSyncFns.forEach(fn => fn());
}

// ---------- Print page-size (A4 / Letter) — injected as its own <style> so it
// always wins over the default @page rule in style.css, which is appended
// earlier in the document. ----------

let pageSizeStyleEl = null;

function updatePageSizeStyle() {
  if (!pageSizeStyleEl) {
    pageSizeStyleEl = document.createElement("style");
    document.head.appendChild(pageSizeStyleEl);
  }
  const size = data.design.pageFormat === "letter" ? "letter" : "A4";
  pageSizeStyleEl.textContent = `@media print { @page { margin: 0; size: ${size}; } }`;
}

function updatePrintFooter() {
  const f = data.design.footer;
  const parts = [];
  if (f.name && data.personal.name) parts.push(data.personal.name);
  if (f.email && data.personal.email) parts.push(data.personal.email);
  el.cvPrintFooter.textContent = parts.join("   ·   ");
  el.cvPrintFooter.classList.toggle("is-enabled", parts.length > 0);
}

function applyDesignToPreview() {
  const d = data.design;
  const cv = el.cvPreview;

  cv.style.background = d.bg;
  cv.style.color = d.textColor;
  cv.style.fontFamily = FONT_STACKS[d.fontFamily].css;
  cv.style.fontSize = scaleAt(BASE_SIZE_PX, d.baseSize) + "px";

  cv.style.setProperty("--name-scale", scaleAt(NAME_SCALE, d.nameSize));
  cv.style.setProperty("--heading-scale", scaleAt(HEADING_SCALE, d.headingSize));
  cv.style.setProperty("--entry-scale", scaleAt(ENTRY_SCALE, d.entrySize));
  cv.style.setProperty("--line-height", scaleAt(LINE_HEIGHT_VALS, d.lineHeight));
  cv.style.setProperty("--spacing-mult", scaleAt(SPACING_MULT, d.spacing));
  cv.style.setProperty("--margin-h", scaleAt(MARGIN_H_PX, d.marginH) + "px");
  cv.style.setProperty("--margin-v", scaleAt(MARGIN_V_PX, d.marginV) + "px");
  cv.style.setProperty("--heading-case", d.headingCase);
  cv.style.setProperty("--cv-delimiter", `"${DELIMITER_CHAR[d.delimiter] || "·"}"`);
  cv.style.setProperty("--heading-font", d.headingFontFamily ? FONT_STACKS[d.headingFontFamily].css : "inherit");

  cv.classList.toggle("page-letter", d.pageFormat === "letter");
  cv.classList.toggle("arrangement-grid", d.arrangement === "grid");
  cv.classList.toggle("link-underline", d.linkUnderline);
  cv.classList.toggle("link-accent", d.linkAccent);

  HEADING_STYLE_CLASSES.forEach(cls => cv.classList.remove(cls));
  if (d.headingStyle !== "bar") cv.classList.add("heading-" + d.headingStyle);

  cv.classList.toggle("accent-name", !!d.accentTargets.name);
  cv.classList.toggle("no-accent-title", !d.accentTargets.title);
  cv.classList.toggle("no-accent-headings", !d.accentTargets.headings);
  cv.classList.toggle("no-accent-line", !d.accentTargets.line);
  cv.classList.toggle("accent-dates", !!d.accentTargets.dates);
  cv.classList.toggle("accent-subtitle", !!d.accentTargets.subtitle);

  updatePageSizeStyle();
  updatePrintFooter();
}

function syncFormFromData() {
  document.documentElement.style.setProperty("--accent", data.accent);
  el.templateSelect.value = data.template;
  el.fontFamilySelect.value = data.design.fontFamily;
  el.headingFontSelect.value = data.design.headingFontFamily || "";

  el.fullName.value = data.personal.name;
  el.jobTitle.value = data.personal.title;
  el.email.value = data.personal.email;
  el.phone.value = data.personal.phone;
  el.location.value = data.personal.location;
  el.website.value = data.personal.website;

  updatePhotoPreview();
  updateDesignUI();
  renderSectionsContainer();
  renderPreview();
}

function init() {
  populateStaticSelects();
  bindAllSliders();
  syncFormFromData();
  historyStack = [JSON.stringify(data)];
  historyIndex = 0;
  updateHistoryButtons();
}

// ---------- Basic info bindings ----------

el.fullName.addEventListener("input", (e) => { data.personal.name = e.target.value; renderPreview(); saveData(); });
el.jobTitle.addEventListener("input", (e) => { data.personal.title = e.target.value; renderPreview(); saveData(); });
el.email.addEventListener("input", (e) => { data.personal.email = e.target.value; renderPreview(); saveData(); });
el.phone.addEventListener("input", (e) => { data.personal.phone = e.target.value; renderPreview(); saveData(); });
el.location.addEventListener("input", (e) => { data.personal.location = e.target.value; renderPreview(); saveData(); });
el.website.addEventListener("input", (e) => { data.personal.website = e.target.value; renderPreview(); saveData(); });

// ---------- Photo ----------

function updatePhotoPreview() {
  el.photoPreview.src = data.personal.photo || blankAvatar();
}

el.photoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    data.personal.photo = reader.result;
    updatePhotoPreview();
    renderPreview();
    saveData();
  };
  reader.readAsDataURL(file);
});

el.photoRemove.addEventListener("click", () => {
  data.personal.photo = "";
  el.photoInput.value = "";
  updatePhotoPreview();
  renderPreview();
  saveData();
});

// ---------- Sections: form rendering ----------

function renderSectionsContainer() {
  el.sectionsContainer.innerHTML = data.sections.map(renderSectionCardHtml).join("");
}

function renderSectionCardHtml(section) {
  const label = getSectionLabel(section);
  const icon = getSectionIcon(section);
  let bodyHtml = "";

  if (section.type === "text") {
    bodyHtml = `
      <textarea class="section-text-input" data-role="text-content" rows="4" placeholder="Write your ${escapeAttr(label.toLowerCase())}...">${escapeHtml(section.content)}</textarea>
      <button type="button" class="ai-suggest-btn" data-ai-action="suggest-text" data-section-id="${escapeAttr(section.id)}" title="Suggest with AI">✨ Suggest with AI</button>
    `;
  } else if (section.type === "tags") {
    bodyHtml = `
      <div class="skill-input-row">
        <input type="text" data-role="tag-input" placeholder="Press Enter to add">
        <button type="button" class="btn btn-ghost btn-small" data-action="add-tag">Add</button>
      </div>
      <div class="skill-tags">${renderTagsFormHtml(section)}</div>
      <button type="button" class="ai-suggest-btn" data-ai-action="suggest-tags" data-section-id="${escapeAttr(section.id)}" title="Suggest with AI">✨ Suggest with AI</button>
    `;
  } else if (section.type === "entries") {
    bodyHtml = `
      <div class="repeat-list" data-role="entries-list">${renderEntriesFormHtml(section)}</div>
      <button type="button" class="btn btn-ghost btn-small" data-action="add-entry">+ Add entry</button>
    `;
  }

  const tmpl = TEMPLATES[data.template];
  const placementHtml = tmpl && tmpl.hasSidebar ? renderPlacementToggleHtml(section) : "";

  return `
    <div class="form-section section-card" data-section-id="${escapeAttr(section.id)}">
      <div class="section-card-header">
        <span class="section-drag-handle" draggable="true" data-action="drag-handle" aria-label="Drag to reorder" title="Drag to reorder">⠿</span>
        <span class="section-card-title"><span class="section-card-icon">${icon}</span>${escapeHtml(label)}</span>
        <button type="button" class="section-remove-btn" data-action="remove-section">Remove</button>
      </div>
      ${placementHtml}
      ${bodyHtml}
    </div>
  `;
}

const PLACEMENT_LABELS = { auto: "Auto", sidebar: "Sidebar", main: "Main" };

function renderPlacementToggleHtml(section) {
  const current = section.placement || "auto";
  return `
    <div class="section-placement-row">
      <span class="section-placement-label">Column</span>
      <div class="section-placement-toggle" role="group" aria-label="Column placement">
        ${Object.entries(PLACEMENT_LABELS).map(([key, lbl]) => `
          <button type="button" class="placement-toggle-btn${key === current ? " is-active" : ""}" data-action="set-placement" data-value="${key}">${lbl}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function findSection(sectionId) {
  return data.sections.find(s => s.id === sectionId);
}

function rerenderCardBody(card, section) {
  if (activeDateTarget) closeDatePicker();
  card.outerHTML = renderSectionCardHtml(section);
}

// ---------- Sections: delegated form events ----------

el.sectionsContainer.addEventListener("input", (e) => {
  const card = e.target.closest(".section-card");
  if (!card) return;
  const section = findSection(card.dataset.sectionId);
  if (!section) return;

  if (e.target.dataset.role === "text-content") {
    section.content = e.target.value;
    renderPreview();
    saveData();
    return;
  }

  const field = e.target.dataset.field;
  if (field) {
    const item = e.target.closest(".repeat-item");
    if (!item) return;
    const index = Number(item.dataset.index);
    section.entries[index][field] = e.target.value;
    renderPreview();
    saveData();
  }
});

el.sectionsContainer.addEventListener("change", (e) => {
  if (e.target.tagName !== "SELECT") return;
  const card = e.target.closest(".section-card");
  if (!card) return;
  const section = findSection(card.dataset.sectionId);
  if (!section) return;
  const field = e.target.dataset.field;
  const item = e.target.closest(".repeat-item");
  if (!field || !item) return;
  const index = Number(item.dataset.index);
  section.entries[index][field] = e.target.value;
  renderPreview();
  saveData();
});

el.sectionsContainer.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.target.dataset.role !== "tag-input") return;
  e.preventDefault();
  addTagFromInput(e.target);
});

el.sectionsContainer.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  const action = target && target.dataset.action;
  if (!action) return;
  const card = target.closest(".section-card");
  if (!card) return;
  const section = findSection(card.dataset.sectionId);
  if (!section) return;

  if (action === "remove-section") {
    data.sections = data.sections.filter(s => s.id !== section.id);
    renderSectionsContainer();
    renderPreview();
    saveData();
    return;
  }

  if (action === "add-entry") {
    section.entries.push(emptyEntry(getFieldsForSection(section)));
    rerenderCardBody(card, section);
    renderPreview();
    saveData();
    return;
  }

  if (action === "remove-entry") {
    const item = target.closest(".repeat-item");
    section.entries.splice(Number(item.dataset.index), 1);
    rerenderCardBody(card, section);
    renderPreview();
    saveData();
    return;
  }

  if (action === "add-tag") {
    addTagFromInput(card.querySelector('[data-role="tag-input"]'));
    return;
  }

  if (action === "set-placement") {
    section.placement = target.dataset.value;
    rerenderCardBody(card, section);
    renderPreview();
    saveData();
    return;
  }

  if (action === "remove-tag") {
    section.items.splice(Number(target.dataset.index), 1);
    rerenderCardBody(card, section);
    renderPreview();
    saveData();
    return;
  }

  if (action === "open-date-picker") {
    e.stopPropagation();
    const item = target.closest(".repeat-item");
    openDatePicker(section, Number(item.dataset.index), target);
  }
});

// ---------- Section reordering (drag the handle in a card's header) ----------

let draggedSectionId = null;

function clearDragOverClasses() {
  el.sectionsContainer.querySelectorAll(".drag-over-top, .drag-over-bottom").forEach(c => {
    c.classList.remove("drag-over-top", "drag-over-bottom");
  });
}

el.sectionsContainer.addEventListener("dragstart", (e) => {
  const handle = e.target.closest('[data-action="drag-handle"]');
  const card = e.target.closest(".section-card");
  if (!handle || !card) { e.preventDefault(); return; }
  draggedSectionId = card.dataset.sectionId;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", draggedSectionId);
  requestAnimationFrame(() => card.classList.add("is-dragging"));
});

el.sectionsContainer.addEventListener("dragover", (e) => {
  if (!draggedSectionId) return;
  const card = e.target.closest(".section-card");
  if (!card || card.dataset.sectionId === draggedSectionId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const rect = card.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  clearDragOverClasses();
  card.classList.add(before ? "drag-over-top" : "drag-over-bottom");
});

el.sectionsContainer.addEventListener("drop", (e) => {
  if (!draggedSectionId) return;
  const card = e.target.closest(".section-card");
  if (!card || card.dataset.sectionId === draggedSectionId) return;
  e.preventDefault();

  const rect = card.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;
  const fromIndex = data.sections.findIndex(s => s.id === draggedSectionId);
  let toIndex = data.sections.findIndex(s => s.id === card.dataset.sectionId);
  if (fromIndex === -1 || toIndex === -1) return;

  const [moved] = data.sections.splice(fromIndex, 1);
  if (fromIndex < toIndex) toIndex -= 1;
  data.sections.splice(before ? toIndex : toIndex + 1, 0, moved);

  renderSectionsContainer();
  renderPreview();
  saveData();
});

el.sectionsContainer.addEventListener("dragend", () => {
  draggedSectionId = null;
  clearDragOverClasses();
  el.sectionsContainer.querySelectorAll(".is-dragging").forEach(c => c.classList.remove("is-dragging"));
});

function addTagFromInput(inputEl) {
  if (!inputEl) return;
  const card = inputEl.closest(".section-card");
  const section = findSection(card.dataset.sectionId);
  const value = inputEl.value.trim();
  if (!value) return;
  section.items.push(value);
  rerenderCardBody(card, section);
  renderPreview();
  saveData();
}

// ---------- Custom date picker (shared popover for every date field) ----------

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function parseIsoDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function populateMonthSelect() {
  datePicker.monthSelect.innerHTML = MONTH_NAMES.map((name, i) =>
    `<option value="${i}">${name}</option>`
  ).join("");
}

function populateYearSelect(year) {
  const nowYear = new Date().getFullYear();
  const minYear = Math.min(nowYear - 100, year);
  const maxYear = Math.max(nowYear + 10, year);
  let opts = "";
  for (let y = maxYear; y >= minYear; y--) {
    opts += `<option value="${y}">${y}</option>`;
  }
  datePicker.yearSelect.innerHTML = opts;
}

function renderDatePickerGrid() {
  const year = dateViewMonth.getFullYear();
  const month = dateViewMonth.getMonth();

  datePicker.monthSelect.value = String(month);
  if (!datePicker.yearSelect.querySelector(`option[value="${year}"]`)) populateYearSelect(year);
  datePicker.yearSelect.value = String(year);

  const selectedIso = activeDateTarget ? activeDateTarget.buttonEl.dataset.value : "";
  const todayIso = toIsoDate(new Date());
  const startOffset = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  let cellsHtml = "";
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const iso = toIsoDate(cellDate);
    const classes = ["date-picker-cell"];
    if (cellDate.getMonth() !== month) classes.push("is-outside");
    if (iso === selectedIso) classes.push("is-selected");
    if (iso === todayIso) classes.push("is-today");
    cellsHtml += `<button type="button" class="${classes.join(" ")}" data-iso="${iso}">${cellDate.getDate()}</button>`;
  }
  datePicker.grid.innerHTML = cellsHtml;
}

// Shared anchored-popover positioner (color swatch / date picker / AI popovers).
// Call after the popover's "hidden" class has been removed so offsetWidth/
// offsetHeight are measurable. Clamps horizontally so it can't run off narrow
// viewports, and flips above the trigger when there isn't room below (common
// on mobile when the trigger sits low in a long scrolled form).
function positionPopover(popoverEl, anchorEl, gap = 8) {
  const rect = anchorEl.getBoundingClientRect();
  const margin = 8;
  const maxLeft = window.scrollX + window.innerWidth - popoverEl.offsetWidth - margin;
  const left = Math.max(window.scrollX + margin, Math.min(window.scrollX + rect.left, maxLeft));

  const popoverHeight = popoverEl.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom;
  const openAbove = spaceBelow < popoverHeight + gap && rect.top > popoverHeight + gap;
  const top = openAbove
    ? window.scrollY + rect.top - popoverHeight - gap
    : window.scrollY + rect.bottom + gap;

  popoverEl.style.top = top + "px";
  popoverEl.style.left = left + "px";
}

function openDatePicker(section, index, buttonEl) {
  activeDateTarget = { sectionId: section.id, index, field: buttonEl.dataset.field, buttonEl };
  buttonEl.classList.add("is-open");

  const existing = parseIsoDate(buttonEl.dataset.value);
  const base = existing || new Date();
  dateViewMonth = new Date(base.getFullYear(), base.getMonth(), 1);
  renderDatePickerGrid();

  datePicker.root.classList.remove("hidden");
  positionPopover(datePicker.root, buttonEl, 6);
}

function closeDatePicker() {
  if (activeDateTarget) activeDateTarget.buttonEl.classList.remove("is-open");
  datePicker.root.classList.add("hidden");
  activeDateTarget = null;
}

function applyDateSelection(iso) {
  if (!activeDateTarget) return;
  const { sectionId, index, field, buttonEl } = activeDateTarget;
  const section = findSection(sectionId);
  if (section) {
    section.entries[index][field] = iso;
    buttonEl.dataset.value = iso;
    buttonEl.classList.toggle("is-empty", !iso);
    buttonEl.querySelector(".date-field-value").textContent = iso ? formatDisplayDate(iso) : "Select date";
    renderPreview();
    saveData();
  }
  closeDatePicker();
}

populateMonthSelect();

datePicker.prevBtn.addEventListener("click", () => {
  dateViewMonth.setMonth(dateViewMonth.getMonth() - 1);
  renderDatePickerGrid();
});

datePicker.nextBtn.addEventListener("click", () => {
  dateViewMonth.setMonth(dateViewMonth.getMonth() + 1);
  renderDatePickerGrid();
});

datePicker.monthSelect.addEventListener("change", () => {
  dateViewMonth.setMonth(Number(datePicker.monthSelect.value));
  renderDatePickerGrid();
});

datePicker.yearSelect.addEventListener("change", () => {
  dateViewMonth.setFullYear(Number(datePicker.yearSelect.value));
  renderDatePickerGrid();
});

datePicker.grid.addEventListener("click", (e) => {
  const cell = e.target.closest(".date-picker-cell");
  if (!cell) return;
  applyDateSelection(cell.dataset.iso);
});

datePicker.todayBtn.addEventListener("click", () => {
  const today = new Date();
  dateViewMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  applyDateSelection(toIsoDate(today));
});

datePicker.clearBtn.addEventListener("click", () => applyDateSelection(""));

document.addEventListener("click", (e) => {
  if (datePicker.root.classList.contains("hidden")) return;
  const insidePopover = e.composedPath().includes(datePicker.root);
  const insideTrigger = e.target.closest(".date-field-trigger");
  if (!insidePopover && !insideTrigger) closeDatePicker();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !datePicker.root.classList.contains("hidden")) closeDatePicker();
});

// ---------- Add-section modal ----------

function openSectionModal() {
  renderSectionModalList();
  sectionModal.customForm.classList.add("hidden");
  sectionModal.list.classList.remove("hidden");
  sectionModal.backdrop.classList.remove("hidden");
}

function closeSectionModal() {
  sectionModal.backdrop.classList.add("hidden");
}

el.addSectionBtn.addEventListener("click", openSectionModal);
sectionModal.closeBtn.addEventListener("click", closeSectionModal);
sectionModal.backdrop.addEventListener("click", (e) => {
  if (e.target === sectionModal.backdrop) closeSectionModal();
});

function renderSectionModalList() {
  const addedIds = new Set(data.sections.map(s => s.catalogId));
  const available = SECTION_CATALOG.filter(c => !addedIds.has(c.id));
  sectionModal.list.innerHTML = `
    ${available.map(c => `
      <button type="button" class="modal-option" data-catalog-id="${c.id}">
        <span class="modal-option-icon">${c.icon}</span>
        <span class="modal-option-text">
          <span class="modal-option-title">${escapeHtml(c.label)}</span>
          <span class="modal-option-desc">${escapeHtml(c.desc || "")}</span>
        </span>
      </button>
    `).join("")}
    <button type="button" class="modal-option" data-catalog-id="custom">
      <span class="modal-option-icon">${CUSTOM_ICON}</span>
      <span class="modal-option-text">
        <span class="modal-option-title">Custom section</span>
        <span class="modal-option-desc">${escapeHtml(CUSTOM_DESC)}</span>
      </span>
    </button>
  `;
}

sectionModal.list.addEventListener("click", (e) => {
  const option = e.target.closest(".modal-option");
  if (!option) return;
  const catalogId = option.dataset.catalogId;

  if (catalogId === "custom") {
    sectionModal.list.classList.add("hidden");
    sectionModal.customForm.classList.remove("hidden");
    sectionModal.customInput.value = "";
    sectionModal.customInput.focus();
    return;
  }

  data.sections.push(createSectionInstance(catalogId));
  closeSectionModal();
  renderSectionsContainer();
  renderPreview();
  saveData();
});

function addCustomSection() {
  const title = sectionModal.customInput.value.trim();
  if (!title) { sectionModal.customInput.focus(); return; }
  const section = createSectionInstance("custom");
  section.title = title;
  data.sections.push(section);
  closeSectionModal();
  renderSectionsContainer();
  renderPreview();
  saveData();
}

sectionModal.confirmCustomBtn.addEventListener("click", addCustomSection);
sectionModal.cancelCustomBtn.addEventListener("click", () => {
  sectionModal.customForm.classList.add("hidden");
  sectionModal.list.classList.remove("hidden");
});
sectionModal.customInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addCustomSection();
  }
});

// ---------- Template / accent ----------

el.templateSelect.addEventListener("change", (e) => {
  data.template = e.target.value;
  renderSectionsContainer();
  renderPreview();
  saveData();
});

// ---------- Design: accent / background / text color popover ----------

function getColorValue(target) {
  if (target === "accent") return data.accent;
  if (target === "bg") return data.design.bg;
  return data.design.textColor;
}

function setColorValue(target, value) {
  if (target === "accent") {
    data.accent = value;
    document.documentElement.style.setProperty("--accent", value);
  } else if (target === "bg") {
    data.design.bg = value;
    applyDesignToPreview();
  } else {
    data.design.textColor = value;
    applyDesignToPreview();
  }
  updateColorSwatchButtons();
  saveData();
}

function updateColorSwatchButtons() {
  el.accentColorBtn.style.background = data.accent;
  el.bgColorBtn.style.background = data.design.bg;
  el.textColorBtn.style.background = data.design.textColor;
}

function renderColorGrid(target) {
  const current = getColorValue(target).toLowerCase();
  colorPopover.grid.innerHTML = COLOR_SWATCHES.map(c => `
    <button type="button" class="color-cell${c.toLowerCase() === current ? " is-selected" : ""}" style="background:${c}" data-color="${c}" aria-label="${c}"></button>
  `).join("");
}

function openColorPopover(target, anchorEl) {
  activeColorTarget = target;
  renderColorGrid(target);
  colorPopover.customInput.value = getColorValue(target);
  colorPopover.root.classList.remove("hidden");
  positionPopover(colorPopover.root, anchorEl);
}

function closeColorPopover() {
  colorPopover.root.classList.add("hidden");
  activeColorTarget = null;
}

el.accentColorBtn.addEventListener("click", (e) => { e.stopPropagation(); openColorPopover("accent", el.accentColorBtn); });
el.bgColorBtn.addEventListener("click", (e) => { e.stopPropagation(); openColorPopover("bg", el.bgColorBtn); });
el.textColorBtn.addEventListener("click", (e) => { e.stopPropagation(); openColorPopover("text", el.textColorBtn); });

colorPopover.grid.addEventListener("click", (e) => {
  const cell = e.target.closest(".color-cell");
  if (!cell || !activeColorTarget) return;
  setColorValue(activeColorTarget, cell.dataset.color);
  closeColorPopover();
});

colorPopover.customInput.addEventListener("input", (e) => {
  if (!activeColorTarget) return;
  setColorValue(activeColorTarget, e.target.value);
});

document.addEventListener("click", (e) => {
  if (colorPopover.root.classList.contains("hidden")) return;
  const insidePopover = e.composedPath().includes(colorPopover.root);
  const insideTrigger = e.target.closest(".color-swatch-btn");
  if (!insidePopover && !insideTrigger) closeColorPopover();
});

el.fontFamilySelect.addEventListener("change", (e) => {
  data.design.fontFamily = e.target.value;
  applyDesignToPreview();
  saveData();
});

el.headingFontSelect.addEventListener("change", (e) => {
  data.design.headingFontFamily = e.target.value;
  applyDesignToPreview();
  saveData();
});

function setHeaderAlign(align) {
  data.design.headerAlign = align;
  updateDesignUI();
  renderPreview();
  saveData();
}

el.alignLeftBtn.addEventListener("click", () => setHeaderAlign("left"));
el.alignCenterBtn.addEventListener("click", () => setHeaderAlign("center"));

// ---------- Design tab: color mode + heading style/case/delimiter ----------

function setColorMode(mode) {
  data.design.colorMode = mode;
  if (mode === "single") {
    data.design.bg = "#ffffff";
    data.design.textColor = "#1c1f26";
  }
  updateDesignUI();
  applyDesignToPreview();
  saveData();
}

el.colorModeSingleBtn.addEventListener("click", () => setColorMode("single"));
el.colorModeMultiBtn.addEventListener("click", () => setColorMode("multi"));

bindToggleGroup(el.headingStyleGroup, () => renderToggleOptions(el.headingStyleGroup, HEADING_STYLES, data.design.headingStyle), v => { data.design.headingStyle = v; });
bindToggleGroup(el.headingCaseGroup, () => renderToggleOptions(el.headingCaseGroup, HEADING_CASES, data.design.headingCase), v => { data.design.headingCase = v; });
bindToggleGroup(el.delimiterGroup, () => renderToggleOptions(el.delimiterGroup, DELIMITERS, data.design.delimiter), v => { data.design.delimiter = v; });

// ---------- Layout tab: contact arrangement ----------

function setArrangement(v) {
  data.design.arrangement = v;
  updateDesignUI();
  applyDesignToPreview();
  saveData();
}

el.arrangementWrapBtn.addEventListener("click", () => setArrangement("wrap"));
el.arrangementGridBtn.addEventListener("click", () => setArrangement("grid"));

// ---------- Page tab: page format / entry layout / links / footer ----------

function setPageFormat(v) {
  data.design.pageFormat = v;
  updateDesignUI();
  applyDesignToPreview();
  saveData();
}

el.pageA4Btn.addEventListener("click", () => setPageFormat("a4"));
el.pageLetterBtn.addEventListener("click", () => setPageFormat("letter"));

function setEntryDatePos(v) {
  data.design.entryDatePos = v;
  updateDesignUI();
  renderPreview();
  saveData();
}

el.dateRightBtn.addEventListener("click", () => setEntryDatePos("right"));
el.dateLeftBtn.addEventListener("click", () => setEntryDatePos("left"));

function setSubtitlePlacement(v) {
  data.design.subtitlePlacement = v;
  updateDesignUI();
  renderPreview();
  saveData();
}

el.subtitleNextBtn.addEventListener("click", () => setSubtitlePlacement("next"));
el.subtitleSameBtn.addEventListener("click", () => setSubtitlePlacement("same"));

el.linkUnderlineChk.addEventListener("change", () => {
  data.design.linkUnderline = el.linkUnderlineChk.checked;
  el.linkUnderlinePill.classList.toggle("is-active", data.design.linkUnderline);
  applyDesignToPreview();
  saveData();
});

el.linkAccentChk.addEventListener("change", () => {
  data.design.linkAccent = el.linkAccentChk.checked;
  el.linkAccentPill.classList.toggle("is-active", data.design.linkAccent);
  applyDesignToPreview();
  saveData();
});

el.footerNameChk.addEventListener("change", () => {
  data.design.footer.name = el.footerNameChk.checked;
  el.footerNamePill.classList.toggle("is-active", data.design.footer.name);
  applyDesignToPreview();
  saveData();
});

el.footerEmailChk.addEventListener("change", () => {
  data.design.footer.email = el.footerEmailChk.checked;
  el.footerEmailPill.classList.toggle("is-active", data.design.footer.email);
  applyDesignToPreview();
  saveData();
});

// ---------- Ribbon tab switching ----------

document.querySelectorAll(".ribbon-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".ribbon-tab").forEach(t => t.classList.toggle("is-active", t === tab));
    document.querySelectorAll(".ribbon-panel").forEach(p => p.classList.toggle("is-active", p.dataset.panel === tab.dataset.tab));
  });
});

// ---------- Design options panel: show/hide (mobile) + reparent (desktop vs mobile) ----------
// Desktop: the panel lives in .app-header and CSS always shows it (no
// collapse control there — see the min-width:901px block in style.css).
// Mobile: it lives at the top of .form-panel as a collapsible card, collapsed
// by default, so opening it never covers the CV preview.

const designPanelToggleBtn = document.getElementById("designPanelToggleBtn");
const ribbonToolbar = document.getElementById("ribbonToolbar");

designPanelToggleBtn.addEventListener("click", () => {
  const expanded = ribbonToolbar.classList.toggle("is-expanded");
  designPanelToggleBtn.classList.toggle("is-active", expanded);
  designPanelToggleBtn.setAttribute("aria-expanded", String(expanded));
});

const designPanelCard = document.getElementById("designPanelCard");
const appHeaderEl = document.querySelector(".app-header");
const formPanelEl = document.querySelector(".form-panel");
const desktopMq = window.matchMedia("(min-width: 901px)");

function placeDesignPanel(isDesktop) {
  if (isDesktop) {
    appHeaderEl.appendChild(designPanelCard);
  } else {
    formPanelEl.insertBefore(designPanelCard, formPanelEl.firstChild);
  }
}

placeDesignPanel(desktopMq.matches);
desktopMq.addEventListener("change", (e) => placeDesignPanel(e.matches));

// ---------- Ribbon resize (desktop only) ----------
// Drag #ribbonResizeHandle to resize #ribbonScrollArea's height. Its CSS
// default (style.css, 140px) is already smaller than most tabs' full
// content, so there's something to scroll/grow from the moment you land on
// the page. Persisted separately from CV data since it's a per-machine UI
// preference, not something that belongs in an exported/shared CV.

const RIBBON_HEIGHT_KEY = "cv-builder-ribbon-height";
const RIBBON_MIN_HEIGHT = 60;
const RIBBON_MAX_HEIGHT = 360;

const ribbonScrollArea = document.getElementById("ribbonScrollArea");
const ribbonResizeHandle = document.getElementById("ribbonResizeHandle");

function applyRibbonHeight(px) {
  ribbonScrollArea.style.height = px == null
    ? ""
    : Math.max(RIBBON_MIN_HEIGHT, Math.min(RIBBON_MAX_HEIGHT, px)) + "px";
}

const savedRibbonHeight = Number(localStorage.getItem(RIBBON_HEIGHT_KEY));
if (savedRibbonHeight) applyRibbonHeight(savedRibbonHeight);

let ribbonDragStartY = null;
let ribbonDragStartHeight = null;

ribbonResizeHandle.addEventListener("pointerdown", (e) => {
  if (!desktopMq.matches) return;
  ribbonDragStartY = e.clientY;
  ribbonDragStartHeight = ribbonScrollArea.getBoundingClientRect().height;
  ribbonResizeHandle.setPointerCapture(e.pointerId);
  document.body.classList.add("is-resizing-ribbon");
});

ribbonResizeHandle.addEventListener("pointermove", (e) => {
  if (ribbonDragStartY === null) return;
  applyRibbonHeight(ribbonDragStartHeight + (e.clientY - ribbonDragStartY));
});

function endRibbonDrag() {
  if (ribbonDragStartY === null) return;
  ribbonDragStartY = null;
  document.body.classList.remove("is-resizing-ribbon");
  if (ribbonScrollArea.style.height) {
    localStorage.setItem(RIBBON_HEIGHT_KEY, parseInt(ribbonScrollArea.style.height, 10));
  }
}

ribbonResizeHandle.addEventListener("pointerup", endRibbonDrag);
ribbonResizeHandle.addEventListener("pointercancel", endRibbonDrag);

ribbonResizeHandle.addEventListener("dblclick", () => {
  applyRibbonHeight(null);
  localStorage.removeItem(RIBBON_HEIGHT_KEY);
});

// ---------- Ribbon collapse triangle (desktop only) ----------
// Fully collapses the ribbon (tabs included) down to just the bottom bar,
// handing that space back to the form/CV below. Persisted like the height.

const RIBBON_COLLAPSED_KEY = "cv-builder-ribbon-collapsed";
const ribbonCollapseBtn = document.getElementById("ribbonCollapseBtn");

function setRibbonCollapsed(collapsed) {
  ribbonToolbar.classList.toggle("is-collapsed", collapsed);
  ribbonCollapseBtn.setAttribute("aria-expanded", String(!collapsed));
}

setRibbonCollapsed(localStorage.getItem(RIBBON_COLLAPSED_KEY) === "1");

ribbonCollapseBtn.addEventListener("click", () => {
  const collapsed = !ribbonToolbar.classList.contains("is-collapsed");
  setRibbonCollapsed(collapsed);
  localStorage.setItem(RIBBON_COLLAPSED_KEY, collapsed ? "1" : "0");
});

// ---------- Mobile Edit / Preview switcher ----------
// Lets you jump straight to the CV on mobile instead of scrolling past the
// whole form. No-op on desktop, where both panels always show side by side.

const mobileViewButtons = document.querySelectorAll(".mobile-view-btn");
const mainLayoutEl = document.querySelector("main.layout");

mobileViewButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    mobileViewButtons.forEach(b => b.classList.toggle("is-active", b === btn));
    mainLayoutEl.classList.toggle("mobile-view-preview", btn.dataset.view === "preview");
    // #cvScaleWrap was display:none while on the Edit tab, so its width
    // couldn't be measured — recompute now that it's visible again.
    updatePreviewScale();
  });
});

// ---------- Undo / redo ----------

let historyStack = [];
let historyIndex = -1;
let suppressHistory = false;
let historyDebounceTimer = null;

function pushHistory() {
  if (suppressHistory) return;
  clearTimeout(historyDebounceTimer);
  historyDebounceTimer = setTimeout(() => {
    const snapshot = JSON.stringify(data);
    if (historyStack[historyIndex] === snapshot) return;
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(snapshot);
    if (historyStack.length > 60) historyStack.shift();
    historyIndex = historyStack.length - 1;
    updateHistoryButtons();
  }, 400);
}

function updateHistoryButtons() {
  el.undoBtn.disabled = historyIndex <= 0;
  el.redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

function restoreFromHistory(index) {
  suppressHistory = true;
  data = JSON.parse(historyStack[index]);
  historyIndex = index;
  syncFormFromData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  suppressHistory = false;
  updateHistoryButtons();
}

function undo() { if (historyIndex > 0) restoreFromHistory(historyIndex - 1); }
function redo() { if (historyIndex < historyStack.length - 1) restoreFromHistory(historyIndex + 1); }

el.undoBtn.addEventListener("click", undo);
el.redoBtn.addEventListener("click", redo);

document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
});

// ---------- Reset / export ----------

el.resetBtn.addEventListener("click", () => {
  if (!confirm("Clear all fields and start over? This cannot be undone.")) return;
  const keepTemplate = data.template;
  data = structuredClone(defaultData);
  data.template = keepTemplate;
  localStorage.removeItem(STORAGE_KEY);
  init();
});

el.exportBtn.addEventListener("click", () => {
  window.print();
});

// ---------- Preview rendering ----------

function renderPreview() {
  const tmpl = TEMPLATES[data.template] || TEMPLATES.modern;
  const sectionsHtmlMap = {};
  data.sections.forEach(s => { sectionsHtmlMap[s.id] = renderSectionPreviewHtml(s, data.design); });
  const alignClass = data.design.headerAlign === "center" ? " cv-align-center" : "";
  el.cvPreview.className = `cv ${tmpl.skinClass}${alignClass}`;
  el.cvPreview.innerHTML = tmpl.layout(data.personal, sectionsHtmlMap, data.sections);
  applyDesignToPreview();
  updatePreviewScale();
}

// ---------- Responsive preview scaling ----------
// .cv is a fixed real-world page size (210mm/215.9mm). Below that width the
// wrap can't fit it at 1:1, so shrink it with a transform (offsetWidth/
// scrollHeight are unaffected by transform, so this is safe to recompute
// repeatedly without ever measuring our own scaled-down output).

function updatePreviewScale() {
  const wrap = el.cvScaleWrap;
  if (!wrap || !el.cvPreview.offsetWidth) return;
  const naturalWidth = el.cvPreview.offsetWidth;
  const naturalHeight = el.cvPreview.scrollHeight;
  const available = wrap.clientWidth;
  const scale = Math.min(1, available / naturalWidth);
  el.cvPreview.style.transformOrigin = "top left";
  el.cvPreview.style.transform = scale < 1 ? `scale(${scale})` : "";
  el.cvPreview.style.marginLeft = Math.max(0, (available - naturalWidth) / 2) + "px";
  wrap.style.height = Math.ceil(naturalHeight * scale) + "px";
}

let previewScaleRaf = null;
function schedulePreviewScale() {
  if (previewScaleRaf) cancelAnimationFrame(previewScaleRaf);
  previewScaleRaf = requestAnimationFrame(updatePreviewScale);
}

window.addEventListener("resize", schedulePreviewScale);

init();
updatePreviewScale();
