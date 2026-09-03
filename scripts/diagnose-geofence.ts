import { prisma } from '../src/lib/prisma';
import { assertWithinOfficeGeofence, isLocationCheckEnabled, haversineMeters } from '../src/lib/geofence';

async function diagnoseGeofence() {
  console.log('\n======================================================');
  console.log('🔍 GEOFENCE & OFFICE SETTINGS DIAGNOSTIC');
  console.log('======================================================\n');

  // 1. Fetch from DB
  const dbSettings = await prisma.systemSetting.findUnique({
    where: { id: 'global_config' },
  });

  const allSettings = await prisma.systemSetting.findMany();

  console.log('1. Database SystemSettings:');
  console.log('  Total records in systemSetting table:', allSettings.length);
  console.log('  global_config record:', JSON.stringify(dbSettings, null, 2));

  console.log('\n2. Environment Variables:');
  console.log('  ENABLE_LOCATION_CHECK:', process.env.ENABLE_LOCATION_CHECK);
  console.log('  OFFICE_LATITUDE:', process.env.OFFICE_LATITUDE);
  console.log('  OFFICE_LONGITUDE:', process.env.OFFICE_LONGITUDE);
  console.log('  OFFICE_RADIUS_METERS:', process.env.OFFICE_RADIUS_METERS);

  console.log('\n3. Location Check Enabled State:');
  console.log('  isLocationCheckEnabled(dbSettings):', isLocationCheckEnabled(dbSettings));

  // If dbSettings has coordinates:
  const officeLat = Number(dbSettings?.officeLatitude || 12.91648);
  const officeLng = Number(dbSettings?.officeLongitude || 77.618145);
  const officeRadius = Number(dbSettings?.officeRadiusMeters || 100);

  console.log(`\n4. Active Office Parameters:\n  Lat: ${officeLat}\n  Lng: ${officeLng}\n  Radius: ${officeRadius}m`);

  // Simulate a point ~200m away (1 degree lat ~= 111,320m -> 200m ~= 0.0018 degrees)
  const pgLat = officeLat + 0.0018;
  const pgLng = officeLng;
  const rawDist = haversineMeters({ lat: pgLat, lng: pgLng }, { lat: officeLat, lng: officeLng });

  console.log(`\n5. Test Haversine Distance to simulated PG:\n  Raw Distance: ${rawDist.toFixed(2)}m`);

  console.log('\n6. Geofence Evaluation at 200m for different accuracy values:');

  const accuracies = [undefined, 0, 10, 25, 50, 100, 150, 200, 500];
  for (const acc of accuracies) {
    const res = assertWithinOfficeGeofence(dbSettings, { lat: pgLat, lng: pgLng, accuracy: acc });
    console.log(`  Accuracy ±${acc}m -> ok: ${res.ok}, result:`, res);
  }

  await prisma.$disconnect();
}

diagnoseGeofence();
