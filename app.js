const byId = (id) => document.getElementById(id);
const text = (id, value) => { byId(id).textContent = value; };
const show = (id, visible) => { byId(id).hidden = !visible; };
const normalize = (value) => value.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").trim();
const categories = Object.keys(translationBank);
const entries = Object.entries(translationBank).flatMap(([category, rows]) =>
  rows.map(([prompt, answers, page]) => ({ id: `${category}:${prompt}`, category, prompt, answers, page }))
);
const key = "cet4-translation-wrong-v1";
const wrong = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
  if (Array.isArray(saved)) for (const id of saved) wrong.add(id);
} catch {
  show("storage-error", true);
}

function shuffle(items) {
  const ordered = [...items];
  for (let index = ordered.length - 1; index > 0; index--) {
    const chosen = Math.floor(Math.random() * (index + 1));
    [ordered[index], ordered[chosen]] = [ordered[chosen], ordered[index]];
  }
  return ordered;
}

const tabs = [...byId("navigation").querySelectorAll("button[data-view]")];
let view = "practice";
let studyView = "practice";
let round = [];
let position = 0;
const marks = new Map();

const checks = categories.map((category) => {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = category;
  input.checked = true;
  const count = document.createElement("small");
  count.textContent = translationBank[category].length;
  count.setAttribute("aria-hidden", "true");
  label.append(input, category, count);
  byId("categories").append(label);
  byId("bank-category").append(new Option(category, category));
  return input;
});

function pool() {
  const selected = new Set(checks.filter((input) => input.checked).map((input) => input.value));
  return entries.filter((entry) => selected.has(entry.category) && (studyView !== "review" || wrong.has(entry.id)));
}

function updateSettings() {
  const amount = pool().length;
  const review = studyView === "review";
  text("review-count", entries.filter((entry) => wrong.has(entry.id)).length);
  text("settings-note", amount ? `当前可练 ${amount} 个词条。` : review ? "选中的分类没有待复习的错题。" : "请至少选择一个分类。");
  byId("start").disabled = amount === 0;
  text("start", review ? "开始复练" : "开始刷题");
}

function openView(name) {
  view = name;
  for (const tab of tabs) {
    if (tab.dataset.view === view) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  show("bank", view === "bank");
  show("study", view !== "bank");
  if (view === "bank") {
    text("title", "完整词表");
    text("eyebrow", "CET-4 · 考前速查");
    text("description", "可以按分类浏览，也可以用中英文查找词汇。");
    renderBank();
  } else {
    if (studyView !== view) {
      studyView = view;
      show("idle", true);
      show("question", false);
      show("result", false);
      byId("study").classList.remove("running");
    }
    const review = studyView === "review";
    text("title", review ? "错题复练" : "四级翻译词汇刷题");
    text("eyebrow", review ? "CET-4 · 查漏补缺" : "CET-4 · 纸笔默写");
    text("description", review ? "只练错题。核对之后点「写对了」即可移出错题。" : "看中文，在纸上默写英文，写完再翻答案。");
    text("idle-title", review ? "选个分类，把错题再做一遍" : "选好分类，开始第一轮");
    text("idle-help", review ? "没有错题时，可以先回到「刷题」做一轮。" : "每题先在纸上写，核对后可自己标记「写对了」或「还要复习」。");
    updateSettings();
  }
  byId("title").focus();
  window.scrollTo(0, 0);
}

function begin(items = pool()) {
  if (!items.length) return;
  const size = byId("round-size").value;
  round = shuffle(items).slice(0, size === "all" ? items.length : Number(size));
  marks.clear();
  position = 0;
  byId("study").classList.add("running");
  show("idle", false);
  show("result", false);
  show("question", true);
  renderQuestion();
}

function renderQuestion() {
  const entry = round[position];
  text("question-category", entry.category);
  text("progress-text", `第 ${position + 1} / ${round.length} 题`);
  const bar = byId("progress");
  bar.max = round.length;
  bar.value = position + 1;
  text("prompt", entry.prompt);
  setAnswer(false);
  byId("previous").disabled = position === 0;
  text("next", position === round.length - 1 ? "看本轮结果" : "下一题");
  byId("prompt").focus();
}

// 翻卡只负责显示答案；只有主动自评才会更改记录。
function setAnswer(visible) {
  const entry = round[position];
  text("answers", visible ? entry.answers.join(" / ") : "");
  text("answer-page", visible ? `来源：PDF 第 ${entry.page} 页 · ${entry.category}` : "");
  if (visible) renderMark(entry);
  show("feedback", visible);
  text("flip", visible ? "收起答案" : "翻答案");
  byId("flip").setAttribute("aria-expanded", String(visible));
}

function renderMark(entry) {
  const mark = marks.get(entry.id);
  byId("mark-right").setAttribute("aria-pressed", String(mark === "right"));
  byId("mark-wrong").setAttribute("aria-pressed", String(mark === "wrong"));
  text("verdict", mark === "right" ? "已标记为写对。" : mark === "wrong" ? "已加入错题。" : "");
}

function grade(mark) {
  if (byId("question").hidden || byId("feedback").hidden) return;
  const entry = round[position];
  marks.set(entry.id, mark);
  if (mark === "right") wrong.delete(entry.id);
  else wrong.add(entry.id);
  try {
    localStorage.setItem(key, JSON.stringify([...wrong]));
    show("storage-error", false);
  } catch {
    show("storage-error", true);
  }
  renderMark(entry);
  updateSettings();
}

function missedCards() {
  return round.filter((entry) => marks.get(entry.id) === "wrong");
}

function finish() {
  setAnswer(false);
  show("question", false);
  show("result", true);
  const missed = missedCards().length;
  text("result-title", `本轮已自评 ${marks.size} / ${round.length} 题`);
  text("result-note", `写对 ${marks.size - missed} 题 · 待复习 ${missed} 题 · 未标记 ${round.length - marks.size} 题`);
  show("retry", missed > 0);
  show("again", pool().length > 0);
  byId("result-title").focus();
}

function move(step) {
  if (!byId("result").hidden && step < 0) {
    show("result", false);
    show("question", true);
    renderQuestion();
  } else if (!byId("question").hidden) {
    const next = position + step;
    if (next === round.length) finish();
    else if (next >= 0 && next < round.length) {
      position = next;
      renderQuestion();
    }
  }
}

function renderBank() {
  const query = normalize(byId("search").value);
  const category = byId("bank-category").value;
  const matches = entries.filter((entry) => (!category || entry.category === category) &&
    [entry.prompt, ...entry.answers].some((value) => normalize(value).includes(query)));
  text("bank-count", `显示 ${matches.length} / ${entries.length} 个词条`);
  const rows = matches.map((entry) => {
    const row = document.createElement("article");
    row.className = "bank-row";
    const head = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.prompt;
    const source = document.createElement("small");
    source.textContent = `${entry.category} · 第 ${entry.page} 页`;
    const answers = document.createElement("p");
    answers.lang = "en";
    answers.textContent = entry.answers.join(" / ");
    head.append(title, source);
    row.append(head, answers);
    return row;
  });
  byId("bank-rows").replaceChildren(...rows);
}

for (const tab of tabs) tab.addEventListener("click", () => openView(tab.dataset.view));
byId("all-categories").onclick = () => { checks.forEach((input) => { input.checked = true; }); updateSettings(); };
byId("no-categories").onclick = () => { checks.forEach((input) => { input.checked = false; }); updateSettings(); };
byId("settings").addEventListener("change", updateSettings);
byId("settings").addEventListener("submit", (event) => { event.preventDefault(); begin(); });
byId("flip").onclick = () => setAnswer(byId("feedback").hidden);
byId("previous").onclick = () => move(-1);
byId("next").onclick = () => move(1);
byId("back-to-card").onclick = () => move(-1);
byId("mark-right").onclick = () => grade("right");
byId("mark-wrong").onclick = () => grade("wrong");
byId("again").onclick = () => begin();
byId("retry").onclick = () => begin(missedCards());
byId("bank-category").onchange = renderBank;
byId("search").oninput = renderBank;
// 快捷键只在练习区生效，不拦截输入、输入法和浏览器组合键。
document.addEventListener("keydown", (event) => {
  if (view === "bank" || event.repeat || event.isComposing || event.ctrlKey || event.metaKey ||
    event.altKey || event.target.closest("input, select, textarea, [contenteditable]")) return;
  const pressed = event.key.toLowerCase();
  if (pressed === "a" && !byId("result").hidden) {
    event.preventDefault();
    move(-1);
    return;
  }
  if (byId("question").hidden || !["a", "s", "d"].includes(pressed)) return;
  event.preventDefault();
  if (pressed === "s") setAnswer(byId("feedback").hidden);
  else move(pressed === "a" ? -1 : 1);
});
text("bank-size", `${categories.length} 类 · ${entries.length} 个词条`);
updateSettings();
