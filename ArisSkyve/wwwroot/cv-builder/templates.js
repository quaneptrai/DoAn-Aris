// ---------- Header block (name/photo/contact) shared by every template ----------
// variant: "sidebar" (Modern) | "classic"

function contactItemsHtml(personal) {
  const items = [
    { text: personal.email, link: false },
    { text: personal.phone, link: false },
    { text: personal.location, link: false },
    { text: personal.website, link: true }
  ].filter(i => i.text);
  return items.map(i => `<span class="cv-contact-item${i.link ? " cv-contact-link" : ""}">${escapeHtml(i.text)}</span>`).join("");
}

function headerBlock(personal, variant) {
  const photoSrc = personal.photo || blankAvatar();
  const contactHtml = contactItemsHtml(personal);

  if (variant === "sidebar") {
    return `
      <img class="cv-photo" src="${photoSrc}" alt="">
      <div>
        <div class="cv-name">${escapeHtml(personal.name || "Your Name")}</div>
        <div class="cv-title">${escapeHtml(personal.title || "Your Title")}</div>
      </div>
      ${contactHtml ? `
      <div>
        <div class="cv-section-title">Contact</div>
        <div class="cv-contact-line cv-contact-stack">${contactHtml}</div>
      </div>` : ""}
    `;
  }

  return `
    <div class="cv-header">
      <img class="cv-photo" src="${photoSrc}" alt="">
      <div>
        <div class="cv-name">${escapeHtml(personal.name || "Your Name")}</div>
        <div class="cv-title">${escapeHtml(personal.title || "Your Title")}</div>
        <div class="cv-contact-line">${contactHtml}</div>
      </div>
    </div>
  `;
}

// ---------- Sidebar / main placement ----------
// A section's `placement` field ("auto" | "sidebar" | "main") lets the user
// override which column it lands in. "auto" falls back to the template's own
// default set of catalogIds (e.g. skills/interests/languages). Only templates
// with `hasSidebar: true` show the placement control in the form panel.

function isSidebarSection(section, defaultSidebarIds) {
  if (section.placement === "sidebar") return true;
  if (section.placement === "main") return false;
  return defaultSidebarIds.has(section.catalogId);
}

function splitSections(orderedSections, sectionsHtmlMap, defaultSidebarIds) {
  const sidebar = [];
  const main = [];
  orderedSections.forEach(s => {
    (isSidebarSection(s, defaultSidebarIds) ? sidebar : main).push(sectionsHtmlMap[s.id]);
  });
  return { sidebarHtml: sidebar.join(""), mainHtml: main.join("") };
}

// ---------- Templates registry ----------
// Each template is a skin (CSS class) + a layout(...) function that decides
// where each already-rendered section HTML block gets placed. Adding a new
// template later is just one more entry here plus a CSS skin block — no
// section-render code needs to change.

const TEMPLATES = {
  modern: {
    label: "Modern",
    icon: "🧩",
    skinClass: "template-modern",
    swatch: { bg: "linear-gradient(135deg, #3b6fed 0%, #6f5cf2 100%)", accentText: "#ffffff" },
    hasSidebar: true,
    defaultSidebarIds: new Set(["skills", "interests", "languages"]),
    layout(personal, sectionsHtmlMap, orderedSections) {
      const { sidebarHtml, mainHtml } = splitSections(orderedSections, sectionsHtmlMap, this.defaultSidebarIds);
      return `
        <div class="cv-sidebar">${headerBlock(personal, "sidebar")}${sidebarHtml}</div>
        <div class="cv-main">${mainHtml}</div>
      `;
    }
  },
  classic: {
    label: "Classic",
    icon: "📄",
    skinClass: "template-classic",
    swatch: { bg: "linear-gradient(135deg, #ffffff 0%, #eef1f8 100%)", accentText: "#2f6fed" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        ${headerBlock(personal, "classic")}
        ${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}
      `;
    }
  },
  executive: {
    label: "Executive",
    icon: "🕴️",
    skinClass: "template-executive",
    swatch: { bg: "linear-gradient(165deg, #4a2f36 0%, #7a4a52 100%)", accentText: "#ffffff" },
    hasSidebar: true,
    defaultSidebarIds: new Set(["skills", "interests", "languages", "education", "certificates"]),
    layout(personal, sectionsHtmlMap, orderedSections) {
      const { sidebarHtml, mainHtml } = splitSections(orderedSections, sectionsHtmlMap, this.defaultSidebarIds);
      return `
        <div class="cv-sidebar">${headerBlock(personal, "sidebar")}${sidebarHtml}</div>
        <div class="cv-main">${mainHtml}</div>
      `;
    }
  },
  elegant: {
    label: "Elegant",
    icon: "✒️",
    skinClass: "template-elegant",
    swatch: { bg: "linear-gradient(135deg, #ffffff 0%, #fbeaec 100%)", accentText: "#b82a38" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        ${headerBlock(personal, "classic")}
        ${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}
      `;
    }
  },
  banner: {
    label: "Banner",
    icon: "🎖️",
    skinClass: "template-banner",
    swatch: { bg: "linear-gradient(165deg, #2b2f36 0%, #454b55 100%)", accentText: "#f4a623" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        <div class="cv-banner">${headerBlock(personal, "classic")}</div>
        <div class="cv-banner-body">${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}</div>
      `;
    }
  },
  compact: {
    label: "Compact",
    icon: "🗂️",
    skinClass: "template-compact",
    swatch: { bg: "linear-gradient(135deg, #ffffff 0%, #eef3f6 100%)", accentText: "#1f3a52" },
    hasSidebar: true,
    defaultSidebarIds: new Set(["skills", "interests", "languages", "certificates", "education"]),
    layout(personal, sectionsHtmlMap, orderedSections) {
      const { sidebarHtml, mainHtml } = splitSections(orderedSections, sectionsHtmlMap, this.defaultSidebarIds);
      return `
        ${headerBlock(personal, "classic")}
        <div class="cv-compact-body">
          <div class="cv-main">${mainHtml}</div>
          <div class="cv-aside">${sidebarHtml}</div>
        </div>
      `;
    }
  },
  ivy: {
    label: "Ivy",
    icon: "🎓",
    skinClass: "template-ivy",
    swatch: { bg: "linear-gradient(135deg, #ffffff 0%, #f4f4f2 100%)", accentText: "#1c1f26" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        ${headerBlock(personal, "classic")}
        ${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}
      `;
    }
  },
  timeline: {
    label: "Timeline",
    icon: "🧭",
    skinClass: "template-timeline",
    swatch: { bg: "linear-gradient(135deg, #fff8f0 0%, #ffe7d6 100%)", accentText: "#c2660b" },
    hasSidebar: true,
    defaultSidebarIds: new Set(["skills", "interests", "languages", "certificates"]),
    layout(personal, sectionsHtmlMap, orderedSections) {
      const { sidebarHtml, mainHtml } = splitSections(orderedSections, sectionsHtmlMap, this.defaultSidebarIds);
      return `
        <div class="cv-timeline-head">${headerBlock(personal, "classic")}</div>
        <div class="cv-compact-body">
          <div class="cv-main">${mainHtml}</div>
          <div class="cv-aside">${sidebarHtml}</div>
        </div>
      `;
    }
  },
  condensed: {
    label: "Condensed",
    icon: "📇",
    skinClass: "template-condensed",
    swatch: { bg: "linear-gradient(135deg, #ffffff 0%, #f0f2f5 100%)", accentText: "#2f6fed" },
    hasSidebar: true,
    defaultSidebarIds: new Set(["skills", "interests", "languages", "certificates", "education"]),
    layout(personal, sectionsHtmlMap, orderedSections) {
      const { sidebarHtml, mainHtml } = splitSections(orderedSections, sectionsHtmlMap, this.defaultSidebarIds);
      return `
        ${headerBlock(personal, "classic")}
        <div class="cv-compact-body">
          <div class="cv-main">${mainHtml}</div>
          <div class="cv-aside">${sidebarHtml}</div>
        </div>
      `;
    }
  },
  boxed: {
    label: "Boxed",
    icon: "🔖",
    skinClass: "template-boxed",
    swatch: { bg: "linear-gradient(135deg, #eef3ff 0%, #dbe6ff 100%)", accentText: "#2f6fed" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        <div class="cv-boxed-head">${headerBlock(personal, "classic")}</div>
        <div class="cv-boxed-body">${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}</div>
      `;
    }
  },
  ledger: {
    label: "Ledger",
    icon: "📒",
    skinClass: "template-ledger",
    swatch: { bg: "linear-gradient(135deg, #ffffff 0%, #f2f2f2 100%)", accentText: "#14171f" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        ${headerBlock(personal, "classic")}
        ${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}
      `;
    }
  },
  halo: {
    label: "Halo",
    icon: "🌟",
    skinClass: "template-halo",
    swatch: { bg: "linear-gradient(135deg, #fff0f5 0%, #ffd7e6 100%)", accentText: "#d63384" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        ${headerBlock(personal, "classic")}
        ${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}
      `;
    }
  },
  sidelight: {
    label: "Sidelight",
    icon: "🪟",
    skinClass: "template-sidelight",
    swatch: { bg: "linear-gradient(135deg, #f7f8fb 0%, #eceff5 100%)", accentText: "#1f3a52" },
    hasSidebar: true,
    defaultSidebarIds: new Set(["skills", "interests", "languages", "certificates", "education"]),
    layout(personal, sectionsHtmlMap, orderedSections) {
      const { sidebarHtml, mainHtml } = splitSections(orderedSections, sectionsHtmlMap, this.defaultSidebarIds);
      return `
        <div class="cv-main">${mainHtml}</div>
        <div class="cv-sidebar">${headerBlock(personal, "sidebar")}${sidebarHtml}</div>
      `;
    }
  },
  ribbon: {
    label: "Ribbon",
    icon: "🎗️",
    skinClass: "template-ribbon",
    swatch: { bg: "linear-gradient(135deg, #ffffff 0%, #f6f6f6 100%)", accentText: "#495057" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        ${headerBlock(personal, "classic")}
        ${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}
      `;
    }
  },
  mono: {
    label: "Mono",
    icon: "🖥️",
    skinClass: "template-mono",
    swatch: { bg: "linear-gradient(165deg, #1c1f26 0%, #2e323c 100%)", accentText: "#43aa8b" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        <div class="cv-mono-head">${headerBlock(personal, "classic")}</div>
        <div class="cv-mono-body">${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}</div>
      `;
    }
  },
  panel: {
    label: "Panel",
    icon: "🧱",
    skinClass: "template-panel",
    swatch: { bg: "linear-gradient(135deg, #ffffff 0%, #eef1f8 100%)", accentText: "#6f5cf2" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        ${headerBlock(personal, "classic")}
        ${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}
      `;
    }
  },
  grid: {
    label: "Grid",
    icon: "🔲",
    skinClass: "template-grid",
    swatch: { bg: "linear-gradient(135deg, #ffffff 0%, #f4f4f4 100%)", accentText: "#14171f" },
    hasSidebar: true,
    defaultSidebarIds: new Set(["skills", "interests", "languages"]),
    layout(personal, sectionsHtmlMap, orderedSections) {
      const { sidebarHtml, mainHtml } = splitSections(orderedSections, sectionsHtmlMap, this.defaultSidebarIds);
      return `
        <div class="cv-sidebar">${headerBlock(personal, "sidebar")}${sidebarHtml}</div>
        <div class="cv-main">${mainHtml}</div>
      `;
    }
  },
  spotlight: {
    label: "Spotlight",
    icon: "🔦",
    skinClass: "template-spotlight",
    swatch: { bg: "linear-gradient(135deg, #6f5cf2 0%, #2f6fed 100%)", accentText: "#ffffff" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        <div class="cv-spotlight-head">${headerBlock(personal, "classic")}</div>
        <div class="cv-spotlight-body">${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}</div>
      `;
    }
  },
  typewriter: {
    label: "Typewriter",
    icon: "⌨️",
    skinClass: "template-typewriter",
    swatch: { bg: "linear-gradient(135deg, #faf6ec 0%, #efe7d3 100%)", accentText: "#3d3626" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        ${headerBlock(personal, "classic")}
        ${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}
      `;
    }
  },
  aurora: {
    label: "Aurora",
    icon: "🌈",
    skinClass: "template-aurora",
    swatch: { bg: "linear-gradient(135deg, #ffd6e8 0%, #c7d2fe 50%, #bbf7d0 100%)", accentText: "#7c3aed" },
    layout(personal, sectionsHtmlMap, orderedSections) {
      return `
        ${headerBlock(personal, "classic")}
        ${orderedSections.map(s => sectionsHtmlMap[s.id]).join("")}
      `;
    }
  }
};

// ---------- Page design controls (background / text color / font / size) ----------
// Applied directly to the #cvPreview element as inline styles so they always
// win over the template skin's own defaults without touching the skins above.

const FONT_STACKS = {
  system: { label: "Sans", css: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  serif: { label: "Classic Serif", css: 'Georgia, "Times New Roman", Times, serif' },
  elegant: { label: "Elegant Serif", css: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  slab: { label: "Slab Serif", css: '"Rockwell", "Roboto Slab", serif' },
  rounded: { label: "Rounded", css: '"Trebuchet MS", Verdana, sans-serif' },
  geometric: { label: "Geometric", css: '"Century Gothic", Futura, "Segoe UI", sans-serif' },
  condensed: { label: "Condensed", css: '"Arial Narrow", "Segoe UI", sans-serif' },
  mono: { label: "Mono", css: '"Consolas", "Courier New", monospace' },
  typewriter: { label: "Typewriter", css: '"Courier New", Courier, monospace' }
};

// Preset palette shown in the color popovers (accent / background / text) —
// 30 swatches, 10 per row: neutrals, then standard hues, then extended hues.
const COLOR_SWATCHES = [
  "#000000", "#262626", "#404040", "#595959", "#7f7f7f", "#a6a6a6", "#bfbfbf", "#d9d9d9", "#f2f2f2", "#ffffff",
  "#c0392b", "#e63946", "#f4511e", "#ff8c42", "#f7b731", "#ffd166", "#2a9d8f", "#43aa8b", "#2f6fed", "#1976d2",
  "#073b4c", "#0096c7", "#3a86ff", "#6f5cf2", "#8e44ad", "#d63384", "#ff6b9d", "#8d6e63", "#6f4518", "#495057"
];

// ---------- Fine-grained design scales ----------
// Every slider in the ribbon is a 0–8 index into one of these arrays, mirroring
// the "9-step slider with live label" pattern used across the ribbon's Text
// and Layout tabs. Index 4 is the neutral/default position for every scale.

const SCALE_MID = 4;

const BASE_SIZE_PX   = [11, 11.75, 12.5, 13.25, 14, 14.75, 15.5, 16.25, 17];
const NAME_SCALE      = [0.72, 0.80, 0.88, 0.94, 1, 1.08, 1.18, 1.30, 1.45];
const HEADING_SCALE   = [0.78, 0.85, 0.90, 0.95, 1, 1.06, 1.13, 1.20, 1.28];
const ENTRY_SCALE     = [0.84, 0.89, 0.93, 0.97, 1, 1.04, 1.08, 1.12, 1.17];
const LINE_HEIGHT_VALS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0];
const SPACING_MULT    = [0.5, 0.62, 0.75, 0.88, 1, 1.18, 1.38, 1.6, 1.85];
const MARGIN_H_PX     = [0, 6, 12, 18, 24, 32, 42, 54, 68];
const MARGIN_V_PX     = [0, 5, 10, 15, 20, 27, 35, 45, 56];

function scaleAt(arr, idx) {
  return arr[Math.max(0, Math.min(arr.length - 1, Number(idx)))];
}

const HEADING_STYLES = {
  bar: "Bar",
  underline: "Underline",
  box: "Box",
  topbottom: "Top & Bottom",
  thick: "Thick",
  plain: "Plain",
  thin: "Thin line"
};

// "bar" is the built-in default look and has no dedicated CSS class.
const HEADING_STYLE_CLASSES = Object.keys(HEADING_STYLES).filter(k => k !== "bar").map(k => "heading-" + k);

const HEADING_CASES = {
  uppercase: "UPPERCASE",
  capitalize: "Capitalize",
  none: "As typed"
};

const DELIMITERS = {
  dot: "· Dot",
  bullet: "• Bullet",
  bar: "| Bar"
};

const DELIMITER_CHAR = { dot: "·", bullet: "•", bar: "|" };
