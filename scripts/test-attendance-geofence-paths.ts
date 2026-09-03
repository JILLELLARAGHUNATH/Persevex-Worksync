import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertWithinOfficeGeofence } from '../src/lib/geofence';

const settings = {
  enableLocationCheck: true,
  officeLatitude: '12.916480',
  officeLongitude: '77.618145',
  officeRadiusMeters: '100',
};

const outsideAt200m = {
  lat: 12.916480 + 200 / 111_195,
  lng: 77.618145,
  accuracy: 5,
};

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

async function main() {
  // Policy regression: 200m from an office with a 100m radius cannot be accepted.
  const result = assertWithinOfficeGeofence(settings, outsideAt200m);
  assert.equal(result.ok, false, '200m outside a 100m geofence must be rejected');
  assert.ok(result.distance && result.distance >= 199, 'diagnostic distance should describe the rejection');

  const officeReadingWith86mAccuracy = assertWithinOfficeGeofence(settings, {
    lat: 12.916480,
    lng: 77.618145,
    accuracy: 86,
  });
  assert.equal(officeReadingWith86mAccuracy.ok, true, 'an on-site ±86m reading must proceed to the strict distance check');

  // Concurrent requests must all be rejected before an attendance mutation can be selected.
  let attendanceMutations = 0;
  const attempts = await Promise.all(
    Array.from({ length: 20 }, async () => {
      const attempt = assertWithinOfficeGeofence(settings, outsideAt200m);
      if (attempt.ok) attendanceMutations += 1;
      return attempt;
    })
  );
  assert.equal(attempts.filter((attempt) => !attempt.ok).length, 20);
  assert.equal(attendanceMutations, 0, 'concurrent rejected requests must not reach a mutation');

  const attendanceAction = read('src/actions/attendanceActions.ts');
  const route = read('src/app/api/attendance/check-in-out/route.ts');
  const employeeHub = read('src/components/attendance/EmployeeAttendanceHub.tsx');
  const liveCard = read('src/components/attendance/LiveAttendanceCard.tsx');
  const myAttendance = read('src/components/attendance/MyAttendanceClient.tsx');

  assert.match(attendanceAction, /checkInAction[\s\S]*?assertWithinOfficeGeofence[\s\S]*?prisma\.attendance\.(?:updateMany|create)/);
  assert.match(attendanceAction, /checkOutAction\([\s\S]*?coords[\s\S]*?assertWithinOfficeGeofence[\s\S]*?prisma\.attendance\.updateMany/);
  assert.match(route, /checkOutAction\(body\?\.coords \|\| null\)/);

  for (const [name, source] of [
    ['employee dashboard', employeeHub],
    ['team lead dashboard', liveCard],
    ['attendance client', myAttendance],
  ]) {
    assert.match(source, /handleCheckOut[\s\S]*?getBrowserLocation\(\)[\s\S]*?op: 'checkout'[\s\S]*?coords:/,
      `${name} must send fresh location coordinates to checkout`);
  }

  console.log('PASS: strict 200m rejection, concurrent rejection, and employee/team-lead server paths verified.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
