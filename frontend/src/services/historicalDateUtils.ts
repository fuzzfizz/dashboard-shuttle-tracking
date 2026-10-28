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
