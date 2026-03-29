import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BudgetTracker } from '../src/budget.js';
import { BudgetExceededError } from '../src/types.js';

describe('BudgetTracker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('unlimited (no config)', () => {
    it('canSpend returns true for any amount', () => {
      const tracker = new BudgetTracker({});
      expect(tracker.canSpend(1_000_000)).toBe(true);
    });

    it('does not throw on recordSpend', () => {
      const tracker = new BudgetTracker({});
      expect(() => tracker.recordSpend(500)).not.toThrow();
    });
  });

  describe('per-call limit', () => {
    it('canSpend returns true within limit', () => {
      const tracker = new BudgetTracker({ maxPerCallCents: 500 });
      expect(tracker.canSpend(499)).toBe(true);
      expect(tracker.canSpend(500)).toBe(true);
    });

    it('canSpend returns false over limit', () => {
      const tracker = new BudgetTracker({ maxPerCallCents: 500 });
      expect(tracker.canSpend(501)).toBe(false);
    });

    it('throws BudgetExceededError with per-call limitType', () => {
      const tracker = new BudgetTracker({ maxPerCallCents: 300 });
      tracker.recordSpend(100);
      expect(() => tracker.recordSpend(400)).toThrow(BudgetExceededError);
      try {
        tracker.recordSpend(400);
      } catch (e) {
        expect(e).toBeInstanceOf(BudgetExceededError);
        const err = e as BudgetExceededError;
        expect(err.limitType).toBe('per-call');
        expect(err.limitCents).toBe(300);
        expect(err.requestedCents).toBe(400);
      }
    });
  });

  describe('daily cumulative limit', () => {
    it('allows spend within daily limit', () => {
      const tracker = new BudgetTracker({ maxDailyCents: 1000 });
      tracker.recordSpend(400);
      tracker.recordSpend(400);
      expect(tracker.canSpend(200)).toBe(true);
    });

    it('blocks spend that would exceed daily limit', () => {
      const tracker = new BudgetTracker({ maxDailyCents: 1000 });
      tracker.recordSpend(800);
      expect(tracker.canSpend(300)).toBe(false);
    });

    it('throws BudgetExceededError with daily limitType when cumulative exceeded', () => {
      const tracker = new BudgetTracker({ maxDailyCents: 500 });
      tracker.recordSpend(300);
      expect(() => tracker.recordSpend(300)).toThrow(BudgetExceededError);
      try {
        tracker.recordSpend(300);
      } catch (e) {
        const err = e as BudgetExceededError;
        expect(err.limitType).toBe('daily');
        expect(err.limitCents).toBe(500);
      }
    });
  });

  describe('stats', () => {
    it('starts with zero stats', () => {
      const tracker = new BudgetTracker({});
      const stats = tracker.getStats();
      expect(stats.totalCents).toBe(0);
      expect(stats.todayCents).toBe(0);
      expect(stats.callCount).toBe(0);
    });

    it('accumulates totalCents, todayCents, callCount', () => {
      const tracker = new BudgetTracker({});
      tracker.recordSpend(100);
      tracker.recordSpend(250);
      const stats = tracker.getStats();
      expect(stats.totalCents).toBe(350);
      expect(stats.todayCents).toBe(350);
      expect(stats.callCount).toBe(2);
    });
  });

  describe('day rollover', () => {
    it('resets todayCents and daily accumulation on date boundary change', () => {
      vi.useFakeTimers();
      const now = new Date('2026-01-15T10:00:00Z');
      vi.setSystemTime(now);

      const tracker = new BudgetTracker({ maxDailyCents: 500 });
      tracker.recordSpend(400);
      expect(tracker.getStats().todayCents).toBe(400);

      // Advance time to next UTC day
      vi.setSystemTime(new Date('2026-01-16T10:00:00Z'));

      // After rollover, daily bucket resets — can now spend again
      expect(tracker.canSpend(400)).toBe(true);
      tracker.recordSpend(400);

      const stats = tracker.getStats();
      expect(stats.todayCents).toBe(400);
      expect(stats.totalCents).toBe(800); // total accumulates across days
      expect(stats.callCount).toBe(2);
    });
  });
});
