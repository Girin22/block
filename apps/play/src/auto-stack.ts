import { AutoStacker, type AutoMove, type AutoPattern } from '../../../packages/play-core/auto';
import type { Rotation } from '../../../packages/play-core';
import { tuning } from './tuning';

/** What auto stacking needs from the game: it plays through the same aim and drop a player's touch does. */
export interface AutoHost {
  /** Whether a block can be moved and dropped right now (not paused, no finger down, tutorial over). */
  ready(): boolean;
  /** Each column's top: the row an upright block would land on. */
  tops(): number[];
  aim(column: number, rotation: Rotation): void;
  /** Resolves true once the block is placed. */
  drop(): Promise<boolean>;
}

/** Milliseconds the block is shown over its column before it is let go, so each move can be followed. */
const AIM_MS = 280, RETRY_MS = 250;
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Auto stacking (always available, chosen on the pause screen): the game keeps laying blocks in one
 * pattern until it is switched off. Each block is moved over its column, held a moment, then dropped
 * like a player's. The player can still move or drop blocks; the pattern picks up again from whatever
 * the top looks like (see AutoStacker).
 */
export class AutoPlay {
  private stacker?: AutoStacker;
  /** A move the stacker has handed out that is not placed yet; it is retried rather than asked for again. */
  private move?: AutoMove;
  private timer = 0;
  constructor(private host: AutoHost) {}
  get pattern(): AutoPattern | undefined { return this.stacker?.pattern; }
  set(pattern?: AutoPattern) {
    if (pattern === this.pattern) return;
    this.stacker = pattern && new AutoStacker(pattern); this.move = undefined;
    this.schedule(RETRY_MS);
  }
  /** A new session: the same pattern, from the bare ground. */
  restart() { const pattern = this.pattern; this.stacker = undefined; this.set(pattern); }
  private schedule(ms: number) {
    clearTimeout(this.timer);
    if (this.stacker) this.timer = window.setTimeout(() => void this.step(), ms);
  }
  private async step() {
    const stacker = this.stacker;
    if (!stacker) return;
    if (!this.host.ready()) { this.schedule(RETRY_MS); return; }
    const move = this.move ??= stacker.next(this.host.tops());
    this.host.aim(move.x, move.rotation);
    await wait(AIM_MS);
    // Switched off or to another pattern meanwhile: set() has already scheduled what comes next.
    if (stacker !== this.stacker) return;
    if (!this.host.ready()) { this.schedule(RETRY_MS); return; }
    // No time limit: a drop only finishes when the screen is being drawn, and one that is still under way
    // must never be made a second time.
    const placed = await this.host.drop();
    if (stacker !== this.stacker) return;
    if (placed) this.move = undefined;
    this.schedule(placed ? tuning.autoInterval * 1000 : RETRY_MS);
  }
}
