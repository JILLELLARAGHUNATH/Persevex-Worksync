import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/attendance/auto-checkout/route';
import { autoFinalizeForgottenAttendance } from '../src/lib/autoCheckout';
import { getIndiaWorkdayInfo } from '../src/lib/attendanceDate';

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

async function runCronVerification() {
  console.log('\n======================================================');
  console.log('🔍 VERCEL CRON CONFIGURATION & ROUTE SECURITY AUDIT');
  console.log('======================================================\n');

  // 1. Verify vercel.json exists and has valid JSON structure
  const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
  const exists = fs.existsSync(vercelJsonPath);
  check(exists, 'vercel.json exists in root directory');

  if (exists) {
    const content = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    check(Array.isArray(content.crons) && content.crons.length > 0, 'vercel.json contains "crons" array');
    const cronJob = content.crons?.[0];
    check(cronJob?.path === '/api/attendance/auto-checkout', 'Cron path matches "/api/attendance/auto-checkout"', cronJob);
    check(cronJob?.schedule === '30 17 * * *', 'Cron schedule is "30 17 * * *" (17:30 UTC = 11:00 PM IST)', cronJob);
    
    // Check Vercel plan compatibility
    // Daily schedule = 1 execution / 24 hours -> 100% compatible with Hobby and Pro
    check(content.crons.length <= 1, 'Cron count (1) is 100% compatible with Vercel Hobby (Free) and Pro plans');
  }

  // 2. Test Route Handler with CRON_SECRET security
  console.log('\n--- Testing Route Handler Security & CRON_SECRET ---');
  process.env.CRON_SECRET = 'persevex_super_secret_test_token_123';

  // Request without secret -> 401
  const reqNoAuth = new NextRequest('http://localhost:3000/api/attendance/auto-checkout', {
    method: 'GET',
  });
  const resNoAuth = await GET(reqNoAuth);
  check(resNoAuth.status === 401, 'Request without CRON_SECRET returns 401 Unauthorized');

  // Request with invalid secret -> 401
  const reqBadAuth = new NextRequest('http://localhost:3000/api/attendance/auto-checkout', {
    method: 'GET',
    headers: { authorization: 'Bearer wrong_token' },
  });
  const resBadAuth = await GET(reqBadAuth);
  check(resBadAuth.status === 401, 'Request with incorrect Bearer token returns 401 Unauthorized');

  // Request with valid Bearer secret -> 200
  const reqGoodAuth = new NextRequest('http://localhost:3000/api/attendance/auto-checkout', {
    method: 'GET',
    headers: { authorization: 'Bearer persevex_super_secret_test_token_123' },
  });
  const resGoodAuth = await GET(reqGoodAuth);
  const dataGoodAuth = await resGoodAuth.json();
  check(resGoodAuth.status === 200 && dataGoodAuth.success === true, 'Request with valid Bearer token returns 200 OK', dataGoodAuth);

  // Request with query key secret -> 200
  const reqQueryAuth = new NextRequest('http://localhost:3000/api/attendance/auto-checkout?key=persevex_super_secret_test_token_123', {
    method: 'GET',
  });
  const resQueryAuth = await GET(reqQueryAuth);
  const dataQueryAuth = await resQueryAuth.json();
  check(resQueryAuth.status === 200 && dataQueryAuth.success === true, 'Request with valid query key returns 200 OK', dataQueryAuth);

  // Cleanup test env
  delete process.env.CRON_SECRET;

  // 3. Test Safe Execution During Active Workday
  console.log('\n--- Testing Safe Non-Destructive Execution ---');
  const now = new Date();
  const india = getIndiaWorkdayInfo(now);
  console.log(`Current IST Time: ${india.year}-${india.month}-${india.day} ${india.hour}:${india.minute} IST`);

  const finalizedCount = await autoFinalizeForgottenAttendance();
  check(typeof finalizedCount === 'number', `autoFinalizeForgottenAttendance executed safely (processed ${finalizedCount} records)`);

  console.log('\n======================================================');
  console.log(`📊 CRON AUDIT SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCronVerification().catch((err) => {
  console.error('Test script failure:', err);
  process.exit(1);
});
