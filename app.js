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

// 同义词以及在宽泛中文提示下容易互换的表达，不放在同一道题作干扰项。
const overlapping = [
  ["重视", "非常重视"],
  ["提升/改善/增强", "不断提升", "加强/加大", "发展/研发", "推广/推进/促进", "增长", "稳步增长", "大力发展"],
  ["制定", "引入/出台", "采取", "实施"],
  ["暗示/表明", "表达/传达", "代表/象征/体现", "标志着", "意味着"],
  ["流行/盛行/兴起", "悄然兴起", "受到某人喜爱"],
  ["扎根于/植根于", "深深扎根于"],
  ["传承", "传播", "弘扬", "复兴"],
  ["被视为", "被称为", "被誉为", "因...而闻名", "享有...的盛名"],
  ["对...提供了有利保障", "对...提供了有利支撑", "使/让"],
  ["为...注入前所未有的活力", "为...注入新动能"],
  ["独特的", "特色的", "迷人的", "美丽的", "愉悦的"],
  ["生态保护", "环境保护", "森林资源保护"],
  ["中学教育", "职业教育"],
  ["民间习俗", "当地的民俗文化", "优良传统"],
  ["东", "东部的"], ["西", "西部的"], ["南", "南部的"], ["北", "北部的"],
  ["东北", "东北部的"], ["西北", "西北部的"], ["东南", "东南部的"], ["西南", "西南部的"]
];

function shuffle(items) {
  const ordered = [...items];
  for (let index = ordered.length - 1; index > 0; index--) {
    const chosen = Math.floor(Math.random() * (index + 1));
    [ordered[index], ordered[chosen]] = [ordered[chosen], ordered[index]];
  }
  return ordered;
}

function optionsFor(entry) {
  const accepted = new Set(entry.answers.map(normalize));
  const conflicts = new Set(overlapping.filter((group) => group.includes(entry.prompt)).flat());
  const right = shuffle(entry.answers)[0];
  const wordCount = right.split(/\s+/).length;
  const group = entries.filter((item) => item.category === entry.category && item.id !== entry.id &&
    !conflicts.has(item.prompt) && item.answers.every((answer) => !accepted.has(normalize(answer))));
  const candidates = shuffle(group).sort((first, second) => {
    const distance = (item) => Math.abs(item.answers[0].split(/\s+/).length - wordCount);
    return distance(first) - distance(second);
  });
  const choices = [{ answer: right, correct: true }];
  for (const item of candidates) {
    const answer = item.answers[0];
    if (choices.some((choice) => normalize(choice.answer) === normalize(answer))) continue;
    choices.push({ answer, correct: false });
    if (choices.length === 4) break;
  }
  return shuffle(choices);
}

const tabs = [...byId("navigation").querySelectorAll("button[data-view]")];
let view = "practice";
let studyView = "practice";
let round = [];
let position = 0;
let missed = [];
let score = 0;
let answered = false;

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
    text("eyebrow", review ? "CET-4 · 查漏补缺" : "CET-4 · 汉译英练习");
    text("description", review ? "只练答错过的词，答对就自动移出错题。" : "看中文选英文，答错了就回头再练。");
    text("idle-title", review ? "选个分类，把错题再做一遍" : "选好分类，开始第一轮");
    text("idle-help", review ? "没有错题时，可以先回到「刷题」做一轮。" : "每道题先想一想英文，再看选项。答完马上核对正确译法。");
    updateSettings();
  }
  byId("title").focus();
  window.scrollTo(0, 0);
}

function begin(items = pool()) {
  if (!items.length) return;
  const size = byId("round-size").value;
  round = shuffle(items).slice(0, size === "all" ? items.length : Number(size));
  missed = [];
  position = 0;
  score = 0;
  byId("study").classList.add("running");
  show("idle", false);
  show("result", false);
  show("question", true);
  renderQuestion();
}

function renderQuestion() {
  answered = false;
  const entry = round[position];
  text("question-category", entry.category);
  text("progress-text", `第 ${position + 1} / ${round.length} 题`);
  const bar = byId("progress");
  bar.max = round.length;
  bar.value = position;
  text("prompt", entry.prompt);
  show("feedback", false);
  show("next", false);
  const choices = optionsFor(entry).map(({ answer, correct }, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    const label = document.createElement("b");
    label.textContent = `${"ABCD"[index]}.`;
    const word = document.createElement("span");
    word.lang = "en";
    word.textContent = answer;
    button.append(label, word);
    button.dataset.correct = String(correct);
    button.addEventListener("click", () => grade(button, correct));
    return button;
  });
  byId("options").replaceChildren(...choices);
  byId("prompt").focus();
}

function grade(button, correct) {
  if (answered) return;
  answered = true;
  const entry = round[position];
  if (correct) {
    score++;
    wrong.delete(entry.id);
  } else {
    missed.push(entry);
    wrong.add(entry.id);
  }
  try {
    localStorage.setItem(key, JSON.stringify([...wrong]));
    show("storage-error", false);
  } catch {
    show("storage-error", true);
  }
  for (const option of byId("options").children) {
    option.disabled = true;
    if (option.dataset.correct === "true") option.classList.add("correct");
    else if (option === button) option.classList.add("incorrect");
  }
  text("verdict", correct ? "答对了" : "答错了，已加入错题");
  text("answers", `讲义译法：${entry.answers.join(" / ")}`);
  text("answer-page", `来源：PDF 第 ${entry.page} 页 · ${entry.category}`);
  text("next", position === round.length - 1 ? "看本轮结果" : "下一题");
  byId("progress").value = position + 1;
  show("feedback", true);
  show("next", true);
  byId("feedback").focus();
  updateSettings();
}

function advance() {
  if (!answered) return;
  if (++position < round.length) {
    renderQuestion();
    return;
  }
  show("question", false);
  show("result", true);
  text("result-title", `本轮答对 ${score} / ${round.length} 题`);
  text("result-note", missed.length ? `本轮答错 ${missed.length} 题，可以立刻重练。` : "本轮没有错题。可以换个分类继续练。");
  show("retry", missed.length > 0);
  show("again", pool().length > 0);
  byId("result-title").focus();
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
byId("next").onclick = advance;
byId("again").onclick = () => begin();
byId("retry").onclick = () => begin(missed);
byId("bank-category").onchange = renderBank;
byId("search").oninput = renderBank;
text("bank-size", `${categories.length} 类 · ${entries.length} 个词条`);
updateSettings();
