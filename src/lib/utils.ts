import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '--';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}, ${d.getFullYear()}`;
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '--:--';
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours.toString().padStart(2, '0');
  return `${strHours}:${minutes} ${ampm}`;
}

// Formats punch timestamps into accurate hours, minutes, and seconds
export function formatAttendanceDuration(
  checkIn: Date | string | null | undefined,
  checkOut: Date | string | null | undefined,
  fallbackHours?: number | null
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
    return '0m';
  }
  const totalMinutes = Math.round(Number(decimalHours) * 60);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}