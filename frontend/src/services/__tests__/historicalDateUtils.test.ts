import { describe, it, expect } from 'vitest';
import {
  getBangkokStartOfDayUtc,
  getBangkokEndOfDayUtc,
  formatTimeHHmmss,
  formatDateDisplay,
  getBangkokDate,
  getBangkokHour,
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

  it('formats date into Bangkok YYYY-MM-DD string with getBangkokDate', () => {
    // UTC 2026-11-05 18:00:00 is Bangkok 2026-11-06 01:00:00 (+7)
    const d = new Date('2026-11-05T18:00:00.000Z');
    expect(getBangkokDate(d)).toBe('2026-11-06');
  });

  it('extracts Bangkok hour from ISO string or Date with getBangkokHour', () => {
    // UTC 01:30:00 -> Bangkok 08:30:00 (hour 8)
    expect(getBangkokHour('2026-10-28T01:30:00.000Z')).toBe(8);
    // UTC 17:00:00 -> Bangkok 00:00:00 (hour 0)
    expect(getBangkokHour(new Date('2026-10-28T17:00:00.000Z'))).toBe(0);
    // Invalid date fallback
    expect(getBangkokHour('invalid')).toBe(0);
  });
});

