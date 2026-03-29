import { BudgetConfig, SpendingStats, BudgetExceededError } from './types.js';

export class BudgetTracker {
  private config: BudgetConfig;
  private totalCents = 0;
  private todayCents = 0;
  private callCount = 0;
  private currentDay: string;

  constructor(config: BudgetConfig) {
    this.config = config;
    this.currentDay = this.getUtcDay();
  }

  private getUtcDay(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private checkDayRollover(): void {
    const today = this.getUtcDay();
    if (today !== this.currentDay) {
      this.currentDay = today;
      this.todayCents = 0;
    }
  }

  canSpend(amountCents: number): boolean {
    this.checkDayRollover();

    if (this.config.maxPerCallCents !== undefined) {
      if (amountCents > this.config.maxPerCallCents) {
        return false;
      }
    }

    if (this.config.maxDailyCents !== undefined) {
      if (this.todayCents + amountCents > this.config.maxDailyCents) {
        return false;
      }
    }

    return true;
  }

  recordSpend(amountCents: number): void {
    this.checkDayRollover();

    if (this.config.maxPerCallCents !== undefined && amountCents > this.config.maxPerCallCents) {
      throw new BudgetExceededError(amountCents, this.config.maxPerCallCents, 'per-call');
    }

    if (
      this.config.maxDailyCents !== undefined &&
      this.todayCents + amountCents > this.config.maxDailyCents
    ) {
      throw new BudgetExceededError(amountCents, this.config.maxDailyCents, 'daily');
    }

    this.totalCents += amountCents;
    this.todayCents += amountCents;
    this.callCount += 1;
  }

  getStats(): SpendingStats {
    this.checkDayRollover();
    return {
      totalCents: this.totalCents,
      todayCents: this.todayCents,
      callCount: this.callCount,
    };
  }
}
