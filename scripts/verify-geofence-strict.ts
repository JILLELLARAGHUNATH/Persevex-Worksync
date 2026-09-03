import { assertWithinOfficeGeofence, haversineMeters, DEFAULT_OFFICE_LAT, DEFAULT_OFFICE_LNG } from '../src/lib/geofence';
import { prisma } from '../src/lib/prisma';

let passed = 0;
let failed = 0;

function check(condition: boolean, title: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${title}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${title}`, details || '');
    failed++;
  }
}

async function runGeofenceVerification() {
  console.log('\n======================================================');
  console.log('🧪 STRICT GEOFENCE SECURITY & ACCURACY VERIFICATION');
  console.log('======================================================\n');

  let settings: any = null;
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        settings = await prisma.systemSetting.findUnique({ where: { id: 'global_config' } });
        break;
      } catch {
        if (attempt === 3) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } catch {}

  if (!settings) {
    settings = {
      enableLocationCheck: true,
      officeLatitude: '12.917473',
      officeLongitude: '77.618312',
      officeRadiusMeters: '80',
    };
  }

  const officeLat = Number(settings?.officeLatitude || 12.917473);
  const officeLng = Number(settings?.officeLongitude || 77.618312);
  const radius = Number(settings?.officeRadiusMeters || 80);

  console.log(`Configured Office: Lat=${officeLat}, Lng=${officeLng}, Radius=${radius}m\n`);

  // Helper to generate a coordinate at an exact distance (in meters) north of the office
  // 1 degree latitude = 111,139 meters approx
  const getCoordsAtDistance = (distMeters: number, accuracy = 15) => {
    const latOffset = distMeters / 111139;
    return {
      lat: officeLat + latOffset,
      lng: officeLng,
      accuracy,
    };
  };

  // Test Case 1: Exact office center (0m)
  const c0 = { lat: officeLat, lng: officeLng, accuracy: 5 };
  const r0 = assertWithinOfficeGeofence(settings, c0);
  check(r0.ok === true, 'Test 1: Exact office coordinates (0m) -> ACCEPT');

  // Test Case 2: 30m inside office (radius 80m)
  const c30 = getCoordsAtDistance(30, 10);
  const r30 = assertWithinOfficeGeofence(settings, c30);
  check(r30.ok === true && (r30.distance || 0) <= 80, 'Test 2: 30m from office (radius 80m) -> ACCEPT');

  // Test Case 3: 70m inside office (radius 80m)
  const c70 = getCoordsAtDistance(70, 15);
  const r70 = assertWithinOfficeGeofence(settings, c70);
  check(r70.ok === true && (r70.distance || 0) <= 80, 'Test 3: 70m from office (radius 80m) -> ACCEPT');

  // Test Case 4: 80m boundary
  const c80 = getCoordsAtDistance(80, 10);
  const r80 = assertWithinOfficeGeofence(settings, c80);
  check(r80.ok === true, 'Test 4: 80m exact perimeter boundary -> ACCEPT');

  // Test Case 5: 85m with reliable GPS (indoor edge drift)
  const c85 = getCoordsAtDistance(85, 20);
  const r85 = assertWithinOfficeGeofence(settings, c85);
  check(r85.ok === true, 'Test 5: 85m with reliable GPS (accuracy ±20m) -> ACCEPT within capped tolerance');

  // Test Case 6: 100m from office (radius 80m)
  const c100 = getCoordsAtDistance(100, 20);
  const r100 = assertWithinOfficeGeofence(settings, c100);
  check(r100.ok === false, 'Test 6: 100m from office (radius 80m) -> REJECT');

  // Test Case 7: 150m away
  const c150 = getCoordsAtDistance(150, 15);
  const r150 = assertWithinOfficeGeofence(settings, c150);
  check(r150.ok === false, 'Test 7: 150m from office -> REJECT');

  // Test Case 8: 200m away (PG scenario)
  const c200 = getCoordsAtDistance(200, 25);
  const r200 = assertWithinOfficeGeofence(settings, c200);
  check(r200.ok === false && r200.error?.includes('200m away'), 'Test 8: 200m from office (PG scenario) -> REJECT FIRMLY', { r200 });

  // Test Case 9: 500m away
  const c500 = getCoordsAtDistance(500, 10);
  const r500 = assertWithinOfficeGeofence(settings, c500);
  check(r500.ok === false, 'Test 9: 500m from office -> REJECT');

  // Test Case 10: 1 km away
  const c1000 = getCoordsAtDistance(1000, 10);
  const r1000 = assertWithinOfficeGeofence(settings, c1000);
  check(r1000.ok === false, 'Test 10: 1km from office -> REJECT');

  // Test Case 11: 5 km away
  const c5000 = getCoordsAtDistance(5000, 10);
  const r5000 = assertWithinOfficeGeofence(settings, c5000);
  check(r5000.ok === false, 'Test 11: 5km from office -> REJECT');

  // Test Case 12: Poor/Coarse Accuracy (±150m)
  const cCoarse = getCoordsAtDistance(40, 150);
  const rCoarse = assertWithinOfficeGeofence(settings, cCoarse);
  check(rCoarse.ok === false && rCoarse.error?.includes('accuracy is too low'), 'Test 12: Coarse location accuracy (±150m) -> REJECT with high-accuracy GPS requirement');

  // Test Case 13: Null / Invalid Coordinates
  const rNull = assertWithinOfficeGeofence(settings, null);
  check(rNull.ok === false && rNull.error?.includes('Location required'), 'Test 13: Null coordinates -> REJECT requiring location access');

  console.log('\n======================================================');
  console.log(`📊 GEOFENCE AUDIT SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runGeofenceVerification();
