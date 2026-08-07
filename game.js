/**
 * 推幣機 — simplified coin-pusher physics (circles + AABB pusher).
 * Top-ish view: back = pusher, front = drop edge. Not a full engine.
 */

export const W = 420;
export const H = 640;
export const COIN_R = 14;
export const FIELD_LEFT = 28;
export const FIELD_RIGHT = W - 28;
export const SHELF_TOP = 118;
export const FRONT_EDGE = 528;
export const DROP_Y = 52;
export const PUSHER_H = 36;
export const PUSHER_AMP = 42;
export const PUSHER_PERIOD = 3.2;
export const GRAVITY = 980;
export const FRICTION = 2.8;
export const WALL_REST = 0.35;
export const COIN_REST = 0.28;
export const FIXED_DT = 1 / 120;
export const START_CREDITS = 20;
export const POINTS_PER_COIN = 10;
export const MAX_COINS = 90;

/**
 * @typedef {object} Coin
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} r
 * @property {boolean} falling still dropping onto shelf
 * @property {boolean} alive
 * @property {number} hue gold variation
 * @property {number} flash
 */

export class CoinpushGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.credits = START_CREDITS;
    this.pushed = 0;
    this.t = 0;
    this.shake = 0;
    this.lastGain = 0;
    this.aimX = (FIELD_LEFT + FIELD_RIGHT) / 2;
    /** @type {'ready' | 'playing' | 'empty'} */
    this.status = "ready";
    this.message = "點「開台」開始；點機台選位置投幣";
    /** @type {Coin[]} */
    this.coins = [];
    this.physAcc = 0;
    this.pusherY = SHELF_TOP;
    this.seedShelf();
  }

  start() {
    if (this.status === "playing" && this.credits > 0) return false;
    this.score = 0;
    this.pushed = 0;
    this.credits = START_CREDITS;
    this.coins = [];
    this.seedShelf();
    this.t = 0;
    this.shake = 0;
    this.physAcc = 0;
    this.status = "playing";
    this.message = "點機台上方投下代幣 · 純娛樂計分";
    this.lastGain = 0;
    return true;
  }

  seedShelf() {
    const rows = 4;
    const cols = 7;
    const y0 = SHELF_TOP + PUSHER_H + PUSHER_AMP + 28;
    const y1 = FRONT_EDGE - 70;
    for (let row = 0; row < rows; row++) {
      const y = y0 + (row / (rows - 1)) * (y1 - y0);
      const n = cols - (row % 2);
      const inset = row % 2 === 0 ? 0 : (FIELD_RIGHT - FIELD_LEFT) / cols / 2;
      for (let c = 0; c < n; c++) {
        const x =
          FIELD_LEFT +
          22 +
          inset +
          (c / Math.max(1, n - 1)) * (FIELD_RIGHT - FIELD_LEFT - 44);
        this.coins.push(this.makeCoin(x + (Math.random() - 0.5) * 4, y, false));
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {boolean} falling
   */
  makeCoin(x, y, falling) {
    return {
      x,
      y,
      vx: 0,
      vy: falling ? 40 : 0,
      r: COIN_R,
      falling,
      alive: true,
      hue: 38 + Math.random() * 18,
      flash: 0,
    };
  }

  /**
   * Aim drop X from canvas coords.
   * @param {number} x
   */
  setAim(x) {
    const pad = COIN_R + 2;
    this.aimX = Math.max(FIELD_LEFT + pad, Math.min(FIELD_RIGHT - pad, x));
  }

  /**
   * Spend one credit and drop a coin at aimX.
   */
  drop() {
    /** @type {string[]} */
    const events = [];
    if (this.status !== "playing") {
      this.message = "請先開台";
      events.push("deny");
      return { ok: false, events };
    }
    if (this.credits <= 0) {
      this.status = "empty";
      this.message = `代幣用盡 · 總分 ${this.score} · 可重來`;
      events.push("deny");
      events.push("empty");
      return { ok: false, events };
    }
    if (this.coins.filter((c) => c.alive).length >= MAX_COINS) {
      this.message = "機台太滿，等推板清一點";
      events.push("deny");
      return { ok: false, events };
    }
    this.credits -= 1;
    this.coins.push(this.makeCoin(this.aimX, DROP_Y, true));
    events.push("drop");
    this.message =
      this.credits > 0
        ? `投下代幣 · 剩 ${this.credits} 枚`
        : "最後一枚投下 · 看推板吧";
    if (this.credits <= 0) {
      // still playing until user resets; status empty after last drop settles messaging
    }
    return { ok: true, events };
  }

  pusherRect() {
    const mid = SHELF_TOP + PUSHER_H * 0.35 + PUSHER_AMP * 0.5;
    const y = mid + Math.sin((this.t / PUSHER_PERIOD) * Math.PI * 2) * PUSHER_AMP;
    return {
      x: FIELD_LEFT + 6,
      y,
      w: FIELD_RIGHT - FIELD_LEFT - 12,
      h: PUSHER_H,
    };
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    /** @type {string[]} */
    const events = [];
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 7);

    for (const c of this.coins) {
      if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 3);
    }

    this.physAcc += Math.min(dt, 0.05);
    let guard = 0;
    while (this.physAcc >= FIXED_DT && guard++ < 24) {
      this.physAcc -= FIXED_DT;
      this.t += FIXED_DT;
      this.stepPhysics(FIXED_DT, events);
    }

    const rect = this.pusherRect();
    this.pusherY = rect.y;

    if (this.status === "playing" && this.credits <= 0) {
      const anyFalling = this.coins.some((c) => c.alive && c.falling);
      const moving = this.coins.some(
        (c) => c.alive && !c.falling && Math.hypot(c.vx, c.vy) > 8,
      );
      if (
        !anyFalling &&
        !moving &&
        this.message.indexOf("代幣用盡") < 0 &&
        this.message.indexOf("重來") < 0
      ) {
        this.message = `代幣用盡 · 總分 ${this.score} · 點重來再玩`;
      }
    }

    return { events: uniqueTail(events, 10) };
  }

  /**
   * @param {number} h
   * @param {string[]} events
   */
  stepPhysics(h, events) {
    const pusher = this.pusherRect();
    const omega = (Math.PI * 2) / PUSHER_PERIOD;
    const pusherVy = Math.cos(this.t * omega) * PUSHER_AMP * omega;

    for (const c of this.coins) {
      if (!c.alive) continue;

      if (c.falling) {
        c.vy += GRAVITY * h;
        c.x += c.vx * h;
        c.y += c.vy * h;
        const landY = Math.max(
          pusher.y + pusher.h + c.r + 2,
          SHELF_TOP + PUSHER_H + c.r,
        );
        if (c.y >= landY) {
          c.y = landY;
          c.vy = 0;
          c.vx *= 0.4;
          c.falling = false;
          events.push("land");
        }
        this.clampX(c);
        continue;
      }

      const sp = Math.hypot(c.vx, c.vy);
      if (sp > 0.5) {
        const dec = Math.min(sp, FRICTION * 60 * h);
        c.vx -= (c.vx / sp) * dec;
        c.vy -= (c.vy / sp) * dec;
      } else {
        c.vx = 0;
        c.vy = 0;
      }

      c.x += c.vx * h;
      c.y += c.vy * h;

      this.resolvePusher(c, pusher, pusherVy, events);
      this.clampX(c);

      const back = SHELF_TOP + c.r;
      if (c.y < back) {
        c.y = back;
        if (c.vy < 0) c.vy = -c.vy * WALL_REST;
      }

      if (c.y - c.r > FRONT_EDGE) {
        this.scoreCoin(c, events);
      }
    }

    for (let pass = 0; pass < 3; pass++) {
      this.resolveCoins(events);
    }

    if (this.coins.length > MAX_COINS + 10) {
      this.coins = this.coins.filter((c) => c.alive);
    }
  }

  /**
   * @param {Coin} c
   */
  clampX(c) {
    const left = FIELD_LEFT + c.r;
    const right = FIELD_RIGHT - c.r;
    if (c.x < left) {
      c.x = left;
      if (c.vx < 0) c.vx = -c.vx * WALL_REST;
    } else if (c.x > right) {
      c.x = right;
      if (c.vx > 0) c.vx = -c.vx * WALL_REST;
    }
  }

  /**
   * @param {Coin} c
   * @param {{ x: number, y: number, w: number, h: number }} p
   * @param {number} pusherVy
   * @param {string[]} events
   */
  resolvePusher(c, p, pusherVy, events) {
    const nearestX = Math.max(p.x, Math.min(p.x + p.w, c.x));
    const nearestY = Math.max(p.y, Math.min(p.y + p.h, c.y));
    const dx = c.x - nearestX;
    const dy = c.y - nearestY;
    const dist = Math.hypot(dx, dy);
    if (dist >= c.r || dist < 1e-6) {
      // also check deep overlap when center inside rect
      if (
        c.x > p.x &&
        c.x < p.x + p.w &&
        c.y > p.y &&
        c.y < p.y + p.h
      ) {
        // shove out through front
        c.y = p.y + p.h + c.r + 0.5;
        if (pusherVy > 0) c.vy = Math.max(c.vy, pusherVy * 1.15);
        else c.vy = Math.max(c.vy, 40);
        events.push("push");
      }
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = c.r - dist;
    c.x += nx * overlap;
    c.y += ny * overlap;

    // mainly push forward when plate advancing
    if (pusherVy > 12 && ny > 0.2) {
      c.vy = Math.max(c.vy, pusherVy * 1.05 + 20);
      c.vx += nx * 30;
      if (overlap > 1) events.push("push");
    } else {
      const vn = c.vx * nx + c.vy * ny;
      if (vn < 0) {
        c.vx -= vn * nx * (1 + WALL_REST);
        c.vy -= vn * ny * (1 + WALL_REST);
      }
    }
  }

  /**
   * @param {string[]} events
   */
  resolveCoins(events) {
    const list = this.coins;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      if (!a.alive || a.falling) continue;
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        if (!b.alive || b.falling) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const min = a.r + b.r;
        if (dist >= min || dist < 1e-8) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (min - dist) * 0.5;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        const avn = a.vx * nx + a.vy * ny;
        const bvn = b.vx * nx + b.vy * ny;
        const impulse = ((avn - bvn) * (1 + COIN_REST)) / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
        if (Math.abs(impulse) > 25) events.push("clink");
      }
    }
  }

  /**
   * @param {Coin} c
   * @param {string[]} events
   */
  scoreCoin(c, events) {
    c.alive = false;
    this.score += POINTS_PER_COIN;
    this.pushed += 1;
    this.lastGain = POINTS_PER_COIN;
    this.shake = 0.4;
    events.push("score");
    this.message = `推出！＋${POINTS_PER_COIN} · 總分 ${this.score}`;
  }
}

/**
 * @param {string[]} arr
 * @param {number} n
 */
function uniqueTail(arr, n) {
  const out = [];
  for (let i = arr.length - 1; i >= 0 && out.length < n; i--) {
    if (!out.includes(arr[i])) out.push(arr[i]);
  }
  return out.reverse();
}
