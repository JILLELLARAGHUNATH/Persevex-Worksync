// Attendance preset validation script
function getLocalDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const now = new Date();
const todayStr = getLocalDateKey(now);
const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
const yesterdayStr = getLocalDateKey(yesterdayDate);
const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

console.log('Local timezone offset (minutes):', new Date().getTimezoneOffset());
console.log('Local today:', todayStr, 'yesterday:', yesterdayStr);
console.log('StartOfWeek:', getLocalDateKey(startOfWeek), 'StartOfMonth:', getLocalDateKey(startOfMonth));
console.log('EndOfToday (ISO):', endOfToday.toISOString());

const samples = [
  // Times around UTC day boundary to catch timezone shifts
  new Date().toISOString(),
  '2026-08-22T23:30:00Z',
  '2026-08-22T00:30:00Z',
  '2026-08-21T23:59:59Z',
  '2026-08-23T00:00:00Z',
];

function matchesPreset(iso, preset, customDate = '') {
  const recordDateObj = new Date(iso);
  const recordDateStr = getLocalDateKey(recordDateObj);
  if (preset === 'TODAY') return recordDateStr === todayStr;
  if (preset === 'YESTERDAY') return recordDateStr === yesterdayStr;
  if (preset === 'THIS_WEEK') return !(recordDateObj < startOfWeek || recordDateObj > endOfToday);
  if (preset === 'THIS_MONTH') return !(recordDateObj < startOfMonth || recordDateObj > endOfToday);
  if (preset === 'CUSTOM' && customDate) return recordDateStr === customDate;
  return true; // ALL
}

console.log('\nSample records and their local keys:');
samples.forEach((s) => {
  const d = new Date(s);
  console.log('-', s, '=> local:', d.toString(), 'key:', getLocalDateKey(d));
});

console.log('\nPreset membership test:');
samples.forEach((s) => {
  console.log('\nRecord:', s);
  ['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'ALL'].forEach((p) => {
    console.log(' ', p, ':', matchesPreset(s, p));
  });
});

// Edge-case test: record at UTC midnight yesterday
const tzSensitive = new Date();
const testIso1 = new Date(tzSensitive.getFullYear(), tzSensitive.getMonth(), tzSensitive.getDate(), 0, 30, 0).toISOString();
console.log('\nEdge check — local midnight-ish sample:', testIso1, '=> local key:', getLocalDateKey(testIso1));
console.log('TODAY match:', matchesPreset(testIso1, 'TODAY'), 'YESTERDAY match:', matchesPreset(testIso1, 'YESTERDAY'));

console.log('\nDone.');
