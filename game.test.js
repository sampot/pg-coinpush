import { describe, expect, it } from "vitest";
import {
  COIN_R,
  CoinpushGame,
  FIELD_LEFT,
  FIXED_DT,
  FRONT_EDGE,
  MAX_COINS,
  PAYOUT_LEFT,
  PAYOUT_RIGHT,
  PUSHER_H,
  SHELF_TOP,
} from "./game.js";

function shelfCoin(game, y, x = FIELD_LEFT + COIN_R + 40) {
  return game.makeCoin(x, y, false);
}

/** Deterministic Math.random for seeding/session tests. */
function withSeededRandom(fn) {
  const saved = Math.random;
  let seed = 7;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  try {
    return fn();
  } finally {
    Math.random = saved;
  }
}

function step(game, seconds, events = []) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) game.stepPhysics(FIXED_DT, events);
}

describe("shelf is flat: no free forward motion", () => {
  it("leaves a coin resting mid-shelf untouched", () => {
    const game = new CoinpushGame();
    const coin = shelfCoin(game, FRONT_EDGE - COIN_R - 40);
    game.coins = [coin];
    const y0 = coin.y;

    step(game, 1);

    expect(coin.vy).toBe(0);
    expect(coin.y).toBeCloseTo(y0, 6);
  });

  it("leaves a coin resting at the very edge untouched", () => {
    const game = new CoinpushGame();
    const coin = shelfCoin(game, FRONT_EDGE - 2);
    game.coins = [coin];
    const y0 = coin.y;

    step(game, 1);

    expect(coin.vy).toBe(0);
    expect(coin.y).toBeCloseTo(y0, 6);
    expect(coin.alive).toBe(true);
    expect(game.score).toBe(0);
  });

  it("stops a shoved coin within a short slide", () => {
    const game = new CoinpushGame();
    const coin = shelfCoin(game, SHELF_TOP + PUSHER_H + 80);
    coin.vy = 82;
    game.coins = [coin];
    const y0 = coin.y;

    step(game, 1.5);

    expect(coin.vy).toBe(0);
    expect(coin.y - y0).toBeLessThan(20);
  });
});

describe("tipping over the front edge", () => {
  it("keeps an overhanging coin whose center is still supported", () => {
    const game = new CoinpushGame();
    const coin = shelfCoin(game, FRONT_EDGE - 1);
    game.coins = [coin];

    step(game, 0.5);

    expect(coin.alive).toBe(true);
    expect(game.score).toBe(0);
  });

  it("scores once the center of mass passes the edge", () => {
    const game = new CoinpushGame();
    const coin = shelfCoin(game, FRONT_EDGE - 1, (PAYOUT_LEFT + PAYOUT_RIGHT) / 2);
    coin.vy = 60;
    game.coins = [coin];
    const events = [];

    step(game, 0.5, events);

    expect(coin.alive).toBe(false);
    expect(game.score).toBeGreaterThan(0);
    expect(events).toContain("score");
  });
});

describe("coin contacts obey Newton's third law", () => {
  it("separates a resting overlap without adding velocity", () => {
    const game = new CoinpushGame();
    const rear = shelfCoin(game, 300);
    const front = shelfCoin(game, 320);
    front.x += 8;
    game.coins = [rear, front];

    game.resolveCoins([]);

    expect(rear.vx).toBe(0);
    expect(rear.vy).toBe(0);
    expect(front.vx).toBe(0);
    expect(front.vy).toBe(0);
  });

  it("conserves momentum when transmitting a push", () => {
    const game = new CoinpushGame();
    const rear = shelfCoin(game, 300);
    const front = shelfCoin(game, 322);
    rear.vy = 70;
    game.coins = [rear, front];
    const before = rear.vy + front.vy;

    game.resolveCoins([]);

    expect(rear.vy + front.vy).toBeCloseTo(before, 6);
    expect(front.vy).toBeGreaterThan(0);
  });

  it("does not drift a compressed pack forward on its own", () => {
    const game = new CoinpushGame();
    const pack = [];
    for (let i = 0; i < 6; i++) {
      pack.push(shelfCoin(game, 380 + i * (COIN_R * 2 - 3)));
    }
    game.coins = pack;
    const frontY = pack[pack.length - 1].y;

    step(game, 2);

    expect(pack[pack.length - 1].y - frontY).toBeLessThan(COIN_R);
    expect(game.score).toBe(0);
  });
});

describe("pusher plate transmits at most its own speed", () => {
  it("never accelerates a coin beyond the plate velocity", () => {
    const game = new CoinpushGame();
    const plate = game.pusherRect();
    const coin = shelfCoin(game, plate.y + plate.h + COIN_R - 3);
    game.coins = [coin];
    const plateVy = 60;

    game.resolvePusher(coin, plate, plateVy, []);

    expect(coin.vy).toBeLessThanOrEqual(plateVy + 1e-6);
  });

  it("does not pull coins along while retracting", () => {
    const game = new CoinpushGame();
    const plate = game.pusherRect();
    const coin = shelfCoin(game, plate.y + plate.h + COIN_R + 6);
    game.coins = [coin];

    game.resolvePusher(coin, plate, -60, []);

    expect(coin.vy).toBe(0);
  });
});

describe("front ledge: payout window vs side returns", () => {
  it("scores a coin tipping over the center window", () => {
    const game = new CoinpushGame();
    const coin = shelfCoin(game, FRONT_EDGE - 1, (PAYOUT_LEFT + PAYOUT_RIGHT) / 2);
    coin.vy = 60;
    game.coins = [coin];
    const events = [];

    step(game, 0.5, events);

    expect(coin.alive).toBe(false);
    expect(game.score).toBeGreaterThan(0);
    expect(game.lost).toBe(0);
    expect(events).toContain("score");
  });

  it("loses a coin tipping over a side return", () => {
    const game = new CoinpushGame();
    const coin = shelfCoin(game, FRONT_EDGE - 1, PAYOUT_LEFT - COIN_R - 2);
    coin.vy = 60;
    game.coins = [coin];
    const events = [];

    step(game, 0.5, events);

    expect(coin.alive).toBe(false);
    expect(game.score).toBe(0);
    expect(game.lost).toBe(1);
    expect(events).toContain("lost");
    expect(events).not.toContain("score");
  });
});

describe("full machine", () => {
  it("denies the drop without awarding coins", () => {
    const game = new CoinpushGame();
    game.start();
    game.coins = [];
    for (let i = 0; i < MAX_COINS; i++) {
      const col = i % 12;
      const row = Math.floor(i / 12);
      game.coins.push(
        shelfCoin(game, 250 + row * COIN_R * 2, FIELD_LEFT + COIN_R + col * 28),
      );
    }
    game.setAim(FIELD_LEFT + COIN_R + 3 * 28);
    const creditsBefore = game.credits;

    const { ok, events } = game.drop();

    expect(ok).toBe(false);
    expect(events).toContain("deny");
    expect(events).not.toContain("score");
    expect(game.score).toBe(0);
    expect(game.credits).toBe(creditsBefore);
  });
});

describe("session payout", () => {
  /** @param {(k: number) => number} aim */
  function session(aim, credits) {
    return withSeededRandom(() => {
      const game = new CoinpushGame();
      game.start();
      let inserted = 0;
      const frames = 45 * credits + 60 * 8;
      for (let frame = 0; frame < frames; frame++) {
        if (frame % 45 === 0 && inserted < credits) {
          if (game.credits <= 2) game.addCredits(20);
          game.setAim(aim(inserted));
          if (game.drop().ok) inserted += 1;
        }
        game.update(1 / 60);
      }
      return { inserted, pushed: game.pushed, lost: game.lost, game };
    });
  }

  it("pays out well under the coins inserted, but is not dead", () => {
    const r = session((k) => 210 + ((k % 3) - 1) * 40, 40);

    expect(r.inserted).toBe(40);
    expect(r.pushed).toBeGreaterThan(4);
    expect(r.pushed / r.inserted).toBeGreaterThan(0.2);
    expect(r.pushed / r.inserted).toBeLessThan(0.65);
  });

  it("conserves coins: everything inserted is on the shelf, paid, or lost", () => {
    const r = session((k) => 210 + ((k % 3) - 1) * 40, 40);
    const seeded = new CoinpushGame().aliveCount();

    expect(r.game.aliveCount() + r.pushed + r.lost).toBe(seeded + r.inserted);
  });

  it("punishes dropping down the side returns", () => {
    const middle = session(
      (k) => (PAYOUT_LEFT + PAYOUT_RIGHT) / 2 + ((k % 3) - 1) * 30,
      40,
    );
    const sides = session((k) => (k % 2 ? FIELD_LEFT + 34 : 358), 40);

    expect(sides.pushed).toBeLessThan(middle.pushed);
    expect(sides.lost).toBeGreaterThan(middle.lost);
  });

  it("stops paying out entirely once the credits stop coming", () => {
    const r = session((k) => 210 + ((k % 3) - 1) * 40, 20);

    // The plate keeps stroking, so any remaining slack may still shed a coin.
    for (let frame = 0; frame < 60 * 30; frame++) r.game.update(1 / 60);
    const settled = r.game.pushed;
    for (let frame = 0; frame < 60 * 30; frame++) r.game.update(1 / 60);

    expect(r.game.pushed).toBe(settled);
  });
});
