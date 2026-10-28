import { describe, it, expect } from 'vitest';
import {
  getBangkokStartOfDayUtc,
  getBangkokEndOfDayUtc,
  formatTimeHHmmss,
  formatDateDisplay,
} from '../historicalDateUtils';

describe('historicalDateUtils', () => {
  it('converts Bangkok date string to UTC start of day ISO string', () => {
    // 2026-10-28 00:00:00 +07:00 is 2026-10-27 17:00:00 UTC
    const startUtc = getBangkokStartOfDayUtc('2026-10-28');
    expect(startUtc).toBe('2026-10-27T17:00:00.000Z');
  });

  it('converts Bangkok date string to UTC end of day ISO string', () => {
    // 2026-10-28 23:59:59.999 +07:00 is 2026-10-28 16:59:59.999 UTC
    const endUtc = getBangkokEndOfDayUtc('2026-10-28');
    expect(endUtc).toBe('2026-10-28T16:59:59.999Z');
  });

  it('formats UTC ISO timestamp into Bangkok HH:mm:ss', () => {
    // 2026-10-28T03:15:45.000Z -> 10:15:45 in Bangkok (+7)
    const formatted = formatTimeHHmmss('2026-10-28T03:15:45.000Z');
    expect(formatted).toBe('10:15:45');
  });

  it('formats invalid ISO timestamp as fallback dashes', () => {
    expect(formatTimeHHmmss('')).toBe('--:--:--');
    expect(formatTimeHHmmss('invalid')).toBe('--:--:--');
  });

  it('formats date string for readable display', () => {
    expect(formatDateDisplay('2026-10-28')).toBe('28/10/2026');
  });
});
