import { CoinpushAudio } from "./audio.js";
import { CoinpushGame, H, W } from "./game.js";
import { drawScene } from "./sprites.js";

const audio = new CoinpushAudio();
const game = new CoinpushGame();
globalThis.__coinpush = game;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const creditsEl = document.getElementById("credits");
const statusEl = document.getElementById("status");
const btnMute = document.getElementById("btn-mute");
const btnCredit = document.getElementById("btn-credit");
const btnStart = document.getElementById("btn-start");
const btnReset = document.getElementById("btn-reset");

canvas.width = W;
canvas.height = H;

let lastTs = 0;
let running = true;

function setStatus(msg, tone = "") {
  statusEl.textContent = msg;
  statusEl.dataset.tone = tone;
}

function syncHud() {
  scoreEl.textContent = String(game.score);
  creditsEl.textContent = String(game.credits);
  const tone =
    game.lastGain > 0 && game.message.includes("推出")
      ? "win"
      : game.credits <= 0 && game.status !== "ready"
        ? "warn"
        : "";
  setStatus(game.message, tone);
  if (game.status === "ready") {
    btnStart.textContent = "開台";
    btnStart.disabled = false;
  } else if (game.status === "playing") {
    btnStart.textContent = "推幣中";
    btnStart.disabled = true;
  } else if (game.status === "empty") {
    btnStart.textContent = "再開一局";
    btnStart.disabled = false;
  } else {
    btnStart.textContent = "再開一局";
    btnStart.disabled = false;
  }
}

/**
 * @param {string[]} events
 */
function handleEvents(events) {
  for (const e of events) {
    if (e === "drop") audio.drop();
    else if (e === "land") audio.land();
    else if (e === "clink") audio.clink();
    else if (e === "push") audio.push();
    else if (e === "score") audio.score();
    else if (e === "deny") audio.deny();
    else if (e === "empty") audio.empty();
  }
}

/**
 * @param {PointerEvent} ev
 */
function pointerToGameX(ev) {
  const rect = canvas.getBoundingClientRect();
  return ((ev.clientX - rect.left) / rect.width) * W;
}

/**
 * @param {number} ts
 */
function frame(ts) {
  if (!running) return;
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;

  const { events } = game.update(dt);
  handleEvents(events);
  syncHud();
  drawScene(ctx, game);
  requestAnimationFrame(frame);
}

btnStart.addEventListener("click", async () => {
  await audio.unlock();
  if (game.start()) audio.start();
  syncHud();
});

btnReset.addEventListener("click", async () => {
  await audio.unlock();
  game.reset();
  syncHud();
});

btnCredit.addEventListener("click", async () => {
  await audio.unlock();
  if (game.addCredits()) {
    audio.coin();
    syncHud();
  }
});

btnMute.addEventListener("click", async () => {
  await audio.unlock();
  audio.setEnabled(!audio.enabled);
  btnMute.textContent = audio.enabled ? "音效開" : "音效關";
  btnMute.setAttribute("aria-pressed", audio.enabled ? "true" : "false");
});

canvas.addEventListener("pointermove", (ev) => {
  game.setAim(pointerToGameX(ev));
});

canvas.addEventListener("pointerdown", async (ev) => {
  ev.preventDefault();
  await audio.unlock();
  game.setAim(pointerToGameX(ev));
  if (game.status === "ready") {
    if (game.start()) audio.start();
    syncHud();
    return;
  }
  const { ok, events } = game.drop();
  handleEvents(events);
  if (ok) game.lastGain = 0;
  syncHud();
});

document.body.addEventListener(
  "pointerdown",
  () => {
    void audio.unlock();
  },
  { once: true },
);

syncHud();
requestAnimationFrame(frame);
