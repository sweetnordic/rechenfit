import { setIconButton } from "./icons.js";

const HELP_SEEN_PREFIX = "rechenfit_help_seen_";

let activeModal = null;
let activeModalTrigger = null;
let modalKeyHandlerBound = false;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getDialogEl(modal) {
  return modal.querySelector('.modal, [role="dialog"]') || modal;
}

function getFocusableElements(container) {
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hidden && el.getAttribute("aria-hidden") !== "true",
  );
}

function handleModalKeydown(event) {
  if (!activeModal) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeModal(activeModal);
    return;
  }

  if (event.key !== "Tab") return;

  const dialog = getDialogEl(activeModal);
  const focusable = getFocusableElements(dialog);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function ensureModalKeyHandler() {
  if (modalKeyHandlerBound) return;
  document.addEventListener("keydown", handleModalKeydown);
  modalKeyHandlerBound = true;
}

export function isModalOpen() {
  return Boolean(activeModal) || document.querySelector(".modal-overlay.open");
}

export function releaseFocus() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}

export function releaseFocusAfterPaint() {
  releaseFocus();
  requestAnimationFrame(releaseFocus);
}

export function openModal(modal, { triggerEl } = {}) {
  if (!modal) return;

  ensureModalKeyHandler();
  activeModalTrigger = triggerEl || document.activeElement;
  activeModal = modal;

  modal.inert = false;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  const dialog = getDialogEl(modal);
  dialog.setAttribute("aria-modal", "true");
  const focusable = getFocusableElements(dialog);
  if (focusable.length > 0) {
    focusable[0].focus();
  } else {
    dialog.setAttribute("tabindex", "-1");
    dialog.focus();
  }
}

export function closeModal(modal) {
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  modal.inert = true;
  getDialogEl(modal).removeAttribute("aria-modal");

  if (activeModal === modal) {
    activeModal = null;
    const trigger = activeModalTrigger;
    activeModalTrigger = null;
    if (trigger && typeof trigger.focus === "function") {
      trigger.focus();
    }
  }
}

export function bindModalOverlay(modal, { onClose } = {}) {
  if (!modal) return;

  modal.inert = !modal.classList.contains("open");

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal(modal);
      onClose?.();
    }
  });

  const closeBtn = modal.querySelector("[data-close]");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      closeModal(modal);
      onClose?.();
    });
  }
}

export function resetFirstVisitHelp(gameId) {
  if (!gameId) return;
  localStorage.removeItem(`${HELP_SEEN_PREFIX}${gameId}`);
}

function attachHelpReshowControls({ helpModal, statsModal, gameId, helpBtn, statsBtn }) {
  if (!gameId || !helpModal) return;

  const toastEl = document.getElementById("toast");

  if (statsModal && statsBtn && !statsModal.querySelector("[data-show-help]")) {
    const actions = statsModal.querySelector(".modal-actions");
    if (actions) {
      actions.classList.add("modal-actions-split");

      const showHelpBtn = document.createElement("button");
      showHelpBtn.type = "button";
      showHelpBtn.className = "btn btn-secondary";
      showHelpBtn.dataset.showHelp = "true";
      showHelpBtn.textContent = "Anleitung erneut anzeigen";
      showHelpBtn.addEventListener("click", () => {
        closeModal(statsModal);
        openModal(helpModal, { triggerEl: statsBtn });
      });
      actions.insertBefore(showHelpBtn, actions.firstChild);
    }
  }

  if (!helpModal.querySelector("[data-reset-help-auto]")) {
    const actions = helpModal.querySelector(".modal-actions");
    if (actions) {
      actions.classList.add("modal-actions-split");

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "btn btn-secondary";
      resetBtn.dataset.resetHelpAuto = "true";
      resetBtn.textContent = "Beim nächsten Besuch automatisch anzeigen";
      resetBtn.addEventListener("click", () => {
        resetFirstVisitHelp(gameId);
        showToast(
          toastEl,
          "Anleitung erscheint beim nächsten Besuch wieder automatisch.",
        );
      });
      actions.insertBefore(resetBtn, actions.querySelector("[data-close]"));
    }
  }
}

export function setupHelpAndStatsModals({
  helpModal,
  statsModal,
  helpBtn,
  statsBtn,
  onStatsOpen,
  gameId,
}) {
  if (helpBtn && helpModal) {
    helpBtn.addEventListener("click", () => {
      openModal(helpModal, { triggerEl: helpBtn });
    });
    bindModalOverlay(helpModal);
  }

  if (statsBtn && statsModal) {
    statsBtn.addEventListener("click", () => {
      onStatsOpen?.();
      openModal(statsModal, { triggerEl: statsBtn });
    });
    bindModalOverlay(statsModal);
  }

  attachHelpReshowControls({
    helpModal,
    statsModal,
    gameId,
    helpBtn,
    statsBtn,
  });
}

export function showToast(toastEl, message, duration = 1800) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastEl.classList.remove("show");
  }, duration);
}

export function maybeShowFirstVisitHelp(helpModal, gameId, { triggerEl } = {}) {
  if (!helpModal || !gameId) return false;

  const key = `${HELP_SEEN_PREFIX}${gameId}`;
  if (localStorage.getItem(key)) return false;

  localStorage.setItem(key, "1");
  openModal(helpModal, { triggerEl });
  return true;
}

export function setupVisibilityPause({ isActive, onPause, onResume }) {
  document.addEventListener("visibilitychange", () => {
    if (!isActive()) return;
    if (document.hidden) onPause();
    else onResume();
  });
}

export function applyHeaderIcons() {
  setIconButton(document.getElementById("help-btn"), "question-circle");
  setIconButton(document.getElementById("stats-btn"), "bar-chart");
}

export function setupQuizKeyboard({ optionsEl, onSelect, onContinue, canContinue }) {
  document.addEventListener("keydown", (event) => {
    if (isModalOpen()) return;

    if (canContinue?.() && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onContinue?.();
      return;
    }

    if (!optionsEl || optionsEl.children.length === 0) return;

    const keyMap = {
      1: 0,
      2: 1,
      3: 2,
      4: 3,
      a: 0,
      b: 1,
      c: 2,
      d: 3,
    };
    const index = keyMap[event.key.toLowerCase()];
    if (index === undefined) return;

    const button = optionsEl.children[index];
    if (!button || button.disabled) return;

    event.preventDefault();
    onSelect(index);
  });
}
