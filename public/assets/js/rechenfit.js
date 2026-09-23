import {
  buildRound,
  calculatePoints,
  DEFAULT_PREFS,
  formatTime,
  generateMcOptions,
  getOperationLabel,
  needsColumn,
  OPERATIONS,
  QUESTIONS_PER_ROUND,
  RANGE_OPTIONS,
  TIME_LIMIT,
} from "./rechenfit-engine.js";
import {
  loadStats,
  saveStats,
  recordResult,
  getAccuracyRate,
} from "./stats.js";
import {
  setupHelpAndStatsModals,
  showToast,
  maybeShowFirstVisitHelp,
  applyHeaderIcons,
  setupVisibilityPause,
  setupQuizKeyboard,
  releaseFocus,
  releaseFocusAfterPaint,
} from "./ui.js";
import { loadJson, removeStored, saveJson } from "./storage.js";

const STORAGE_GAME = "rechenfit";
const STORAGE_STATE = "rechenfit_state";
const STORAGE_PREFS = "rechenfit_prefs";

const setupView = document.getElementById("setup-view");
const playView = document.getElementById("play-view");
const resultView = document.getElementById("result-view");
const operationRow = document.getElementById("operation-row");
const rangeRow = document.getElementById("range-row");
const columnSection = document.getElementById("column-section");
const columnGrid = document.getElementById("column-grid");
const answerModeRow = document.getElementById("answer-mode-row");
const timerModeRow = document.getElementById("timer-mode-row");
const startBtn = document.getElementById("start-btn");
const modeBadgeEl = document.getElementById("mode-badge");
const questionEl = document.getElementById("question-text");
const optionsEl = document.getElementById("options-grid");
const inputRow = document.getElementById("input-row");
const answerInput = document.getElementById("answer-input");
const submitBtn = document.getElementById("submit-btn");
const feedbackEl = document.getElementById("feedback-banner");
const statusEl = document.getElementById("game-status");
const correctEl = document.getElementById("live-correct");
const progressEl = document.getElementById("question-progress");
const scoreWrap = document.getElementById("live-score-wrap");
const scoreEl = document.getElementById("live-score");
const timerWrap = document.getElementById("timer-wrap");
const timerFill = document.getElementById("timer-fill");
const timerValue = document.getElementById("timer-value");
const resultScoreEl = document.getElementById("result-score");
const resultDetailsEl = document.getElementById("result-details");
const restartBtn = document.getElementById("restart-btn");
const settingsBtn = document.getElementById("settings-btn");
const statsModal = document.getElementById("stats-modal");
const helpModal = document.getElementById("help-modal");
const toastEl = document.getElementById("toast");

let stats = loadStats();
let prefs = loadPrefs();
let round = null;
let questionIndex = 0;
let correctCount = 0;
let score = 0;
let timeLeft = TIME_LIMIT;
let timerId = null;
let elapsedTimerId = null;
let elapsed = 0;
let answering = false;
let gameOver = false;

function loadPrefs() {
  return { ...DEFAULT_PREFS, ...loadJson(STORAGE_PREFS, {}) };
}

function savePrefs() {
  saveJson(STORAGE_PREFS, prefs);
}

function loadGameState() {
  return loadJson(STORAGE_STATE, null);
}

function saveGameState() {
  if (!round) return;
  saveJson(STORAGE_STATE, {
    round,
    questionIndex,
    correctCount,
    score,
    elapsed,
    timeLeft,
    answering,
    gameOver,
    dateKey: null,
  });
}

function clearGameState() {
  removeStored(STORAGE_STATE);
}

function stopTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function stopElapsedTimer() {
  if (elapsedTimerId) {
    window.clearInterval(elapsedTimerId);
    elapsedTimerId = null;
  }
}

function startElapsedTimer() {
  stopElapsedTimer();
  elapsedTimerId = window.setInterval(() => {
    elapsed += 1;
  }, 1000);
}

function updateTimerVisual() {
  const ratio = timeLeft / TIME_LIMIT;
  timerFill.style.width = `${ratio * 100}%`;
  timerFill.classList.toggle("warning", timeLeft <= 4 && timeLeft > 2);
  timerFill.classList.toggle("danger", timeLeft <= 2);
  timerValue.textContent = String(timeLeft);
}

function startQuestionTimer(resumeTimeLeft) {
  stopTimer();
  if (!round.timed) return;

  timeLeft = resumeTimeLeft ?? TIME_LIMIT;
  updateTimerVisual();
  timerId = window.setInterval(() => {
    timeLeft -= 1;
    updateTimerVisual();
    if (timeLeft <= 0) {
      stopTimer();
      handleAnswer(null);
    }
  }, 1000);
}

function renderSetupControls() {
  operationRow.innerHTML = "";
  Object.entries(OPERATIONS).forEach(([key, meta]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `option-chip${prefs.operation === key ? " active" : ""}`;
    button.textContent = meta.label;
    button.dataset.operation = key;
    button.addEventListener("click", () => {
      prefs.operation = key;
      savePrefs();
      renderSetupControls();
    });
    operationRow.appendChild(button);
  });

  rangeRow.innerHTML = "";
  RANGE_OPTIONS.forEach(({ value, label }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `option-chip${prefs.rangeMax === value ? " active" : ""}`;
    button.textContent = label;
    button.dataset.range = String(value);
    button.addEventListener("click", () => {
      prefs.rangeMax = value;
      savePrefs();
      renderSetupControls();
    });
    rangeRow.appendChild(button);
  });

  columnSection.classList.toggle("hidden", !needsColumn(prefs.operation));
  columnGrid.innerHTML = "";
  for (let i = 1; i <= 10; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `column-btn${prefs.column === i ? " active" : ""}`;
    button.textContent = String(i);
    button.addEventListener("click", () => {
      prefs.column = i;
      savePrefs();
      renderSetupControls();
    });
    columnGrid.appendChild(button);
  }

  answerModeRow.querySelectorAll("[data-answer-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.answerMode === prefs.answerMode);
    button.onclick = () => {
      prefs.answerMode = button.dataset.answerMode;
      savePrefs();
      renderSetupControls();
    };
  });

  timerModeRow.querySelectorAll("[data-timed]").forEach((button) => {
    const timed = button.dataset.timed === "true";
    button.classList.toggle("active", prefs.timed === timed);
    button.onclick = () => {
      prefs.timed = timed;
      savePrefs();
      renderSetupControls();
    };
  });
}

function showSetupView() {
  stopTimer();
  stopElapsedTimer();
  setupView.classList.remove("hidden");
  playView.classList.add("hidden");
  resultView.classList.add("hidden");
  round = null;
  gameOver = false;
  clearGameState();
  statusEl.textContent = "Wähle Rechenart und Schwierigkeit";
  renderSetupControls();
}

function showPlayView() {
  setupView.classList.add("hidden");
  playView.classList.remove("hidden");
  resultView.classList.add("hidden");
}

function showResultView() {
  setupView.classList.add("hidden");
  playView.classList.add("hidden");
  resultView.classList.remove("hidden");
}

function startRound() {
  savePrefs();
  round = buildRound({
    operation: prefs.operation,
    rangeMax: prefs.rangeMax,
    column: needsColumn(prefs.operation) ? prefs.column : 1,
    answerMode: prefs.answerMode,
    timed: prefs.timed,
  });

  questionIndex = 0;
  correctCount = 0;
  score = 0;
  elapsed = 0;
  gameOver = false;
  answering = false;

  showPlayView();
  scoreWrap.hidden = !round.timed;
  timerWrap.classList.toggle("hidden", !round.timed);
  modeBadgeEl.textContent = getOperationLabel(round.operation);
  statusEl.textContent = `${getOperationLabel(round.operation)} – ${round.timed ? "mit Timer" : "ohne Timer"}`;

  startElapsedTimer();
  showQuestion();
  saveGameState();
}

function restoreGameState(state) {
  round = state.round;
  questionIndex = state.questionIndex;
  correctCount = state.correctCount;
  score = state.score;
  elapsed = state.elapsed ?? 0;
  timeLeft = state.timeLeft ?? TIME_LIMIT;
  answering = false;
  gameOver = state.gameOver;

  if (gameOver) {
    showResultView();
    renderResultSummary(false);
    return true;
  }

  showPlayView();
  scoreWrap.hidden = !round.timed;
  timerWrap.classList.toggle("hidden", !round.timed);
  modeBadgeEl.textContent = getOperationLabel(round.operation);
  statusEl.textContent = `${getOperationLabel(round.operation)} – ${round.timed ? "mit Timer" : "ohne Timer"}`;
  startElapsedTimer();
  showQuestion(timeLeft);
  return true;
}

function getCurrentQuestion() {
  return round.questions[questionIndex];
}

function updateMeta() {
  correctEl.textContent = String(correctCount);
  progressEl.textContent = `${Math.min(questionIndex + 1, QUESTIONS_PER_ROUND)}/${QUESTIONS_PER_ROUND}`;
  scoreEl.textContent = String(score);
}

function showQuestion(resumeTimeLeft) {
  const question = getCurrentQuestion();
  if (!question) {
    finishRound();
    return;
  }

  if (resumeTimeLeft === null) {
    return;
  }

  releaseFocus();

  answering = false;
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback-banner";
  questionEl.textContent = question.prompt;
  answerInput.value = "";

  if (round.answerMode === "choice") {
    optionsEl.classList.remove("hidden");
    inputRow.classList.add("hidden");
    optionsEl.innerHTML = "";

    const mc = generateMcOptions(question.answer, round.rangeMax);
    mc.values.forEach((value, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn";
      button.textContent = String(value);
      button.addEventListener("click", () => handleAnswer(value, index, mc.correctIndex));
      optionsEl.appendChild(button);
    });
    releaseFocusAfterPaint();
  } else {
    optionsEl.classList.add("hidden");
    inputRow.classList.remove("hidden");
    answerInput.disabled = false;
    submitBtn.disabled = false;
    answerInput.focus();
  }

  updateMeta();
  startQuestionTimer(resumeTimeLeft);
}

function handleAnswer(selectedValue, selectedIndex = null, correctIndex = null) {
  if (answering || gameOver) return;

  const question = getCurrentQuestion();
  answering = true;
  stopTimer();

  let isCorrect = false;
  if (round.answerMode === "choice") {
    isCorrect = selectedIndex === correctIndex;
  } else if (selectedValue === null) {
    isCorrect = false;
  } else {
    isCorrect = Number(selectedValue) === question.answer;
  }

  const points = round.timed ? calculatePoints(isCorrect, timeLeft) : 0;

  if (isCorrect) {
    correctCount += 1;
    score += points;
    feedbackEl.textContent = round.timed ? `Richtig! +${points} Punkte` : "Richtig!";
    feedbackEl.className = "feedback-banner correct";
  } else {
    feedbackEl.textContent =
      selectedValue === null
        ? `Zeit abgelaufen – richtig wäre: ${question.answer}`
        : `Falsch – richtig wäre: ${question.answer}`;
    feedbackEl.className = "feedback-banner incorrect";
  }

  if (round.answerMode === "choice") {
    [...optionsEl.children].forEach((button, index) => {
      button.disabled = true;
      if (index === correctIndex) button.classList.add("correct");
      else if (index === selectedIndex) button.classList.add("incorrect");
      else button.classList.add("missed");
    });
    releaseFocus();
  } else {
    answerInput.disabled = true;
    submitBtn.disabled = true;
  }

  updateMeta();
  saveGameState();

  window.setTimeout(() => {
    questionIndex += 1;
    if (questionIndex >= QUESTIONS_PER_ROUND) {
      finishRound();
    } else {
      showQuestion();
      saveGameState();
    }
  }, 1200);
}

function finishRound() {
  gameOver = true;
  stopTimer();
  stopElapsedTimer();

  stats = recordResult(stats, {
    correctCount,
    totalQuestions: QUESTIONS_PER_ROUND,
    score,
    timed: round.timed,
  });
  saveStats(stats);
  saveGameState();
  renderResultSummary(true);
  renderStats();
}

function renderResultSummary(fromFinish) {
  showResultView();

  if (round.timed) {
    resultScoreEl.textContent = String(score);
    resultDetailsEl.textContent =
      `${correctCount} von ${QUESTIONS_PER_ROUND} richtig in ${formatTime(elapsed)}.`;
  } else {
    resultScoreEl.textContent = `${correctCount}/${QUESTIONS_PER_ROUND}`;
    resultDetailsEl.textContent =
      `${correctCount} von ${QUESTIONS_PER_ROUND} Aufgaben richtig in ${formatTime(elapsed)}.`;
  }

  if (fromFinish && correctCount === QUESTIONS_PER_ROUND) {
    statusEl.textContent = "Perfekt – alle 10 richtig!";
  } else if (gameOver) {
    statusEl.textContent = "Runde abgeschlossen";
  }
}

function renderStats() {
  document.getElementById("stat-played").textContent = stats.roundsPlayed;
  document.getElementById("stat-accuracy").textContent = `${getAccuracyRate(stats)}%`;
  document.getElementById("stat-perfect").textContent = stats.perfectRounds;
  document.getElementById("stat-best-round").textContent = stats.bestAccuracy;
  document.getElementById("stat-best-timed").textContent = stats.bestTimedScore;
}

function bindEvents() {
  startBtn.addEventListener("click", startRound);
  restartBtn.addEventListener("click", () => {
    clearGameState();
    startRound();
  });
  settingsBtn.addEventListener("click", showSetupView);

  submitBtn.addEventListener("click", () => {
    if (answerInput.value === "") {
      showToast(toastEl, "Bitte eine Zahl eingeben");
      return;
    }
    handleAnswer(Number(answerInput.value));
  });

  answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (answerInput.value === "") {
        showToast(toastEl, "Bitte eine Zahl eingeben");
        return;
      }
      handleAnswer(Number(answerInput.value));
    }
  });

  setupHelpAndStatsModals({
    helpModal,
    statsModal,
    helpBtn: document.getElementById("help-btn"),
    statsBtn: document.getElementById("stats-btn"),
    onStatsOpen: renderStats,
    gameId: STORAGE_GAME,
  });

  setupVisibilityPause({
    isActive: () => Boolean(round) && !gameOver && !answering && timerId !== null,
    onPause: stopTimer,
    onResume: () => startQuestionTimer(timeLeft),
  });

  setupQuizKeyboard({
    optionsEl,
    onSelect: (index) => {
      const button = optionsEl.children[index];
      if (button && !button.disabled) button.click();
    },
  });
}

function init() {
  applyHeaderIcons();
  renderSetupControls();
  bindEvents();
  renderStats();

  const saved = loadGameState();
  if (saved && restoreGameState(saved)) {
    maybeShowFirstVisitHelp(helpModal, STORAGE_GAME, {
      triggerEl: document.getElementById("help-btn"),
    });
    return;
  }

  showSetupView();

  maybeShowFirstVisitHelp(helpModal, STORAGE_GAME, {
    triggerEl: document.getElementById("help-btn"),
  });
}

init();
