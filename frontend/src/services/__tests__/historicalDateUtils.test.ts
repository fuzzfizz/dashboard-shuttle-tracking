import { describe, it, expect } from 'vitest';
import {
  getBangkokStartOfDayUtc,
  getBangkokEndOfDayUtc,
  formatTimeHHmmss,
  formatDateDisplay,
  getBangkokDate,
  getBangkokHour,
  formatLastSeen,
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

  describe('formatLastSeen', () => {
    // Reference now: 2026-11-19T14:00:00+07:00 (UTC: 2026-11-19T07:00:00Z)
    const mockNow = new Date('2026-11-19T07:00:00Z').getTime();

    it('returns default fallback when timestamp is 0 or invalid', () => {
      expect(formatLastSeen(0, mockNow)).toEqual({
        mainText: 'วันนี้ยังไม่มีการเดินทาง',
        subText: 'ไม่มีประวัติสัญญาณ',
        isToday: false,
      });
      expect(formatLastSeen(NaN, mockNow)).toEqual({
        mainText: 'วันนี้ยังไม่มีการเดินทาง',
        subText: 'ไม่มีประวัติสัญญาณ',
        isToday: false,
      });
      expect(formatLastSeen(-5, mockNow)).toEqual({
        mainText: 'วันนี้ยังไม่มีการเดินทาง',
        subText: 'ไม่มีประวัติสัญญาณ',
        isToday: false,
      });
      expect(formatLastSeen(null as any, mockNow)).toEqual({
        mainText: 'วันนี้ยังไม่มีการเดินทาง',
        subText: 'ไม่มีประวัติสัญญาณ',
        isToday: false,
      });
    });

    it('returns "เมื่อสักครู่" when last seen is within 60 seconds today', () => {
      const lastSeen = mockNow - 30 * 1000; // 30s ago
      const res = formatLastSeen(lastSeen, mockNow);
      expect(res.mainText).toBe('13:59 น.');
      expect(res.subText).toBe('เมื่อสักครู่');
      expect(res.isToday).toBe(true);
    });

    it('returns minutes relative time when last seen was 5 minutes ago today', () => {
      const lastSeen = mockNow - 5 * 60 * 1000;
      const res = formatLastSeen(lastSeen, mockNow);
      expect(res.mainText).toBe('13:55 น.');
      expect(res.subText).toBe('เมื่อ 5 นาทีที่แล้ว');
      expect(res.isToday).toBe(true);
    });

    it('returns hours relative time when last seen was 2 hours ago today', () => {
      const lastSeen = mockNow - 2 * 3600 * 1000;
      const res = formatLastSeen(lastSeen, mockNow);
      expect(res.mainText).toBe('12:00 น.');
      expect(res.subText).toBe('เมื่อ 2 ชม. ที่แล้ว');
      expect(res.isToday).toBe(true);
    });

    it('returns "วันนี้ยังไม่มีการเดินทาง" and yesterday time when last seen was yesterday', () => {
      // Yesterday 17:30 Bangkok time (2026-11-18T10:30:00Z)
      const lastSeen = new Date('2026-11-18T10:30:00Z').getTime();
      const res = formatLastSeen(lastSeen, mockNow);
      expect(res.mainText).toBe('วันนี้ยังไม่มีการเดินทาง');
      expect(res.subText).toBe('พบล่าสุด: เมื่อวาน 17:30 น.');
      expect(res.isToday).toBe(false);
    });

    it('returns "วันนี้ยังไม่มีการเดินทาง" and date string when last seen was 2 days ago', () => {
      // 2026-11-17T07:20:00Z = 14:20 Bangkok time
      const lastSeen = new Date('2026-11-17T07:20:00Z').getTime();
      const res = formatLastSeen(lastSeen, mockNow);
      expect(res.mainText).toBe('วันนี้ยังไม่มีการเดินทาง');
      expect(res.subText).toBe('พบล่าสุด: 17 พ.ย. 14:20 น.');
      expect(res.isToday).toBe(false);
    });
  });
});

