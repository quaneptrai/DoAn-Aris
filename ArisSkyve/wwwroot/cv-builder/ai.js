// ---------- AI suggestions (local Ollama) ----------
// Calls a local Ollama server's /api/chat endpoint to suggest resume text
// (summary / experience / project descriptions) and skill keywords, optionally
// tailored to a pasted job description. Settings (endpoint + model) are kept in
// their own localStorage key, separate from the CV data, since they're a
// per-machine tool preference rather than part of the resume being built.
//
// Requires Ollama running locally with CORS opened up for this page's origin,
// e.g.:  OLLAMA_ORIGINS=http://localhost:PORT ollama serve
// (file:// pages won't work — serve this folder over http:// during use.)

const AI_SETTINGS_KEY = "cv-builder-ai-settings";

// 127.0.0.1 rather than "localhost" — Ollama binds IPv4-only by default, and
// resolving "localhost" can race/stall on IPv6 (::1) first in some browsers.
const defaultAiSettings = {
  endpoint: "http://127.0.0.1:11434",
  model: "",
  lastJobContext: ""
};

function loadAiSettings() {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    return raw ? { ...defaultAiSettings, ...JSON.parse(raw) } : { ...defaultAiSettings };
  } catch {
    return { ...defaultAiSettings };
  }
}

function saveAiSettings() {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings));
}

let aiSettings = loadAiSettings();

// ---------- DOM refs ----------

const aiEl = {
  settingsBtn: document.getElementById("aiSettingsBtn"),
  settingsPopover: document.getElementById("aiSettingsPopover"),
  endpointInput: document.getElementById("aiEndpointInput"),
  modelSelect: document.getElementById("aiModelSelect"),
  modelRefreshBtn: document.getElementById("aiModelRefreshBtn"),
  modelCustomWrap: document.getElementById("aiModelCustomWrap"),
  modelCustomInput: document.getElementById("aiModelCustomInput"),
  modelStatusHint: document.getElementById("aiModelStatusHint"),

  popover: document.getElementById("aiPopover"),
  title: document.getElementById("aiPopoverTitle"),
  closeBtn: document.getElementById("aiPopoverCloseBtn"),
  jobContext: document.getElementById("aiJobContext"),
  body: document.getElementById("aiPopoverBody"),
  generateBtn: document.getElementById("aiGenerateBtn"),
};

// aiState holds plain ids/indices (never DOM node references) so it stays
// valid across re-renders — form-panel cards get fully replaced (outerHTML)
// on every data mutation, which would detach any cached node reference.
let aiState = null; // { mode: "text" | "tags", sectionId, entryIndex, fieldKey }

function currentAiSection() {
  return aiState && findSection(aiState.sectionId);
}

function currentAiCard() {
  return aiState && el.sectionsContainer.querySelector(`.section-card[data-section-id="${aiState.sectionId}"]`);
}

// ---------- Settings popover ----------

function openAiSettingsPopover() {
  aiEl.endpointInput.value = aiSettings.endpoint;
  closeAiPopover();
  aiEl.settingsPopover.classList.remove("hidden");
  positionPopover(aiEl.settingsPopover, aiEl.settingsBtn);
  refreshModelList();
}

function closeAiSettingsPopover() {
  aiEl.settingsPopover.classList.add("hidden");
}

aiEl.settingsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (aiEl.settingsPopover.classList.contains("hidden")) openAiSettingsPopover();
  else closeAiSettingsPopover();
});

function persistSettingsFromForm() {
  aiSettings.endpoint = aiEl.endpointInput.value.trim() || defaultAiSettings.endpoint;
  aiSettings.model = aiEl.modelSelect.value === "__custom__"
    ? aiEl.modelCustomInput.value.trim()
    : aiEl.modelSelect.value;
  saveAiSettings();
}

// ---------- Model list (pulled from the local Ollama server's /api/tags) ----------

const CUSTOM_MODEL_VALUE = "__custom__";

async function fetchOllamaModels(endpoint) {
  const url = endpoint.replace(/\/+$/, "") + "/api/tags";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.models || []).map(m => m.name).sort();
}

function populateModelSelect(models) {
  const current = aiSettings.model;
  aiEl.modelSelect.innerHTML =
    models.map(m => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join("") +
    `<option value="${CUSTOM_MODEL_VALUE}">Custom…</option>`;

  if (current && models.includes(current)) {
    aiEl.modelSelect.value = current;
    aiEl.modelCustomWrap.classList.add("hidden");
  } else if (current) {
    aiEl.modelSelect.value = CUSTOM_MODEL_VALUE;
    aiEl.modelCustomInput.value = current;
    aiEl.modelCustomWrap.classList.remove("hidden");
  } else if (models.length) {
    aiEl.modelSelect.value = models[0];
    aiEl.modelCustomWrap.classList.add("hidden");
    persistSettingsFromForm();
  } else {
    aiEl.modelSelect.value = CUSTOM_MODEL_VALUE;
    aiEl.modelCustomWrap.classList.remove("hidden");
  }
}

async function refreshModelList() {
  aiEl.modelStatusHint.textContent = "Loading models from Ollama…";
  const endpoint = aiEl.endpointInput.value.trim() || defaultAiSettings.endpoint;
  try {
    const models = await fetchOllamaModels(endpoint);
    populateModelSelect(models);
    aiEl.modelStatusHint.textContent = models.length
      ? ""
      : `No models pulled yet on ${endpoint}. Pull one (e.g. a :cloud model) with "ollama pull <model>", or enter a tag under Custom.`;
  } catch (err) {
    populateModelSelect([]);
    aiEl.modelStatusHint.textContent = `Couldn't load models from ${endpoint} (${err.message}). Enter a tag under Custom, or fix the endpoint above and hit ↻.`;
  }
}

aiEl.modelRefreshBtn.addEventListener("click", refreshModelList);
aiEl.endpointInput.addEventListener("change", () => { persistSettingsFromForm(); refreshModelList(); });
aiEl.modelSelect.addEventListener("change", () => {
  aiEl.modelCustomWrap.classList.toggle("hidden", aiEl.modelSelect.value !== CUSTOM_MODEL_VALUE);
  persistSettingsFromForm();
});
aiEl.modelCustomInput.addEventListener("change", persistSettingsFromForm);

// ---------- Suggestion popover ----------

const AI_TITLES = { text: "Suggest with AI", tags: "Suggest skills with AI" };

function openAiPopover(btn) {
  const sectionId = btn.dataset.sectionId;
  if (!findSection(sectionId)) return;
  closeAiSettingsPopover();

  aiState = {
    mode: btn.dataset.aiAction === "suggest-tags" ? "tags" : "text",
    sectionId,
    entryIndex: btn.dataset.entryIndex !== undefined ? Number(btn.dataset.entryIndex) : null,
    fieldKey: btn.dataset.fieldKey || null,
  };

  aiEl.title.textContent = AI_TITLES[aiState.mode];
  aiEl.jobContext.value = aiSettings.lastJobContext || "";
  aiEl.generateBtn.textContent = "Generate";
  aiEl.body.innerHTML = `<p class="ai-popover-hint">Optionally paste the role or job description above, then generate.</p>`;

  aiEl.popover.classList.remove("hidden");
  positionPopover(aiEl.popover, btn);
  aiEl.jobContext.focus();
}

function closeAiPopover() {
  aiEl.popover.classList.add("hidden");
  aiState = null;
}

document.addEventListener("click", (e) => {
  const suggestBtn = e.target.closest("[data-ai-action]");
  if (suggestBtn) {
    e.stopPropagation();
    openAiPopover(suggestBtn);
    return;
  }
  if (!aiEl.popover.classList.contains("hidden") && !e.composedPath().includes(aiEl.popover)) closeAiPopover();
  if (!aiEl.settingsPopover.classList.contains("hidden") && !e.composedPath().includes(aiEl.settingsPopover) && e.target !== aiEl.settingsBtn) {
    closeAiSettingsPopover();
  }
});

aiEl.closeBtn.addEventListener("click", closeAiPopover);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!aiEl.popover.classList.contains("hidden")) closeAiPopover();
  if (!aiEl.settingsPopover.classList.contains("hidden")) closeAiSettingsPopover();
});

// ---------- Ollama call ----------

async function callOllama(messages) {
  if (!aiSettings.model) {
    const err = new Error('No Ollama model set. Click "AI settings" and enter a model name (e.g. a pulled :cloud model).');
    err.isSetup = true;
    throw err;
  }
  const url = aiSettings.endpoint.replace(/\/+$/, "") + "/api/chat";
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: aiSettings.model, stream: false, messages }),
    });
  } catch {
    throw new Error(
      `Couldn't reach Ollama at ${aiSettings.endpoint}. Make sure "ollama serve" is running and OLLAMA_ORIGINS allows this page's origin (${location.origin}).`
    );
  }
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch { /* not JSON */ }
    throw new Error(`Ollama returned HTTP ${res.status}${detail ? ": " + detail : ""}`);
  }
  const json = await res.json();
  const content = json && json.message && json.message.content;
  if (!content) throw new Error("Ollama returned an empty response.");
  return content.trim();
}

// ---------- Prompt builders ----------

function buildTextMessages({ fieldLabel, currentText, jobContext }) {
  const system =
    `You are a resume-writing assistant. Write concise, achievement-oriented resume content in plain text. ` +
    `Respond with ONLY the finished text for the "${fieldLabel}" field — no preamble, no markdown, no surrounding quotes.`;
  const parts = [];
  if (data.personal.name || data.personal.title) {
    parts.push(`Candidate: ${[data.personal.name, data.personal.title].filter(Boolean).join(", ")}`);
  }
  if (jobContext) parts.push(`Target role / job description:\n${jobContext}`);
  parts.push(currentText ? `Current draft to improve:\n${currentText}` : "No existing draft — write from scratch.");
  return [
    { role: "system", content: system },
    { role: "user", content: parts.join("\n\n") },
  ];
}

function buildTagsMessages({ label, existingItems, jobContext }) {
  const system =
    `You suggest resume "${label}" keywords. Respond with ONLY a comma-separated list of 8-12 short items ` +
    `(no numbering, no explanations, nothing already listed).`;
  const parts = [];
  if (data.personal.title) parts.push(`Candidate role: ${data.personal.title}`);
  if (jobContext) parts.push(`Target role / job description:\n${jobContext}`);
  if (existingItems.length) parts.push(`Already listed (do not repeat): ${existingItems.join(", ")}`);
  return [
    { role: "system", content: system },
    { role: "user", content: parts.length ? parts.join("\n\n") : "Suggest general items for this candidate." },
  ];
}

function parseSuggestedTags(raw, existingItems) {
  const existingLower = new Set(existingItems.map(s => s.toLowerCase()));
  return raw
    .split(/\r?\n|,/)
    .map(s => s.replace(/^[\s\-•*\d.)]+/, "").replace(/^["']+|["'.]+$/g, "").trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.findIndex(x => x.toLowerCase() === s.toLowerCase()) === i)
    .filter(s => !existingLower.has(s.toLowerCase()))
    .slice(0, 12);
}

// ---------- Generate flow ----------

function fieldLabelForState() {
  const section = currentAiSection();
  if (!section) return "";
  if (aiState.fieldKey) {
    const fields = getFieldsForSection(section);
    const field = fields.find(f => f.key === aiState.fieldKey);
    return `${getSectionLabel(section)} — ${field ? field.label : aiState.fieldKey}`;
  }
  return getSectionLabel(section);
}

function currentTextForState() {
  const section = currentAiSection();
  if (!section) return "";
  if (aiState.entryIndex !== null && aiState.fieldKey) {
    return (section.entries[aiState.entryIndex] && section.entries[aiState.entryIndex][aiState.fieldKey]) || "";
  }
  return section.content || "";
}

async function runGenerate() {
  const section = currentAiSection();
  if (!section || !aiState) return;

  const jobContext = aiEl.jobContext.value.trim();
  aiSettings.lastJobContext = jobContext;
  saveAiSettings();

  aiEl.body.innerHTML = `<div class="ai-loading"><span class="ai-spinner"></span>Generating…</div>`;
  aiEl.generateBtn.disabled = true;

  try {
    if (aiState.mode === "text") {
      const messages = buildTextMessages({
        fieldLabel: fieldLabelForState(),
        currentText: currentTextForState(),
        jobContext,
      });
      const suggestion = await callOllama(messages);
      renderTextResult(suggestion);
    } else {
      const existingItems = section.items || [];
      const messages = buildTagsMessages({ label: getSectionLabel(section), existingItems, jobContext });
      const raw = await callOllama(messages);
      const tags = parseSuggestedTags(raw, existingItems);
      renderTagsResult(tags);
    }
    aiEl.generateBtn.textContent = "Regenerate";
  } catch (err) {
    aiEl.body.innerHTML = `<p class="ai-popover-error">${escapeHtml(err.message)}</p>`;
    if (err.isSetup) {
      aiEl.body.innerHTML += `<button type="button" class="btn btn-ghost btn-small" id="aiOpenSettingsFromError">Open AI settings</button>`;
      document.getElementById("aiOpenSettingsFromError").addEventListener("click", () => {
        closeAiPopover();
        openAiSettingsPopover();
      });
    }
  } finally {
    aiEl.generateBtn.disabled = false;
  }
}

aiEl.generateBtn.addEventListener("click", runGenerate);

function renderTextResult(text) {
  aiEl.body.innerHTML = `
    <div class="ai-result-text">${escapeHtml(text)}</div>
    <button type="button" class="btn btn-primary btn-small" data-action="ai-insert">Insert</button>
  `;
}

function renderTagsResult(tags) {
  if (!tags.length) {
    aiEl.body.innerHTML = `<p class="ai-popover-hint">No new suggestions — everything relevant is already listed.</p>`;
    return;
  }
  aiEl.body.innerHTML = `
    <div class="ai-chip-list">
      ${tags.map(t => `<button type="button" class="ai-suggest-chip" data-tag="${escapeAttr(t)}">+ ${escapeHtml(t)}</button>`).join("")}
    </div>
    <button type="button" class="btn btn-ghost btn-small" data-action="ai-add-all">Add all</button>
  `;
}

aiEl.body.addEventListener("click", (e) => {
  const insertBtn = e.target.closest('[data-action="ai-insert"]');
  if (insertBtn) {
    applyTextSuggestion(aiEl.body.querySelector(".ai-result-text").textContent);
    return;
  }
  const chip = e.target.closest(".ai-suggest-chip");
  if (chip) {
    addSuggestedTag(chip.dataset.tag);
    chip.remove();
    if (!aiEl.body.querySelector(".ai-suggest-chip")) {
      aiEl.body.innerHTML = `<p class="ai-popover-hint">All suggestions added.</p>`;
    }
    return;
  }
  const addAllBtn = e.target.closest('[data-action="ai-add-all"]');
  if (addAllBtn) {
    aiEl.body.querySelectorAll(".ai-suggest-chip").forEach(c => addSuggestedTag(c.dataset.tag));
    aiEl.body.innerHTML = `<p class="ai-popover-hint">All suggestions added.</p>`;
  }
});

// ---------- Apply suggestions back into CV data ----------

function applyTextSuggestion(text) {
  const section = currentAiSection();
  if (!section) return;
  if (aiState.entryIndex !== null && aiState.fieldKey) {
    section.entries[aiState.entryIndex][aiState.fieldKey] = text;
  } else {
    section.content = text;
  }
  const card = currentAiCard();
  if (card) rerenderCardBody(card, section);
  renderPreview();
  saveData();
  closeAiPopover();
}

function addSuggestedTag(tag) {
  const section = currentAiSection();
  if (!section || !tag) return;
  if (section.items.some(i => i.toLowerCase() === tag.toLowerCase())) return;
  section.items.push(tag);
  const card = currentAiCard();
  if (card) rerenderCardBody(card, section);
  renderPreview();
  saveData();
}
