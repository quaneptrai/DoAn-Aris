// ---------- Utils ----------

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function formatDisplayDate(value) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function blankAvatar() {
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="100%" height="100%" fill="#e2e5ea"/></svg>'
  );
}

// ---------- Section catalog ----------
// Every possible section a user can add. `type` drives which generic
// form/preview renderer is used: "text" | "tags" | "entries".

const SECTION_CATALOG = [
  { id: "summary", label: "Summary", icon: "📝", type: "text",
    desc: "A short pitch highlighting who you are and what you bring." },
  { id: "experience", label: "Professional Experience", icon: "💼", type: "entries",
    desc: "Your past jobs, roles, and responsibilities.",
    fields: [
      { key: "role", label: "Role", role: "title", input: "text" },
      { key: "company", label: "Company", role: "subtitle", input: "text" },
      { key: "start", label: "Start", role: "dateStart", input: "date" },
      { key: "end", label: "End", role: "dateEnd", input: "date" },
      { key: "description", label: "Description", role: "description", input: "textarea" },
  ]},
  { id: "education", label: "Education", icon: "🎓", type: "entries",
    desc: "Your academic background — schools, degrees, and dates.",
    fields: [
      { key: "school", label: "School", role: "title", input: "text" },
      { key: "degree", label: "Degree", role: "subtitle", input: "text" },
      { key: "start", label: "Start", role: "dateStart", input: "date" },
      { key: "end", label: "End", role: "dateEnd", input: "date" },
  ]},
  { id: "skills", label: "Skills", icon: "🛠️", type: "tags",
    desc: "Key skills and tools, shown as quick tags." },
  { id: "languages", label: "Languages", icon: "🌐", type: "entries",
    desc: "Languages you speak and your fluency level.",
    fields: [
      { key: "name", label: "Language", role: "title", input: "text" },
      { key: "level", label: "Level", role: "subtitle", input: "select",
        options: ["Basic", "Conversational", "Fluent", "Native"] },
  ]},
  { id: "certificates", label: "Certificates", icon: "📜", type: "entries",
    desc: "Professional certifications you've earned.",
    fields: [
      { key: "name", label: "Certificate", role: "title", input: "text" },
      { key: "issuer", label: "Issuer", role: "subtitle", input: "text" },
      { key: "date", label: "Date", role: "dateStart", input: "date" },
  ]},
  { id: "interests", label: "Interests", icon: "🎯", type: "tags",
    desc: "Hobbies and interests that show personality." },
  { id: "projects", label: "Projects", icon: "🚀", type: "entries",
    desc: "Notable projects you've built or contributed to.",
    fields: [
      { key: "name", label: "Project name", role: "title", input: "text" },
      { key: "link", label: "Link", role: "subtitle", input: "text" },
      { key: "date", label: "Date", role: "dateStart", input: "date" },
      { key: "description", label: "Description", role: "description", input: "textarea" },
  ]},
  { id: "courses", label: "Courses", icon: "📚", type: "entries",
    desc: "Courses you've completed outside formal education.",
    fields: [
      { key: "name", label: "Course", role: "title", input: "text" },
      { key: "provider", label: "Provider", role: "subtitle", input: "text" },
      { key: "date", label: "Date", role: "dateStart", input: "date" },
  ]},
  { id: "awards", label: "Awards", icon: "🏆", type: "entries",
    desc: "Awards and recognitions you've received.",
    fields: [
      { key: "name", label: "Award", role: "title", input: "text" },
      { key: "issuer", label: "Issuer", role: "subtitle", input: "text" },
      { key: "date", label: "Date", role: "dateStart", input: "date" },
  ]},
  { id: "organisations", label: "Organisations", icon: "🏛️", type: "entries",
    desc: "Clubs, associations, or organisations you're part of.",
    fields: [
      { key: "name", label: "Organisation", role: "title", input: "text" },
      { key: "role", label: "Role", role: "subtitle", input: "text" },
      { key: "start", label: "Start", role: "dateStart", input: "date" },
      { key: "end", label: "End", role: "dateEnd", input: "date" },
  ]},
  { id: "publications", label: "Publications", icon: "📰", type: "entries",
    desc: "Articles, papers, or other works you've published.",
    fields: [
      { key: "title", label: "Title", role: "title", input: "text" },
      { key: "publisher", label: "Publisher", role: "subtitle", input: "text" },
      { key: "date", label: "Date", role: "dateStart", input: "date" },
      { key: "link", label: "Link", role: "description", input: "text" },
  ]},
  { id: "references", label: "References", icon: "🤝", type: "entries",
    desc: "Contacts who can vouch for your work.",
    fields: [
      { key: "name", label: "Name", role: "title", input: "text" },
      { key: "relation", label: "Relationship", role: "subtitle", input: "text" },
      { key: "contact", label: "Contact", role: "description", input: "text" },
  ]},
  { id: "declaration", label: "Declaration", icon: "✍️", type: "text",
    desc: "A formal statement or signature line, if required." },
];

const CUSTOM_ICON = "📌";
const CUSTOM_DESC = "Add your own section with a title you choose.";

const CUSTOM_FIELDS = [
  { key: "title", label: "Title", role: "title", input: "text" },
  { key: "description", label: "Description", role: "description", input: "textarea" },
];

function getCatalogEntry(catalogId) {
  return SECTION_CATALOG.find(c => c.id === catalogId);
}

function getFieldsForSection(section) {
  if (section.catalogId === "custom") return CUSTOM_FIELDS;
  const cat = getCatalogEntry(section.catalogId);
  return cat ? cat.fields : [];
}

function getSectionLabel(section) {
  if (section.catalogId === "custom") return section.title || "Custom section";
  const cat = getCatalogEntry(section.catalogId);
  return cat ? cat.label : "Section";
}

function getSectionIcon(section) {
  if (section.catalogId === "custom") return CUSTOM_ICON;
  const cat = getCatalogEntry(section.catalogId);
  return cat ? cat.icon : "📌";
}

// ---------- Factory ----------

function createSectionInstance(catalogId) {
  if (catalogId === "custom") {
    return {
      id: "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      catalogId: "custom",
      type: "entries",
      title: "",
      entries: [],
      placement: "auto",
    };
  }
  const cat = getCatalogEntry(catalogId);
  if (!cat) throw new Error("Unknown section: " + catalogId);
  if (cat.type === "entries") return { id: catalogId, catalogId, type: "entries", entries: [], placement: "auto" };
  if (cat.type === "tags") return { id: catalogId, catalogId, type: "tags", items: [], placement: "auto" };
  return { id: catalogId, catalogId, type: "text", content: "", placement: "auto" };
}

function emptyEntry(fields) {
  const entry = {};
  fields.forEach(f => { entry[f.key] = ""; });
  return entry;
}

// ---------- Content check (drives what shows in the live preview) ----------

function hasContent(section) {
  if (section.type === "text") return Boolean(section.content && section.content.trim());
  if (section.type === "tags") return Boolean(section.items && section.items.length);
  if (section.type === "entries") {
    return Boolean(section.entries && section.entries.some(entryHasContent));
  }
  return false;
}

function entryHasContent(entry) {
  return Object.values(entry).some(v => v && String(v).trim());
}

// ---------- Form rendering (HTML strings, wired up via delegated events in builder.js) ----------

function renderFieldInputHtml(field, value, sectionId, entryIndex) {
  const val = value || "";
  if (field.input === "textarea") {
    return `<label>${escapeHtml(field.label)}
      <textarea rows="3" data-field="${field.key}">${escapeHtml(val)}</textarea>
      <button type="button" class="ai-suggest-btn" data-ai-action="suggest-text" data-section-id="${escapeAttr(sectionId)}" data-entry-index="${entryIndex}" data-field-key="${field.key}" title="Suggest with AI">✨ Suggest</button>
    </label>`;
  }
  if (field.input === "select") {
    const opts = (field.options || []).map(o =>
      `<option value="${escapeAttr(o)}" ${o === val ? "selected" : ""}>${escapeHtml(o)}</option>`
    ).join("");
    return `<label>${escapeHtml(field.label)}<select data-field="${field.key}"><option value="">Select…</option>${opts}</select></label>`;
  }
  if (field.input === "date") {
    const display = val ? formatDisplayDate(val) : "Select date";
    return `<label>${escapeHtml(field.label)}
      <button type="button" class="date-field-trigger${val ? "" : " is-empty"}" data-action="open-date-picker" data-field="${field.key}" data-value="${escapeAttr(val)}">
        <span class="date-field-value">${escapeHtml(display)}</span>
        <span class="date-field-icon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"></rect><path d="M3 9.5h18"></path><path d="M8 3v3M16 3v3"></path></svg>
        </span>
      </button>
    </label>`;
  }
  return `<label>${escapeHtml(field.label)}<input type="text" data-field="${field.key}" value="${escapeAttr(val)}"></label>`;
}

function renderEntriesFormHtml(section) {
  const fields = getFieldsForSection(section);
  if (!section.entries.length) {
    return `<p class="section-empty-hint">No entries yet.</p>`;
  }
  return section.entries.map((entry, i) => `
    <div class="repeat-item" data-index="${i}">
      <button type="button" class="remove-btn" data-action="remove-entry">Remove</button>
      ${fields.map(f => renderFieldInputHtml(f, entry[f.key], section.id, i)).join("")}
    </div>
  `).join("");
}

function renderTagsFormHtml(section) {
  return (section.items || []).map((item, i) => `
    <span class="skill-tag">
      ${escapeHtml(item)}
      <button type="button" data-action="remove-tag" data-index="${i}" aria-label="Remove">&times;</button>
    </span>
  `).join("");
}

// ---------- Preview rendering ----------

function renderEntryPreviewHtml(entry, fields, design) {
  if (!entryHasContent(entry)) return "";
  const title = fields.find(f => f.role === "title");
  const subtitle = fields.find(f => f.role === "subtitle");
  const ds = fields.find(f => f.role === "dateStart");
  const de = fields.find(f => f.role === "dateEnd");
  const desc = fields.find(f => f.role === "description");
  const dateRange = [ds && formatDisplayDate(entry[ds.key]), de && formatDisplayDate(entry[de.key])].filter(Boolean).join(" – ");
  const titleText = title ? entry[title.key] : "";
  const subtitleText = subtitle && entry[subtitle.key] ? entry[subtitle.key] : "";

  const sameLine = design && design.subtitlePlacement === "same" && subtitleText;
  const titleCellText = sameLine ? `${titleText}, ${subtitleText}` : titleText;

  const dateLeft = design && design.entryDatePos === "left";
  const headerSpans = dateLeft
    ? `${dateRange ? `<span>${escapeHtml(dateRange)}</span>` : "<span></span>"}<span>${escapeHtml(titleCellText)}</span>`
    : `<span>${escapeHtml(titleCellText)}</span>${dateRange ? `<span>${escapeHtml(dateRange)}</span>` : ""}`;

  return `
    <div class="cv-entry">
      <div class="cv-entry-header">
        ${headerSpans}
      </div>
      ${!sameLine && subtitleText ? `<div class="cv-entry-sub">${escapeHtml(subtitleText)}</div>` : ""}
      ${desc && entry[desc.key] ? `<div class="cv-entry-desc">${escapeHtml(entry[desc.key])}</div>` : ""}
    </div>`;
}

function renderSectionPreviewHtml(section, design) {
  if (!hasContent(section)) return "";
  const label = getSectionLabel(section);
  let bodyHtml = "";
  if (section.type === "text") {
    bodyHtml = `<div class="cv-entry-desc">${escapeHtml(section.content)}</div>`;
  } else if (section.type === "tags") {
    bodyHtml = `<div class="skill-tags-preview">${section.items.map(s => `<span class="skill-pill">${escapeHtml(s)}</span>`).join("")}</div>`;
  } else if (section.type === "entries") {
    const fields = getFieldsForSection(section);
    bodyHtml = section.entries.map(e => renderEntryPreviewHtml(e, fields, design)).join("");
  }
  return `<div class="cv-section"><div class="cv-section-title">${escapeHtml(label)}</div>${bodyHtml}</div>`;
}
