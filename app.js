// Edit this list to change the checklist topics.
const TOPICS = [
  "box1",
  "box2",
  "box3",
  "box4",
  "box5",
];

const listEl = document.getElementById("list");
const noteEl = document.getElementById("note");
const initialsEl = document.getElementById("initials");
const previewEl = document.getElementById("preview");
const statusEl = document.getElementById("status");

// Build the checklist
TOPICS.forEach((topic) => {
  const li = document.createElement("li");
  li.innerHTML = `<label><input type="checkbox"><span></span></label>`;
  li.querySelector("span").textContent = topic;
  li.querySelector("input").value = topic;
  listEl.appendChild(li);
});

// Remember initials between visits
try { initialsEl.value = localStorage.getItem("initials") || ""; } catch {}

function buildOutput() {
  const checked = [...listEl.querySelectorAll("input:checked")].map((c) => c.value);
  const note = noteEl.value.trim();
  if (note) checked.push(note);
  if (checked.length === 0) return "";
  const initials = initialsEl.value.trim().toUpperCase();
  return checked.join(", ") + (initials ? ` [${initials}]` : "");
}

function update() {
  const text = buildOutput();
  previewEl.textContent = text || "Check items to build the output…";
  previewEl.classList.toggle("empty", !text);
  statusEl.textContent = "";
}

listEl.addEventListener("change", update);
noteEl.addEventListener("input", update);
initialsEl.addEventListener("input", () => {
  try { localStorage.setItem("initials", initialsEl.value.trim()); } catch {}
  update();
});

document.getElementById("copy").addEventListener("click", async () => {
  const text = buildOutput();
  if (!text) { statusEl.textContent = "Nothing to copy yet."; return; }
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
  statusEl.textContent = "Copied to clipboard ✓";
});

document.getElementById("reset").addEventListener("click", () => {
  listEl.querySelectorAll("input").forEach((c) => (c.checked = false));
  noteEl.value = "";
  update();
});

update();
