/**
 * Authoritative Attendance-Hours Classification Module for Persevex WorkSync.
 * 
 * Single Source of Truth:
 * Office timing: 11:00 AM to 8:00 PM (9 elapsed hours)
 * Normal 1-hour break is non-working duration.
 * Required actual working duration: 8 hours.
 * 
 * Authoritative Classification Rules:
 * 1. Full Day (PRESENT):
 *    - Actual worked duration >= 8.0 hours
 *    - Day value / earned units = 1.0
 * 2. Half Day (HALF_DAY):
 *    - Actual worked duration >= 4.0 hours AND < 8.0 hours
 *    - Day value / earned units = 0.5
 * 3. Below Half Day (ABSENT / Unpaid):
 *    - Actual worked duration < 4.0 hours
 *    - Day value / earned units = 0.0
 *    - Classified as Absent / Unpaid according to payroll rules (1.0 day unpaid deduction on working days)
 */

export type AttendanceClassificationType = 'FULL_DAY' | 'HALF_DAY' | 'ABSENT';

export interface AttendanceClassification {
  classification: AttendanceClassificationType;
  dbStatus: 'PRESENT' | 'HALF_DAY' | 'ABSENT';
  dayUnits: number; // 1.0, 0.5, 0.0
  label: 'Full Day' | 'Half Day' | 'Below Half Day' | 'Absent';
  workedHours: number;
}

/**
 * Classifies worked hours into authoritative day status and units.
 * Precision: exact decimal hours, with epsilon tolerance for floating-point calculations.
 */
export function classifyAttendanceHours(hours: number | null | undefined): AttendanceClassification {
  const worked = typeof hours === 'number' && !isNaN(hours) ? Math.max(0, hours) : 0;

  // Full Day: >= 8 hours
  if (worked >= 7.999) {
    return {
      classification: 'FULL_DAY',
      dbStatus: 'PRESENT',
      dayUnits: 1.0,
      label: 'Full Day',
      workedHours: worked,
    };
  }

  // Half Day: >= 4 hours and < 8 hours
  if (worked >= 3.999) {
    return {
      classification: 'HALF_DAY',
      dbStatus: 'HALF_DAY',
      dayUnits: 0.5,
      label: 'Half Day',
      workedHours: worked,
    };
  }

  // Below Half Day: < 4 hours
  return {
    classification: 'ABSENT',
    dbStatus: 'ABSENT',
    dayUnits: 0.0,
    label: worked > 0 ? 'Below Half Day' : 'Absent',
    workedHours: worked,
  };
}

/**
 * Calculates decimal worked hours between check-in and check-out timestamps.
 */
export function calculateWorkedHours(
  checkIn: Date | string | null | undefined,
  checkOut?: Date | string | null | undefined
): number {
  if (!checkIn) return 0;
  const start = new Date(checkIn).getTime();
  if (isNaN(start)) return 0;

  const end = checkOut ? new Date(checkOut).getTime() : Date.now();
  if (isNaN(end)) return 0;

  const diffMs = Math.max(0, end - start);
  return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
}
