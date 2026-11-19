export function getBangkokStartOfDayUtc(dateStr: string): string {
  // Input: 'YYYY-MM-DD'
  // Bangkok is UTC+7 -> local 00:00:00+07:00 = previous day 17:00:00 UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  // Subtract 7 hours to get UTC equivalent of 00:00:00 UTC+7
  date.setUTCHours(date.getUTCHours() - 7);
  return date.toISOString();
}

export function getBangkokEndOfDayUtc(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  // Subtract 7 hours
  date.setUTCHours(date.getUTCHours() - 7);
  return date.toISOString();
}

export function formatTimeHHmmss(isoStr: string): string {
  if (!isoStr) return '--:--:--';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '--:--:--';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export function getBangkokDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getBangkokHour(isoStr: string | Date): number {
  const d = typeof isoStr === 'string' ? new Date(isoStr) : isoStr;
  if (isNaN(d.getTime())) return 0;
  return (d.getUTCHours() + 7) % 24;
}

export interface LastSeenFormatted {
  mainText: string;
  subText: string;
  isToday: boolean;
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const BANGKOK_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatLastSeen(
  lastSeenMs: number,
  nowMs: number = Date.now()
): LastSeenFormatted {
  if (!lastSeenMs || lastSeenMs <= 0 || isNaN(lastSeenMs)) {
    return {
      mainText: 'วันนี้ยังไม่มีการเดินทาง',
      subText: 'ไม่มีประวัติสัญญาณ',
      isToday: false,
    };
  }

  const safeNowMs = !nowMs || isNaN(nowMs) ? Date.now() : nowMs;
  const lastSeenDate = new Date(lastSeenMs);
  const nowDate = new Date(safeNowMs);

  const lastSeenDateStr = getBangkokDate(lastSeenDate);
  const nowDateStr = getBangkokDate(nowDate);

  // Time in Bangkok
  const timeStr = `${BANGKOK_TIME_FORMATTER.format(lastSeenDate)} น.`;

  if (lastSeenDateStr === nowDateStr) {
    const diffSec = Math.max(0, Math.floor((safeNowMs - lastSeenMs) / 1000));
    let subText: string;
    if (diffSec < 60) {
      subText = 'เมื่อสักครู่';
    } else if (diffSec < 3600) {
      subText = `เมื่อ ${Math.floor(diffSec / 60)} นาทีที่แล้ว`;
    } else {
      subText = `เมื่อ ${Math.floor(diffSec / 3600)} ชม. ที่แล้ว`;
    }

    return {
      mainText: timeStr,
      subText,
      isToday: true,
    };
  }

  // Cross-day calculation
  const [nowY, nowM, nowD] = nowDateStr.split('-').map(Number);
  const [lsY, lsM, lsD] = lastSeenDateStr.split('-').map(Number);

  const nowMidnightUtc = Date.UTC(nowY, nowM - 1, nowD);
  const lsMidnightUtc = Date.UTC(lsY, lsM - 1, lsD);
  const diffDays = Math.round((nowMidnightUtc - lsMidnightUtc) / (24 * 3600 * 1000));

  let subText: string;
  if (diffDays === 1) {
    subText = `พบล่าสุด: เมื่อวาน ${timeStr}`;
  } else {
    const yearSuffix = nowY !== lsY ? ` ${lsY}` : '';
    subText = `พบล่าสุด: ${lsD} ${THAI_MONTHS_SHORT[lsM - 1]}${yearSuffix} ${timeStr}`;
  }

  return {
    mainText: 'วันนี้ยังไม่มีการเดินทาง',
    subText,
    isToday: false,
  };
}

