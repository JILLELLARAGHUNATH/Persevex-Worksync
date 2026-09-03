import { assertWithinOfficeGeofence, haversineMeters, DEFAULT_OFFICE_LAT, DEFAULT_OFFICE_LNG } from '../src/lib/geofence';
import { getIndiaWorkdayInfo, getIndiaDateKey } from '../src/lib/attendanceDate';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`, details || '');
    testsFailed++;
  }
}

console.log('\n======================================================');
console.log('🧪 TEST SUITE 1: GEOFENCE MATHEMATICS & GPS ACCURACY');
console.log('======================================================');

const settings = {
  enableLocationCheck: true,
  officeLatitude: String(DEFAULT_OFFICE_LAT),
  officeLongitude: String(DEFAULT_OFFICE_LNG),
  officeRadiusMeters: '100',
};

// Test 1: User exactly at office center (0m distance)
const resultExact = assertWithinOfficeGeofence(settings, {
  lat: DEFAULT_OFFICE_LAT,
  lng: DEFAULT_OFFICE_LNG,
  accuracy: 10,
});
assert(resultExact.ok === true && resultExact.distance === 0, 'Exact office center (0m) is accepted', resultExact);

// Test 2: User at desk inside office (45m distance, accuracy ±25m, radius 100m)
const deltaLat45m = 45 / 111139; // ~45 meters north
const resultInside = assertWithinOfficeGeofence(settings, {
  lat: DEFAULT_OFFICE_LAT + deltaLat45m,
  lng: DEFAULT_OFFICE_LNG,
  accuracy: 25,
});
assert(resultInside.ok === true && (resultInside.distance ?? 0) <= 100, 'Inside office (45m) is accepted', resultInside);

// Test 3: A reading outside the configured radius must never be admitted by GPS accuracy.
const deltaLat103m = 103 / 111139; // ~103 meters
const resultDrift = assertWithinOfficeGeofence(settings, {
  lat: DEFAULT_OFFICE_LAT + deltaLat103m,
  lng: DEFAULT_OFFICE_LNG,
  accuracy: 15,
});
assert(resultDrift.ok === false, 'Outside radius (103m, accuracy ±15m, radius 100m) is rejected', resultDrift);

// Test 4: User genuinely far outside down the street (distance = 160m, accuracy ±20m, radius 100m)
const deltaLat160m = 160 / 111139; // ~160 meters
const resultOutside = assertWithinOfficeGeofence(settings, {
  lat: DEFAULT_OFFICE_LAT + deltaLat160m,
  lng: DEFAULT_OFFICE_LNG,
  accuracy: 20,
});
assert(resultOutside.ok === false, 'Genuinely outside (160m, accuracy ±20m, radius 100m) is rejected firmly', resultOutside);

// Test 5: User 5 kilometers away (remote check-in attempt)
const deltaLat5km = 5000 / 111139; // ~5 km
const resultRemote = assertWithinOfficeGeofence(settings, {
  lat: DEFAULT_OFFICE_LAT + deltaLat5km,
  lng: DEFAULT_OFFICE_LNG,
  accuracy: 15,
});
assert(resultRemote.ok === false, 'Remote user 5 km away is rejected firmly', resultRemote);

// Test 6: Accuracy does not alter the configured distance perimeter.
const resultCoarseIP = assertWithinOfficeGeofence(settings, {
  lat: DEFAULT_OFFICE_LAT + deltaLat45m,
  lng: DEFAULT_OFFICE_LNG,
  accuracy: 2500,
});
assert(resultCoarseIP.ok === true, 'In-radius location is accepted regardless of reported accuracy', resultCoarseIP);

// Test 7: Location check disabled setting
const settingsDisabled = { enableLocationCheck: false };
const resultDisabled = assertWithinOfficeGeofence(settingsDisabled, { lat: 0, lng: 0 });
assert(resultDisabled.ok === true, 'Geofence passes when enableLocationCheck is false', resultDisabled);


console.log('\n======================================================');
console.log('🧪 TEST SUITE 2: TIMEZONE & WORKDAY CALCULATIONS');
console.log('======================================================');

// Test 8: Workday date at 11:00 AM IST
const testTime11AM = new Date('2026-09-02T05:30:00.000Z'); // 11:00 AM IST
const info11AM = getIndiaWorkdayInfo(testTime11AM);
assert(info11AM.dateKey === '2026-09-02' && info11AM.hour === 11, '11:00 AM IST correctly maps to 2026-09-02 dateKey and hour 11', info11AM);

// Test 9: Workday date at 11:00 PM IST (23:00 IST = 17:30 UTC)
const testTime11PM = new Date('2026-09-02T17:30:00.000Z'); // 11:00 PM IST
const info11PM = getIndiaWorkdayInfo(testTime11PM);
assert(info11PM.dateKey === '2026-09-02' && info11PM.hour === 23, '11:00 PM IST maps to 2026-09-02 dateKey and hour 23', info11PM);

// Test 10: Workday date at 11:59 PM IST (23:59 IST = 18:29 UTC)
const testTime1159PM = new Date('2026-09-02T18:29:00.000Z'); // 11:59 PM IST
const info1159PM = getIndiaWorkdayInfo(testTime1159PM);
assert(info1159PM.dateKey === '2026-09-02' && info1159PM.hour === 23, '11:59 PM IST stays in 2026-09-02 workday', info1159PM);

// Test 11: Next workday at 12:01 AM IST (00:01 IST = 18:31 UTC)
const testTime1201AM = new Date('2026-09-02T18:31:00.000Z'); // 12:01 AM IST on Sept 3
const info1201AM = getIndiaWorkdayInfo(testTime1201AM);
assert(info1201AM.dateKey === '2026-09-03' && info1201AM.hour === 0, '12:01 AM IST maps to next day 2026-09-03', info1201AM);

// Test 12: Timezone safe date key formatting
const dateKeyFormatted = getIndiaDateKey(new Date('2026-09-02T18:00:00.000Z')); // 11:30 PM IST on Sept 2
assert(dateKeyFormatted === '2026-09-02', 'getIndiaDateKey correctly formats 11:30 PM IST without prior-day shift', { dateKeyFormatted });


console.log('\n======================================================');
console.log('🧪 TEST SUITE 3: AUTOMATIC 11 PM CHECKOUT CALCULATIONS');
console.log('======================================================');

// Test 13: 11:00 PM IST checkout calculation
const checkInTime = new Date('2026-09-02T05:30:00.000Z'); // 11:00 AM IST
const checkOutTime11PM = new Date(Date.UTC(2026, 8, 2, 17, 30, 0, 0)); // 11:00 PM IST
const diffMs = checkOutTime11PM.getTime() - checkInTime.getTime();
const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
assert(totalHours === 12.0, 'Working hours from 11:00 AM IST to 11:00 PM IST auto-checkout is exactly 12.00 hrs', { totalHours });


console.log('\n======================================================');
console.log(`📊 SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
console.log('======================================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
