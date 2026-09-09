import type { GestureId } from './gestures';

const SWITCH_OBSERVATIONS = 2;
const SWITCH_DURATION_MS = 150;
const DEFAULT_DURATION_MS = 500;

export class GestureStabilizer {
  #stable: GestureId = 'default';
  #pending: GestureId | null = null;
  #pendingObservations = 0;
  #pendingStartedAt = 0;
  #defaultStartedAt: number | null = null;
  #lastTimestamp = Number.NEGATIVE_INFINITY;

  get value() { return this.#stable; }

  reset() {
    this.#stable = 'default';
    this.#pending = null;
    this.#pendingObservations = 0;
    this.#defaultStartedAt = null;
    this.#lastTimestamp = Number.NEGATIVE_INFINITY;
    return this.#stable;
  }

  observe(candidate: GestureId, timestamp: number) {
    if (!Number.isFinite(timestamp) || timestamp < this.#lastTimestamp) return this.#stable;
    this.#lastTimestamp = timestamp;

    if (candidate === this.#stable) {
      this.#pending = null;
      this.#pendingObservations = 0;
      this.#defaultStartedAt = null;
      return this.#stable;
    }

    if (candidate === 'default') {
      this.#pending = null;
      this.#pendingObservations = 0;
      this.#defaultStartedAt ??= timestamp;
      if (timestamp - this.#defaultStartedAt >= DEFAULT_DURATION_MS) {
        this.#stable = 'default';
        this.#defaultStartedAt = null;
      }
      return this.#stable;
    }

    this.#defaultStartedAt = null;
    if (candidate === this.#pending) {
      this.#pendingObservations += 1;
    } else {
      this.#pending = candidate;
      this.#pendingObservations = 1;
      this.#pendingStartedAt = timestamp;
    }

    if (this.#pendingObservations >= SWITCH_OBSERVATIONS && timestamp - this.#pendingStartedAt >= SWITCH_DURATION_MS) {
      this.#stable = candidate;
      this.#pending = null;
      this.#pendingObservations = 0;
    }
    return this.#stable;
  }
}
