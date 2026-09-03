import { prisma } from '../src/lib/prisma';
import { getIndiaWorkdayInfo } from '../src/lib/attendanceDate';
import { assertWithinOfficeGeofence, DEFAULT_OFFICE_LAT, DEFAULT_OFFICE_LNG } from '../src/lib/geofence';
import { appEvents, EVENT_TYPES } from '../src/lib/events';

async function traceAttendancePerformance() {
  console.log('\n================================================================');
  console.log('🔬 PHASE 1: EXACT PERFORMANCE TRACE & LATENCY AUDIT');
  console.log('================================================================\n');

  try {
    // 1. Warm-up database connection
    await prisma.user.findFirst({ select: { id: true } });

    // Pick a test employee
    let employee = await prisma.user.findFirst({ where: { role: 'EMPLOYEE', isDeleted: false } });
    if (!employee) {
      employee = await prisma.user.create({
        data: { email: 'perf_emp@test.local', password: 'hash', fullName: 'Perf Tester', role: 'EMPLOYEE', employeeId: 'PE-001' }
      });
    }

    const testDate = new Date(Date.UTC(2030, 0, 15, 5, 30, 0, 0));
    const india = getIndiaWorkdayInfo(testDate);

    // Clean up any test record on that date
    await prisma.attendance.deleteMany({ where: { userId: employee.id, date: india.canonicalDate } });

    // -------------------------------------------------------------
    // STEP 4: GEOFENCE CALCULATION
    // -------------------------------------------------------------
    const t0_settings = performance.now();
    const settings = await prisma.systemSetting.findUnique({ where: { id: 'global_config' } });
    const t1_settings = performance.now();
    const settingsDuration = t1_settings - t0_settings;

    const t0_geo = performance.now();
    const geofenceResult = assertWithinOfficeGeofence(settings, {
      lat: DEFAULT_OFFICE_LAT + (20 / 111139), // 20m inside office
      lng: DEFAULT_OFFICE_LNG,
      accuracy: 15,
    });
    const t1_geo = performance.now();
    const geofenceCalcDuration = t1_geo - t0_geo;

    // -------------------------------------------------------------
    // STEP 7, 8, 9: AUTH, SETTINGS, & EXISTING ATTENDANCE LOOKUP
    // -------------------------------------------------------------
    const t0_lookup = performance.now();
    const [existingRecord, officeSettings] = await Promise.all([
      prisma.attendance.findFirst({
        where: {
          userId: employee.id,
          OR: [
            { date: india.canonicalDate },
            { date: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
            { checkInTime: { gte: india.startOfDayIST, lte: india.endOfDayIST } },
          ],
        },
      }),
      prisma.systemSetting.findUnique({ where: { id: 'global_config' } }),
    ]);
    const t1_lookup = performance.now();
    const lookupDuration = t1_lookup - t0_lookup;

    // -------------------------------------------------------------
    // STEP 12: ATOMIC DATABASE CREATION (CLOCK IN)
    // -------------------------------------------------------------
    const t0_create = performance.now();
    const createdAttendance = await prisma.attendance.create({
      data: {
        userId: employee.id,
        date: india.canonicalDate,
        checkInTime: new Date(),
        status: 'PRESENT',
        lateStatus: 'ON_TIME',
      },
    });
    const t1_create = performance.now();
    const createDuration = t1_create - t0_create;

    // -------------------------------------------------------------
    // STEP 14: ASYNCHRONOUS REALTIME EVENT EMISSION
    // -------------------------------------------------------------
    const t0_event = performance.now();
    appEvents.emit(EVENT_TYPES.ATTENDANCE_UPDATE, {
      status: 'CHECKED_IN',
      attendance: createdAttendance,
      userId: employee.id,
    });
    const t1_event = performance.now();
    const eventEmissionDuration = t1_event - t0_event;

    // -------------------------------------------------------------
    // STEP 13: ATOMIC DATABASE UPDATE (CLOCK OUT)
    // -------------------------------------------------------------
    const t0_update = performance.now();
    const updateResult = await prisma.attendance.updateMany({
      where: {
        id: createdAttendance.id,
        checkInTime: { not: null },
        checkOutTime: null,
      },
      data: {
        checkOutTime: new Date(),
        totalHours: 8.5,
      },
    });
    const t1_update = performance.now();
    const updateDuration = t1_update - t0_update;

    // Clean up test record
    await prisma.attendance.deleteMany({ where: { id: createdAttendance.id } });

    console.log('-------------------------------------------------------------');
    console.log('📊 MEASURED BACKEND LATENCIES (EXACT MS)');
    console.log('-------------------------------------------------------------');
    console.log(`1. Geofence Calculation (Haversine formula)   : ${geofenceCalcDuration.toFixed(4)} ms`);
    console.log(`2. Office Settings Retrieval (Individual)    : ${settingsDuration.toFixed(2)} ms`);
    console.log(`3. Parallel Attendance & Settings Lookup     : ${lookupDuration.toFixed(2)} ms`);
    console.log(`4. Atomic Database Insert (Clock In)         : ${createDuration.toFixed(2)} ms`);
    console.log(`5. Realtime Local Event Emission             : ${eventEmissionDuration.toFixed(4)} ms`);
    console.log(`6. Atomic Database Update (Clock Out)        : ${updateDuration.toFixed(2)} ms`);
    console.log('-------------------------------------------------------------');

    const totalServerClockIn = lookupDuration + geofenceCalcDuration + createDuration + eventEmissionDuration;
    const totalServerClockOut = lookupDuration + geofenceCalcDuration + updateDuration + eventEmissionDuration;

    console.log(`\n🎯 TOTAL SERVER-SIDE CLOCK IN TIME : ${totalServerClockIn.toFixed(2)} ms`);
    console.log(`🎯 TOTAL SERVER-SIDE CLOCK OUT TIME: ${totalServerClockOut.toFixed(2)} ms`);
    console.log('-------------------------------------------------------------\n');

  } catch (error) {
    console.error('Performance trace error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

traceAttendancePerformance();
