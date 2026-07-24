const $ = id => document.getElementById(id);

const params = new URLSearchParams(location.search);
const databaseKey = params.get("db");
const validDatabases = ["sirket", "eticaret", "kutuphane", "okul", "sinema", "hastane"];

if (!validDatabases.includes(databaseKey)) {
  location.replace("/kategoriler/sql/sql-sorgu-atolyesi/");
}

let data = null;
let editor = null;
let activeQuestionIndex = 0;
let activeLevel = "Tümü";
let activeSearch = "";
let unfinishedOnly = false;
let activeTable = null;
let lastResult = null;
let visibleIndexes = [];
let hintStage = 0;

const STORAGE_KEY = `sqlAtolyesi:${databaseKey}:questions-v1`;
const defaultProgress = {
  questions: {},
  lastQuestionIndex: 0,
  lastQueries: {},
  editorHeight: 340,
  resultHeight: 310
};

let progress = loadProgress();

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaultProgress,
      ...saved,
      questions: saved.questions || {},
      lastQueries: saved.lastQueries || {}
    };
  } catch {
    return structuredClone(defaultProgress);
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function questionState(id) {
  if (!progress.questions[id]) {
    progress.questions[id] = {
      completed: false,
      marked: false,
      later: false,
      attempts: 0,
      correctAttempts: 0,
      hintsUsed: 0,
      solutionViewed: false,
      topicAttempts: {}
    };
  }
  return progress.questions[id];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inferType(value) {
  if (typeof value === "number") return Number.isInteger(value) ? "INTEGER" : "NUMBER";
  if (value === null) return "NULL";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return "DATE";
  return "TEXT";
}

function setStatus(text, type = "") {
  $("queryStatus").className = `query-status ${type}`;
  $("queryStatus").innerHTML = `<span class="status-dot"></span>${escapeHtml(text)}`;
}

function initializeDatabase() {
  alasql("DROP DATABASE IF EXISTS sql_lab");
  alasql("CREATE DATABASE sql_lab");
  alasql("USE sql_lab");

  Object.entries(data.tables).forEach(([tableName, rows]) => {
    alasql(`CREATE TABLE ${tableName}`);
    alasql.tables[tableName].data = JSON.parse(JSON.stringify(rows));
  });
}

function buildHintTables() {
  const tables = {};
  Object.entries(data.tables).forEach(([tableName, rows]) => {
    tables[tableName] = Object.keys(rows[0] || {});
  });
  return tables;
}

function initializeEditor() {
  if (typeof CodeMirror === "undefined") {
    setStatus("Kod editörü yüklenemedi. İnternet bağlantını kontrol et.", "error");
    return;
  }

  editor = CodeMirror.fromTextArea($("sqlEditor"), {
    mode: "text/x-sql",
    theme: "material-darker",
    lineNumbers: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: false,
    extraKeys: {
      "Ctrl-Enter": () => runQuery(),
      "Cmd-Enter": () => runQuery(),
      "Ctrl-Space": cm => cm.showHint({
        hint: CodeMirror.hint.sql,
        tables: buildHintTables(),
        completeSingle: false
      }),
      "Tab": cm => {
        if (cm.somethingSelected()) cm.indentSelection("add");
        else cm.replaceSelection("  ", "end");
      }
    }
  });

  editor.setSize("100%", progress.editorHeight);
  editor.on("change", () => {
    const question = currentQuestion();
    if (!question) return;
    progress.lastQueries[question.id] = editor.getValue();
    saveProgress();
  });
}

function currentQuestion() {
  return data?.questions?.[activeQuestionIndex] || null;
}

function filteredQuestionIndexes() {
  return data.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => activeLevel === "Tümü" || question.level === activeLevel)
    .filter(({ question }) => {
      const term = activeSearch.trim().toLocaleLowerCase("tr");
      if (!term) return true;
      const haystack = [
        question.title,
        question.description,
        question.level,
        ...(question.topics || [])
      ].join(" ").toLocaleLowerCase("tr");
      return haystack.includes(term);
    })
    .filter(({ question }) => !unfinishedOnly || !questionState(question.id).completed)
    .map(x => x.index);
}

function renderQuestionList() {
  visibleIndexes = filteredQuestionIndexes();
  $("visibleQuestionCount").textContent = visibleIndexes.length;

  $("questionList").innerHTML = visibleIndexes.map(index => {
    const question = data.questions[index];
    const state = questionState(question.id);
    const badges = [
      state.completed ? '<span title="Tamamlandı">✓</span>' : "",
      state.marked ? '<span title="İşaretlendi">★</span>' : "",
      state.later ? '<span title="Sonra çözülecek">◷</span>' : ""
    ].join("");

    return `
      <button class="question-item ${index === activeQuestionIndex ? "active" : ""}" data-index="${index}" type="button">
        <span class="question-index">${String(question.number).padStart(2, "0")}</span>
        <span class="question-copy">
          <strong>${escapeHtml(question.title)}</strong>
          <small>${question.level} · ${escapeHtml((question.topics || [])[0] || "SQL")}</small>
        </span>
        <span class="question-state">${badges}</span>
      </button>`;
  }).join("") || `
    <div class="empty-list">
      <strong>Soru bulunamadı</strong>
      <p>Arama veya filtreyi değiştir.</p>
    </div>`;

  document.querySelectorAll(".question-item").forEach(button => {
    button.addEventListener("click", () => selectQuestion(Number(button.dataset.index)));
  });
}

function selectQuestion(index) {
  activeQuestionIndex = index;
  progress.lastQuestionIndex = index;
  saveProgress();

  const question = currentQuestion();
  questionState(question.id);
  hintStage = 0;

  $("taskLevel").textContent = question.level;
  $("taskNumber").textContent = `Soru ${question.number} / ${data.questions.length}`;
  $("taskTitle").textContent = question.title;
  $("taskDescription").textContent = question.description;
  $("solutionCode").textContent = question.solution;
  $("topicTags").innerHTML = (question.topics || []).map(topic =>
    `<span>${escapeHtml(topic)}</span>`
  ).join("");

  $("solutionContent").hidden = true;
  $("showSolutionButton").textContent = "Çözümü Göster";
  $("hintContent").hidden = true;
  $("hintContent").innerHTML = "";
  $("hintButton").disabled = false;
  $("hintButton").textContent = "İpucu 1'i Göster";

  updateStateButtons();

  if (editor) {
    editor.setValue(progress.lastQueries[question.id] || "");
    editor.focus();
  }

  clearOutput(false);
  renderQuestionList();
  updateNavigationButtons();
  updateStats();
}

function updateNavigationButtons() {
  const currentPosition = visibleIndexes.indexOf(activeQuestionIndex);
  $("previousQuestionButton").disabled = currentPosition <= 0;
  $("nextQuestionButton").disabled =
    currentPosition === -1 || currentPosition >= visibleIndexes.length - 1;
}

function navigateQuestion(direction) {
  const currentPosition = visibleIndexes.indexOf(activeQuestionIndex);
  const nextPosition = currentPosition + direction;
  if (nextPosition >= 0 && nextPosition < visibleIndexes.length) {
    selectQuestion(visibleIndexes[nextPosition]);
  }
}

function updateStateButtons() {
  const state = questionState(currentQuestion().id);
  $("markButton").classList.toggle("active", state.marked);
  $("laterButton").classList.toggle("active", state.later);
  $("markButton").textContent = state.marked ? "★ İşaretlendi" : "☆ İşaretle";
  $("laterButton").textContent = state.later ? "✓ Sonra çözülecek" : "◷ Sonra çöz";
}

function toggleState(field) {
  const state = questionState(currentQuestion().id);
  state[field] = !state[field];
  saveProgress();
  updateStateButtons();
  renderQuestionList();
  updateStats();
}

function showNextHint() {
  const question = currentQuestion();
  const state = questionState(question.id);

  if (hintStage >= question.hints.length) return;

  hintStage += 1;
  state.hintsUsed = Math.max(state.hintsUsed, hintStage);
  saveProgress();

  $("hintContent").hidden = false;
  $("hintContent").innerHTML = question.hints.slice(0, hintStage).map((hint, i) => `
    <article>
      <strong>İpucu ${i + 1}</strong>
      ${i === 2 ? `<pre>${escapeHtml(hint)}</pre>` : `<p>${escapeHtml(hint)}</p>`}
    </article>
  `).join("");

  if (hintStage >= question.hints.length) {
    $("hintButton").textContent = "Tüm ipuçları gösterildi";
    $("hintButton").disabled = true;
  } else {
    $("hintButton").textContent = `İpucu ${hintStage + 1}'yi Göster`;
  }
}

function renderSchemaTabs() {
  const tableNames = Object.keys(data.tables);
  activeTable = tableNames[0];

  $("schemaTabs").innerHTML = tableNames.map((name, index) => `
    <button class="schema-tab ${index === 0 ? "active" : ""}" data-table="${name}" type="button">
      ${name}
    </button>
  `).join("");

  document.querySelectorAll(".schema-tab").forEach(button => {
    button.addEventListener("click", () => renderSchema(button.dataset.table));
  });

  renderSchema(activeTable);
}

function renderSchema(tableName) {
  activeTable = tableName;
  document.querySelectorAll(".schema-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.table === tableName);
  });

  const sample = data.tables[tableName][0] || {};
  $("schemaContent").innerHTML = Object.keys(sample).map((column, index) => `
    <div class="schema-row">
      <span>${index === 0 ? "◆ " : ""}${escapeHtml(column)}</span>
      <span>${inferType(sample[column])}</span>
    </div>
  `).join("");
}

function normalizeResult(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(row => {
    const normalized = {};
    Object.keys(row).sort().forEach(key => {
      let value = row[key];
      if (typeof value === "number") value = Math.round(value * 1_000_000) / 1_000_000;
      normalized[key.toLowerCase()] = value;
    });
    return normalized;
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "tr"));
}

function resultsEqual(a, b) {
  return JSON.stringify(normalizeResult(a)) === JSON.stringify(normalizeResult(b));
}

function analyzeQuery(query, question, result) {
  const upper = query.toUpperCase();
  const tips = [];
  const usedTopics = [];

  const patterns = {
    "JOIN": /\b(?:INNER|LEFT|RIGHT|FULL)?\s*JOIN\b/,
    "GROUP BY": /\bGROUP\s+BY\b/,
    "HAVING": /\bHAVING\b/,
    "ORDER BY": /\bORDER\s+BY\b/,
    "Alt Sorgu": /\(\s*SELECT\b/,
    "CASE": /\bCASE\b/,
    "DISTINCT": /\bDISTINCT\b/
  };

  Object.entries(patterns).forEach(([name, pattern]) => {
    if (pattern.test(upper)) usedTopics.push(name);
  });

  if (/SELECT\s+\*/i.test(query)) {
    tips.push("SELECT * çalışır; rapor amaçlı sorgularda yalnızca gerekli sütunları seçmek daha okunaklı olabilir.");
  }

  for (const required of question.topics || []) {
    if (patterns[required] && !patterns[required].test(upper)) {
      tips.push(`Soru ${required} kullanımını gerektiriyor olabilir. Sorgunu bu açıdan yeniden incele.`);
    }
  }

  if ((question.topics || []).includes("ORDER BY") && !/\bORDER\s+BY\b/i.test(query)) {
    tips.push("Soru sıralama istiyor; ORDER BY bölümünü kontrol et.");
  }

  if (/\bWHERE\b/i.test(query) && (query.match(/\bOR\b/gi) || []).length >= 2) {
    tips.push("Aynı sütun için çok sayıda OR kullanıyorsan IN (...) daha okunaklı olabilir.");
  }

  const rowCount = Array.isArray(result) ? result.length : 0;

  return {
    usedTopics,
    tips,
    rowCount
  };
}

function runQuery(showStatus = true) {
  if (!editor) return null;
  const query = editor.getValue().trim();

  if (!query) {
    setStatus("Önce bir SQL sorgusu yaz.", "error");
    return null;
  }

  const started = performance.now();

  try {
    const result = alasql(query);
    const elapsed = (performance.now() - started).toFixed(2);
    lastResult = result;
    renderResult(result);

    const analysis = analyzeQuery(query, currentQuestion(), result);
    renderFeedback(analysis, elapsed);

    if (showStatus) {
      setStatus(`Sorgu başarıyla çalıştı • ${elapsed} ms`, "success");
    }
    return result;
  } catch (error) {
    lastResult = null;
    renderError(error.message);
    setStatus(`SQL hatası: ${error.message}`, "error");
    return null;
  }
}

function checkAnswer() {
  const question = currentQuestion();
  const state = questionState(question.id);
  const userResult = runQuery(false);

  if (userResult === null) return;

  state.attempts += 1;
  for (const topic of question.topics || []) {
    state.topicAttempts[topic] = (state.topicAttempts[topic] || 0) + 1;
  }

  let expected;
  try {
    expected = alasql(question.solution);
  } catch {
    setStatus("Kontrol verisi hazırlanamadı.", "error");
    return;
  }

  document.querySelectorAll(".check-message").forEach(x => x.remove());
  const message = document.createElement("div");

  if (resultsEqual(userResult, expected)) {
    state.completed = true;
    state.correctAttempts += 1;
    state.later = false;
    message.className = "check-message correct";
    message.textContent = "Doğru sonuç! Soru tamamlandı.";
    setStatus("Sorgu sonucu beklenen cevapla eşleşiyor.", "success");
  } else {
    message.className = "check-message wrong";
    message.textContent = "Sorgu çalıştı ancak sonuç beklenen cevapla eşleşmiyor. İstersen bir sonraki ipucunu aç.";
    setStatus("Sonuç henüz doğru değil.", "warning");
  }

  saveProgress();
  $("resultArea").before(message);
  renderQuestionList();
  updateStateButtons();
  updateStats();
}

function renderResult(result) {
  document.querySelectorAll(".check-message").forEach(x => x.remove());
  $("downloadButton").disabled = true;

  if (!Array.isArray(result)) {
    $("resultMeta").textContent = "Komut tamamlandı";
    $("resultArea").innerHTML = `
      <div class="result-empty">
        <strong>Komut başarıyla tamamlandı</strong>
        <p>Sonuç: ${escapeHtml(result)}</p>
      </div>`;
    return;
  }

  if (result.length === 0) {
    $("resultMeta").textContent = "0 satır";
    $("resultArea").innerHTML = `
      <div class="result-empty"><strong>Sonuç bulunamadı</strong><p>Sorgu satır döndürmedi.</p></div>`;
    return;
  }

  const columns = Object.keys(result[0]);
  $("resultMeta").textContent = `${result.length} satır • ${columns.length} sütun`;

  $("resultArea").innerHTML = `
    <table class="sql-result-table">
      <thead><tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
      <tbody>
        ${result.map(row => `
          <tr>${columns.map(column => `
            <td>${row[column] === null ? '<span class="null-value">NULL</span>' : escapeHtml(row[column])}</td>
          `).join("")}</tr>
        `).join("")}
      </tbody>
    </table>`;

  $("downloadButton").disabled = false;
}

function renderFeedback(analysis, elapsed) {
  const used = analysis.usedTopics.length
    ? analysis.usedTopics.map(topic => `<span>${escapeHtml(topic)}</span>`).join("")
    : "<span>Temel sorgu</span>";

  const tips = analysis.tips.length
    ? `<ul>${analysis.tips.map(tip => `<li>${escapeHtml(tip)}</li>`).join("")}</ul>`
    : "<p>Sorgu için ek bir uyarı bulunmadı.</p>";

  $("feedbackArea").innerHTML = `
    <div class="feedback-summary">
      <div><small>Çalışma süresi</small><strong>${elapsed} ms</strong></div>
      <div><small>Dönen satır</small><strong>${analysis.rowCount}</strong></div>
    </div>
    <div class="feedback-block">
      <strong>Kullanılan yapılar</strong>
      <div class="feedback-tags">${used}</div>
    </div>
    <div class="feedback-block">
      <strong>Sorgu ipuçları</strong>
      ${tips}
    </div>`;
}

function renderError(message) {
  $("resultMeta").textContent = "Hata";
  $("resultArea").innerHTML = `
    <div class="result-empty"><strong>Sorgu çalıştırılamadı</strong><p>${escapeHtml(message)}</p></div>`;
  $("feedbackArea").innerHTML = "";
  $("downloadButton").disabled = true;
}

function clearOutput(updateStatus = true) {
  lastResult = null;
  document.querySelectorAll(".check-message").forEach(x => x.remove());
  $("resultMeta").textContent = "Henüz sorgu çalıştırılmadı";
  $("resultArea").innerHTML = `
    <div class="result-empty"><span>⌁</span><strong>Sonuç alanı</strong><p>Sorgu sonuçları burada görünür.</p></div>`;
  $("feedbackArea").innerHTML = "";
  $("downloadButton").disabled = true;
  if (updateStatus) setStatus("Çıktı temizlendi.");
}

function updateStats() {
  const states = data.questions.map(question => ({
    question,
    state: questionState(question.id)
  }));

  const completedCount = states.filter(x => x.state.completed).length;
  const markedCount = states.filter(x => x.state.marked).length;
  const totalAttempts = states.reduce((sum, x) => sum + x.state.attempts, 0);
  const totalCorrect = states.reduce((sum, x) => sum + x.state.correctAttempts, 0);
  const percent = data.questions.length
    ? Math.round((completedCount / data.questions.length) * 100)
    : 0;
  const successRate = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  $("progressPercent").textContent = `%${percent}`;
  $("completedBadge").textContent = `${completedCount} / ${data.questions.length} tamamlandı`;
  $("progressBar").style.width = `${percent}%`;
  $("successRate").textContent = `%${successRate}`;
  $("markedCount").textContent = markedCount;

  const topicStats = {};
  states.forEach(({ question, state }) => {
    for (const topic of question.topics || []) {
      if (!topicStats[topic]) topicStats[topic] = { completed: 0, total: 0, attempts: 0 };
      topicStats[topic].total += 1;
      if (state.completed) topicStats[topic].completed += 1;
      topicStats[topic].attempts += state.topicAttempts?.[topic] || 0;
    }
  });

  const attemptedTopics = Object.entries(topicStats)
    .filter(([, stat]) => stat.attempts > 0 || stat.completed > 0)
    .map(([topic, stat]) => ({
      topic,
      score: stat.total ? stat.completed / stat.total : 0
    }));

  if (attemptedTopics.length) {
    attemptedTopics.sort((a, b) => b.score - a.score);
    $("strongTopic").textContent = attemptedTopics[0].topic;
    $("weakTopic").textContent = attemptedTopics.at(-1).topic;
  } else {
    $("strongTopic").textContent = "—";
    $("weakTopic").textContent = "—";
  }
}

function downloadCsv() {
  if (!Array.isArray(lastResult) || !lastResult.length) return;

  const columns = Object.keys(lastResult[0]);
  const csv = [
    columns.join(","),
    ...lastResult.map(row =>
      columns.map(column =>
        `"${String(row[column] ?? "").replaceAll('"', '""')}"`
      ).join(",")
    )
  ].join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sql-sorgu-sonucu.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function initializeResizeHandle() {
  const handle = $("resizeHandle");
  let dragging = false;
  let startY = 0;
  let startEditorHeight = 0;

  const move = event => {
    if (!dragging) return;
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;
    const delta = clientY - startY;
    const newEditorHeight = Math.max(220, Math.min(650, startEditorHeight + delta));
    const newResultHeight = Math.max(220, Math.min(650, progress.resultHeight - delta));

    progress.editorHeight = newEditorHeight;
    progress.resultHeight = newResultHeight;

    editor?.setSize("100%", newEditorHeight);
    $("resultArea").style.maxHeight = `${newResultHeight}px`;
    $("resultArea").style.minHeight = `${Math.min(newResultHeight, 260)}px`;
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("is-resizing");
    saveProgress();
  };

  handle.addEventListener("pointerdown", event => {
    dragging = true;
    startY = event.clientY;
    startEditorHeight = progress.editorHeight;
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing");
  });

  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

async function initialize() {
  try {
    const response = await fetch(`/data/sql/${databaseKey}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error("Veritabanı verisi yüklenemedi.");
    data = await response.json();

    $("activeDbIcon").textContent = data.icon;
    $("activeDbName").textContent = data.name;
    $("activeDbDescription").textContent = data.description;

    initializeDatabase();
    initializeEditor();
    renderSchemaTabs();

    activeQuestionIndex = Math.min(
      Number(progress.lastQuestionIndex) || 0,
      data.questions.length - 1
    );

    renderQuestionList();
    selectQuestion(activeQuestionIndex);
    updateStats();

    $("resultArea").style.maxHeight = `${progress.resultHeight}px`;
    $("resultArea").style.minHeight = `${Math.min(progress.resultHeight, 260)}px`;
    initializeResizeHandle();

    $("questionSearch").addEventListener("input", event => {
      activeSearch = event.target.value;
      renderQuestionList();
      updateNavigationButtons();
    });

    $("levelFilter").addEventListener("click", event => {
      const button = event.target.closest("button[data-level]");
      if (!button) return;
      activeLevel = button.dataset.level;
      document.querySelectorAll("#levelFilter button").forEach(item =>
        item.classList.toggle("active", item === button)
      );
      renderQuestionList();
      if (visibleIndexes.length && !visibleIndexes.includes(activeQuestionIndex)) {
        selectQuestion(visibleIndexes[0]);
      } else {
        updateNavigationButtons();
      }
    });

    $("unfinishedOnly").addEventListener("change", event => {
      unfinishedOnly = event.target.checked;
      renderQuestionList();
      if (visibleIndexes.length && !visibleIndexes.includes(activeQuestionIndex)) {
        selectQuestion(visibleIndexes[0]);
      } else {
        updateNavigationButtons();
      }
    });

    $("previousQuestionButton").addEventListener("click", () => navigateQuestion(-1));
    $("nextQuestionButton").addEventListener("click", () => navigateQuestion(1));
    $("markButton").addEventListener("click", () => toggleState("marked"));
    $("laterButton").addEventListener("click", () => toggleState("later"));
    $("hintButton").addEventListener("click", showNextHint);

    $("previewTableButton").addEventListener("click", () => {
      editor.setValue(`SELECT *\nFROM ${activeTable};`);
      runQuery();
    });

    $("clearEditorButton").addEventListener("click", () => {
      editor.setValue("");
      editor.focus();
      setStatus("Editör temizlendi.");
    });

    $("resetOutputButton").addEventListener("click", () => clearOutput(true));
    $("runButton").addEventListener("click", () => runQuery());
    $("checkButton").addEventListener("click", checkAnswer);

    $("showSolutionButton").addEventListener("click", () => {
      const content = $("solutionContent");
      const state = questionState(currentQuestion().id);
      content.hidden = !content.hidden;
      $("showSolutionButton").textContent = content.hidden ? "Çözümü Göster" : "Çözümü Gizle";

      if (!content.hidden) {
        state.solutionViewed = true;
        saveProgress();
      }
    });

    $("copySolutionButton").addEventListener("click", () => {
      editor.setValue(currentQuestion().solution);
      editor.focus();
    });

    $("downloadButton").addEventListener("click", downloadCsv);
    setStatus("Editör hazır. Sorgunu yazabilirsin.", "success");
  } catch (error) {
    console.error(error);
    $("activeDbName").textContent = "Veri yüklenemedi";
    $("activeDbDescription").textContent = error.message;
  }
}

window.addEventListener("DOMContentLoaded", initialize);
