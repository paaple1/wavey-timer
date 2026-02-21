const trackEl = document.getElementById("track-sector");
const sectorEl = document.getElementById("timer-sector");
const timeLabelEl = document.getElementById("time-label");
const controlsEl = document.querySelector(".controls");
const inputZoneEl = document.getElementById("input-zone");
const startPauseBtn = document.getElementById("start-pause");
const resetBtn = document.getElementById("reset");
const minuteInput = document.getElementById("minute-input");
const secondInput = document.getElementById("second-input");
const minuteSlider = document.getElementById("minute-slider");
const presetButtons = Array.from(document.querySelectorAll(".preset"));

const COLORS = {
  ok: getComputedStyle(document.documentElement).getPropertyValue("--ok").trim(),
  warn: getComputedStyle(document.documentElement).getPropertyValue("--warn").trim(),
  danger: getComputedStyle(document.documentElement).getPropertyValue("--danger").trim(),
};

let totalMs = 25 * 60 * 1000;
let remainingMs = totalMs;
let running = false;
let endAt = 0;
let rafId = 0;
let idleTimer = 0;
const IDLE_MS = 2200;

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function clearEndedState() {
  document.body.classList.remove("timer-ended");
}

function setEndedState() {
  document.body.classList.add("timer-ended");
}

function toClock(ms) {
  const safeMs = Math.max(0, ms);
  const totalSec = Math.floor(safeMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;

  if (safeMs < 60 * 1000) {
    const tenth = Math.floor((safeMs % 1000) / 100);
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${tenth}`;
  }

  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function toPoint(cx, cy, r, theta) {
  return {
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta),
  };
}

function buildFanPath(progress) {
  const cx = 80;
  const cy = 94;
  const r = 74;
  const p = clamp(progress, 0, 1);
  const startTheta = Math.PI;
  const sweepTheta = Math.PI * p;
  const endTheta = startTheta + sweepTheta;

  if (p <= 0) {
    return `M ${cx} ${cy}`;
  }

  const start = toPoint(cx, cy, r, startTheta);
  const end = toPoint(cx, cy, r, endTheta);
  const largeArcFlag = sweepTheta > Math.PI ? 1 : 0;

  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

function buildTrackPath() {
  return buildFanPath(1);
}

function getColorByRatio(ratio) {
  if (ratio <= 0.1) {
    return COLORS.danger;
  }
  if (ratio <= 0.3) {
    return COLORS.warn;
  }
  return COLORS.ok;
}

function syncInputs() {
  const totalSec = Math.round(totalMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  minuteInput.value = String(min);
  secondInput.value = String(sec);
  minuteSlider.value = String(clamp(Math.round(totalMs / 60000), 1, 180));
}

function setDurationMs(durationMs) {
  const safeMs = clamp(Math.round(durationMs), 1000, 180 * 60 * 1000);
  totalMs = safeMs;
  if (!running) {
    remainingMs = totalMs;
    cancelAnimationFrame(rafId);
    startPauseBtn.textContent = "Start";
  }
  syncInputs();
  clearEndedState();
  render();
}

function setFromMinuteSecondInput() {
  const min = clamp(Math.round(Number(minuteInput.value) || 0), 0, 180);
  const sec = clamp(Math.round(Number(secondInput.value) || 0), 0, 59);
  setDurationMs((min * 60 + sec) * 1000);
}

function render() {
  const ratio = totalMs ? remainingMs / totalMs : 0;
  sectorEl.setAttribute("d", buildFanPath(ratio));
  sectorEl.style.fill = getColorByRatio(ratio);
  timeLabelEl.textContent = toClock(remainingMs);
}

function showInputZone() {
  controlsEl.classList.remove("input-hidden");
  document.body.classList.remove("cursor-hidden");
}

function hideInputZoneIfIdle() {
  if (inputZoneEl.contains(document.activeElement)) {
    return;
  }
  controlsEl.classList.add("input-hidden");
  document.body.classList.add("cursor-hidden");
}

function refreshIdleTimer() {
  showInputZone();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(hideInputZoneIfIdle, IDLE_MS);
}

function tick() {
  if (!running) {
    return;
  }

  remainingMs = Math.max(0, endAt - Date.now());
  render();

  if (remainingMs <= 0) {
    running = false;
    startPauseBtn.textContent = "Start";
    setEndedState();
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function start() {
  if (running) {
    return;
  }
  if (remainingMs <= 0) {
    remainingMs = totalMs;
  }
  clearEndedState();
  running = true;
  endAt = Date.now() + remainingMs;
  startPauseBtn.textContent = "Pause";
  rafId = requestAnimationFrame(tick);
}

function pause() {
  if (!running) {
    return;
  }
  running = false;
  cancelAnimationFrame(rafId);
  remainingMs = Math.max(0, endAt - Date.now());
  startPauseBtn.textContent = "Start";
  render();
}

function toggleStartPause() {
  if (running) {
    pause();
  } else {
    start();
  }
}

startPauseBtn.addEventListener("click", toggleStartPause);

resetBtn.addEventListener("click", () => {
  pause();
  remainingMs = totalMs;
  clearEndedState();
  render();
});

minuteInput.addEventListener("change", () => {
  setFromMinuteSecondInput();
  presetButtons.forEach((btn) => btn.classList.remove("active"));
  refreshIdleTimer();
});

secondInput.addEventListener("change", () => {
  setFromMinuteSecondInput();
  presetButtons.forEach((btn) => btn.classList.remove("active"));
  refreshIdleTimer();
});

minuteSlider.addEventListener("input", () => {
  setDurationMs(Number(minuteSlider.value) * 60 * 1000);
  presetButtons.forEach((btn) => btn.classList.remove("active"));
  refreshIdleTimer();
});

presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    presetButtons.forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    setDurationMs(Number(btn.dataset.minutes) * 60 * 1000);
    refreshIdleTimer();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    toggleStartPause();
  }
  if (event.key.toLowerCase() === "r") {
    pause();
    remainingMs = totalMs;
    render();
  }
  refreshIdleTimer();
});

["pointermove", "pointerdown", "touchstart"].forEach((eventName) => {
  document.addEventListener(eventName, refreshIdleTimer, { passive: true });
});

minuteInput.addEventListener("focus", showInputZone);
secondInput.addEventListener("focus", showInputZone);
minuteSlider.addEventListener("focus", showInputZone);
minuteInput.addEventListener("blur", refreshIdleTimer);
secondInput.addEventListener("blur", refreshIdleTimer);
minuteSlider.addEventListener("blur", refreshIdleTimer);

trackEl.setAttribute("d", buildTrackPath());
syncInputs();
render();
refreshIdleTimer();
