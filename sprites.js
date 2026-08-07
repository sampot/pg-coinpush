import {
  FIELD_LEFT,
  FIELD_RIGHT,
  FRONT_EDGE,
  H,
  SHELF_TOP,
  W,
} from "./game.js";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./game.js').CoinpushGame} game
 */
export function drawScene(ctx, game) {
  const shakeX = (Math.random() - 0.5) * game.shake * 5;
  const shakeY = (Math.random() - 0.5) * game.shake * 4;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // cabinet
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1c1410");
  bg.addColorStop(0.5, "#120e0c");
  bg.addColorStop(1, "#0a0808");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // neon frame
  ctx.fillStyle = "rgba(251, 146, 60, 0.22)";
  ctx.fillRect(0, 0, 14, H);
  ctx.fillRect(W - 14, 0, 14, H);
  ctx.fillStyle = "rgba(251, 191, 36, 0.55)";
  ctx.fillRect(12, 0, 3, H);
  ctx.fillRect(W - 15, 0, 3, H);

  // marquee
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  roundRect(ctx, FIELD_LEFT, 10, FIELD_RIGHT - FIELD_LEFT, 28, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(253, 224, 71, 0.9)";
  ctx.font = "700 13px system-ui, 'PingFang TC', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("推 幣 機", (FIELD_LEFT + FIELD_RIGHT) / 2, 24);

  // glass shelf bed
  const shelf = ctx.createLinearGradient(0, SHELF_TOP, 0, FRONT_EDGE);
  shelf.addColorStop(0, "rgba(56, 40, 28, 0.95)");
  shelf.addColorStop(0.55, "rgba(40, 30, 22, 0.98)");
  shelf.addColorStop(1, "rgba(24, 18, 14, 1)");
  ctx.fillStyle = shelf;
  ctx.fillRect(FIELD_LEFT, SHELF_TOP, FIELD_RIGHT - FIELD_LEFT, FRONT_EDGE - SHELF_TOP + 40);

  // perspective lines
  ctx.strokeStyle = "rgba(251, 191, 36, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const y = SHELF_TOP + ((FRONT_EDGE - SHELF_TOP) * i) / 6;
    ctx.beginPath();
    ctx.moveTo(FIELD_LEFT + 4, y);
    ctx.lineTo(FIELD_RIGHT - 4, y);
    ctx.stroke();
  }

  // drop chute hint
  ctx.fillStyle = "rgba(94, 234, 212, 0.06)";
  ctx.fillRect(FIELD_LEFT, 40, FIELD_RIGHT - FIELD_LEFT, SHELF_TOP - 40);

  // aim guide
  if (game.status === "playing") {
    ctx.strokeStyle = "rgba(253, 224, 71, 0.45)";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(game.aimX, 44);
    ctx.lineTo(game.aimX, SHELF_TOP - 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(game.aimX, 48, 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(253, 224, 71, 0.7)";
    ctx.fill();
  }

  // pusher plate
  const p = game.pusherRect();
  const pg = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  pg.addColorStop(0, "#6b7280");
  pg.addColorStop(0.4, "#9ca3af");
  pg.addColorStop(1, "#4b5563");
  ctx.fillStyle = pg;
  roundRect(ctx, p.x, p.y, p.w, p.h, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(229, 231, 235, 0.65)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // front lip of pusher
  ctx.fillStyle = "rgba(251, 191, 36, 0.35)";
  ctx.fillRect(p.x + 2, p.y + p.h - 5, p.w - 4, 5);

  // front drop edge
  ctx.fillStyle = "rgba(127, 29, 29, 0.55)";
  ctx.fillRect(FIELD_LEFT - 2, FRONT_EDGE, FIELD_RIGHT - FIELD_LEFT + 4, 18);
  ctx.fillStyle = "rgba(252, 165, 165, 0.75)";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText("▼ 掉落得分 ▼", (FIELD_LEFT + FIELD_RIGHT) / 2, FRONT_EDGE + 10);

  // tray below
  ctx.fillStyle = "rgba(15, 10, 8, 0.9)";
  ctx.fillRect(FIELD_LEFT, FRONT_EDGE + 18, FIELD_RIGHT - FIELD_LEFT, H - FRONT_EDGE - 28);
  ctx.fillStyle = "rgba(251, 191, 36, 0.15)";
  roundRect(ctx, FIELD_LEFT + 24, FRONT_EDGE + 36, FIELD_RIGHT - FIELD_LEFT - 48, 52, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(253, 224, 71, 0.55)";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText(`已推出 ${game.pushed} 枚`, (FIELD_LEFT + FIELD_RIGHT) / 2, FRONT_EDGE + 62);

  // coins (back to front)
  const sorted = game.coins.filter((c) => c.alive).sort((a, b) => a.y - b.y);
  for (const c of sorted) {
    drawCoin(ctx, c);
  }

  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./game.js').Coin} c
 */
function drawCoin(ctx, c) {
  const flash = c.flash;
  ctx.save();
  ctx.translate(c.x, c.y);
  const g = ctx.createRadialGradient(-c.r * 0.3, -c.r * 0.35, 1, 0, 0, c.r);
  g.addColorStop(0, `hsla(${c.hue}, 90%, ${72 + flash * 20}%, 1)`);
  g.addColorStop(0.55, `hsla(${c.hue}, 80%, ${48 + flash * 10}%, 1)`);
  g.addColorStop(1, `hsla(${c.hue}, 70%, 28%, 1)`);
  ctx.beginPath();
  ctx.arc(0, 0, c.r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = `hsla(${c.hue}, 60%, 20%, 0.9)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, c.r * 0.62, 0, Math.PI * 2);
  ctx.strokeStyle = `hsla(${c.hue}, 50%, 35%, 0.55)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = `hsla(${c.hue}, 40%, 22%, 0.45)`;
  ctx.font = `700 ${Math.floor(c.r * 0.85)}px system-ui,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("¢", 0, 1);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
