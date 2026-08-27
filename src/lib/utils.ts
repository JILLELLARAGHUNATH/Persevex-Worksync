import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export { getIndiaWorkdayInfo, getIndiaDateKey, isSameIndiaWorkday } from './attendanceDate';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return '--';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatTime(date: Date | string | number | null | undefined): string {
  if (!date) return '--:--';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '--:--';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

// Formats punch timestamps into accurate hours, minutes, and seconds (HH:MM:SS)
export function formatDurationHMS(
  checkIn: Date | string | null | undefined,
  checkOut?: Date | string | null | undefined,
  nowOrFallback?: Date | number | string | null
): string {
  if (!checkIn) {
    if (typeof nowOrFallback === 'number' && nowOrFallback > 0) {
      const totalSec = Math.round(nowOrFallback * 3600);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return '00:00:00';
  }

  const startTime = new Date(checkIn).getTime();
  if (isNaN(startTime)) return '00:00:00';

  let endTime: number;
  if (checkOut) {
    endTime = new Date(checkOut).getTime();
  } else if (nowOrFallback instanceof Date) {
    endTime = nowOrFallback.getTime();
  } else if (typeof nowOrFallback === 'string' && !isNaN(new Date(nowOrFallback).getTime())) {
    endTime = new Date(nowOrFallback).getTime();
  } else if (typeof nowOrFallback === 'number' && nowOrFallback > 0) {
    const totalSec = Math.round(nowOrFallback * 3600);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  } else {
    endTime = Date.now();
  }

  const diffMs = Math.max(0, endTime - startTime);
  const totalSeconds = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Formats punch timestamps into human-readable formatted string (e.g. 08h 30m 15s)
export function formatDurationHMSFormatted(
  checkIn: Date | string | null | undefined,
  checkOut?: Date | string | null | undefined,
  nowOrFallback?: Date | number | string | null
): string {
  if (!checkIn && (typeof nowOrFallback !== 'number' || nowOrFallback <= 0)) {
    return '00h 00m 00s';
  }

  const digital = formatDurationHMS(checkIn, checkOut, nowOrFallback);
  const [h, m, s] = digital.split(':');
  return `${h}h ${m}m ${s}s`;
}

// Formats punch timestamps into concise hours and minutes
export function formatAttendanceDuration(
  checkIn: Date | string | null | undefined,
  checkOut: Date | string | null | undefined,
  _fallbackHours?: number | null
): string {

  if (!checkIn) return '--';
  if (!checkOut) return 'In Progress';

  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const diffMs = Math.max(0, end - start);
  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMins = Math.floor(totalSeconds / 60);

  if (totalMins < 1) {
    return totalSeconds > 0 ? `${totalSeconds}s` : '< 1m';
  }

  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function formatDuration(decimalHours: number | null | undefined): string {
  if (decimalHours === null || decimalHours === undefined || isNaN(decimalHours) || decimalHours <= 0) {
    return '00:00:00';
  }
  return formatDurationHMS(null, null, decimalHours);
}