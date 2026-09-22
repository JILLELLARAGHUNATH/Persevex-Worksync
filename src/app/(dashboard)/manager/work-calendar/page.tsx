import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getWorkCalendarMonthAction } from '@/actions/calendarActions';
import WorkCalendarClient from '@/components/calendar/WorkCalendarClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ManagerWorkCalendarPage() {
  const session = await getSession();
  if (!session || session.role !== 'MANAGER') {
    redirect('/login');
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const res = await getWorkCalendarMonthAction({ year, month });
  const initialCalendar = res.calendar || {
    year,
    month,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
    calendarDaysCount: 30,
    weeklyOffsCount: 4,
    companyHolidaysCount: 0,
    specialWorkingDaysCount: 0,
    workingDaysCount: 26,
    days: [],
  };

  return (
    <WorkCalendarClient
      initialCalendar={initialCalendar}
      initialYear={year}
      initialMonth={month}
      role="MANAGER"
      currentUserId={session.id}
    />
  );
}
