// Default categories and boxes.
// label  = what the box shows
// output = what goes into the output text.
//          Put {value} in the output to get a small text field on that box
//          (e.g. "${value} Copay" -> "$25 Copay").
const DEFAULT_CATEGORIES = [
  { name: "Demographics", boxes: ["SSN", "Address", "Email", "Religion", "Race/Ethnicity", "Contacts"] },
  { name: "Guarantor", boxes: ["Insurance", "SelfpayForm", "Employment"] },
  { name: "Documentation", boxes: ["Insurance Card", "NSA", "Patient Rights & Privacy", "Verbal", "ID/DL"] },
  { name: "Additional", boxes: [{ label: "Copay", output: "${value} Copay" }, "MSPQ", "TextMsgConsent"] },
];
const CUSTOM = "Custom";
const STORE_KEY = "categories_v2";

const listEl = document.getElementById("list");
const noteEl = document.getElementById("note");
const initialsEl = document.getElementById("initials");
const previewEl = document.getElementById("preview");
const statusEl = document.getElementById("status");
const newLabelEl = document.getElementById("new-label");
const newOutputEl = document.getElementById("new-output");

// ---------- storage ----------
function load(key, fallback) {
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { return fallback; }
  if (raw === null) return fallback;
  try { return JSON.parse(raw); } catch { return raw; } // older plain-text values
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let nextId = 1;
function makeBox(b) {
  const box = typeof b === "string" ? { label: b, output: b } : { ...b };
  box.id = nextId++;
  return box;
}
function defaults() {
  return DEFAULT_CATEGORIES.map((c) => ({ name: c.name, boxes: c.boxes.map(makeBox) }));
}

let categories = load(STORE_KEY, null);
if (!Array.isArray(categories)) categories = defaults();
categories.forEach((c) => c.boxes.forEach((b) => (nextId = Math.max(nextId, b.id + 1))));
try { localStorage.removeItem("boxes"); } catch {} // old flat list from v1

const saveAll = () => save(STORE_KEY, categories);

let checked = new Set();   // ids of checked boxes
let values = {};           // id -> typed value for {value} boxes
let editing = -1;          // id of box being edited

initialsEl.value = load("initials", "");

// ---------- helpers ----------
const hasValue = (box) => box.output.includes("{value}");

function boxOutput(box) {
  if (!hasValue(box)) return box.output;
  const v = (values[box.id] || "").trim();
  return v
    ? box.output.replaceAll("{value}", v)
    : box.output.replace(/\$?\{value\}/g, "").replace(/\s+/g, " ").trim();
}

function icon(name, alt) {
  return `<img class="icon" src="assets/${name}.png" alt="${alt}">`;
}

function findBox(id) {
  for (const c of categories) {
    const i = c.boxes.findIndex((b) => b.id === id);
    if (i !== -1) return { cat: c, i, box: c.boxes[i] };
  }
  return null;
}

// ---------- render ----------
function render() {
  listEl.innerHTML = "";
  categories.forEach((cat) => {
    if (cat.boxes.length === 0) return; // hide empty categories (e.g. Custom)
    const section = document.createElement("section");
    section.className = cat.name === CUSTOM ? "category custom" : "category";
    section.innerHTML = `<h2></h2><ul></ul>`;
    section.querySelector("h2").textContent = cat.name;
    const ul = section.querySelector("ul");
    cat.boxes.forEach((box) => ul.appendChild(renderBox(box)));
    listEl.appendChild(section);
  });
  update();
}

function renderBox(box) {
  const li = document.createElement("li");

  if (box.id === editing) {
    li.className = "editing";
    li.innerHTML = `
      <input class="edit-label" type="text" placeholder="Box label">
      <input class="edit-output" type="text" placeholder="Output text">
      <div class="row-actions">
        <button class="small icon-btn" data-act="save" title="Save">${icon("diskette", "Save")}</button>
        <button class="small secondary" data-act="cancel">Cancel</button>
      </div>`;
    li.querySelector(".edit-label").value = box.label;
    li.querySelector(".edit-output").value = box.output;
    const cancel = () => { editing = -1; render(); };
    li.querySelectorAll("input").forEach((inp) =>
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveEdit(box, li);
        if (e.key === "Escape") cancel();
      })
    );
    li.querySelector('[data-act="save"]').onclick = () => saveEdit(box, li);
    li.querySelector('[data-act="cancel"]').onclick = cancel;
    return li;
  }

  const shownOut = box.output.replaceAll("{value}", "…");
  li.innerHTML = `
    <label><input type="checkbox"><span class="label"></span>
      <span class="out"></span></label>
    <div class="row-actions">
      <button class="small secondary icon-btn" data-act="edit" title="Edit">${icon("pencil", "Edit")}</button>
      <button class="small danger icon-btn" data-act="remove" title="Remove">${icon("trash", "Remove")}</button>
    </div>`;
  li.querySelector(".label").textContent = box.label;
  li.querySelector(".out").textContent =
    !hasValue(box) && box.output !== box.label ? `→ ${shownOut}` : "";

  const cb = li.querySelector("input");
  cb.checked = checked.has(box.id);
  cb.onchange = () => { cb.checked ? checked.add(box.id) : checked.delete(box.id); update(); };

  if (hasValue(box)) {
    // small inline field for the value (e.g. copay amount); typing checks the box
    const v = document.createElement("input");
    v.type = "text";
    v.className = "value-input";
    v.placeholder = "Amount";
    v.value = values[box.id] || "";
    v.oninput = () => {
      values[box.id] = v.value;
      if (v.value.trim()) { checked.add(box.id); cb.checked = true; }
      update();
    };
    li.querySelector(".label").after(v);
  }

  li.querySelector('[data-act="edit"]').onclick = () => {
    editing = box.id; render();
    listEl.querySelector(".edit-output")?.focus();
  };
  li.querySelector('[data-act="remove"]').onclick = () => removeBox(box.id);
  return li;
}

// ---------- box actions ----------
function saveEdit(box, li) {
  const label = li.querySelector(".edit-label").value.trim();
  const output = li.querySelector(".edit-output").value.trim();
  if (!label && !output) return;
  box.label = label || output;
  box.output = output || label;
  saveAll();
  editing = -1;
  render();
}

function removeBox(id) {
  const found = findBox(id);
  if (!found || !confirm(`Remove "${found.box.label}"?`)) return;
  found.cat.boxes.splice(found.i, 1);
  checked.delete(id);
  delete values[id];
  saveAll();
  render();
}

function addBox() {
  const label = newLabelEl.value.trim();
  const output = newOutputEl.value.trim();
  if (!label && !output) { newLabelEl.focus(); return; }
  let custom = categories.find((c) => c.name === CUSTOM);
  if (!custom) { custom = { name: CUSTOM, boxes: [] }; categories.push(custom); }
  custom.boxes.push(makeBox({ label: label || output, output: output || label }));
  saveAll();
  newLabelEl.value = "";
  newOutputEl.value = "";
  newLabelEl.focus();
  render();
}

// ---------- output ----------
function buildOutput() {
  const parts = [];
  categories.forEach((c) =>
    c.boxes.forEach((b) => { if (checked.has(b.id)) parts.push(boxOutput(b)); })
  );
  const note = noteEl.value.trim();
  if (note) parts.push(note);
  if (parts.length === 0) return "";
  const initials = initialsEl.value.trim().toUpperCase();
  return parts.join(", ") + (initials ? ` ${initials}` : "");
}

function update() {
  const text = buildOutput();
  previewEl.textContent = text || "Check items to build the output…";
  previewEl.classList.toggle("empty", !text);
  statusEl.textContent = "";
}

async function copy() {
  const text = buildOutput();
  if (!text) { statusEl.textContent = "Nothing to copy yet."; return false; }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers that block the clipboard API on local files
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  return true;
}

function clearAll() {
  checked.clear();
  values = {};
  noteEl.value = "";
  render();
}

// ---------- events ----------
noteEl.addEventListener("input", update);
initialsEl.addEventListener("input", () => {
  save("initials", initialsEl.value.trim());
  update();
});

document.getElementById("copy").addEventListener("click", async () => {
  if (await copy()) statusEl.textContent = "Copied to clipboard ✓";
});

document.getElementById("copy-clear").addEventListener("click", async () => {
  if (await copy()) {
    clearAll();
    statusEl.textContent = "Copied to clipboard ✓ — cleared";
  }
});

document.getElementById("reset").addEventListener("click", clearAll);

document.getElementById("add").addEventListener("click", addBox);
[newLabelEl, newOutputEl].forEach((el) =>
  el.addEventListener("keydown", (e) => { if (e.key === "Enter") addBox(); })
);

render();
