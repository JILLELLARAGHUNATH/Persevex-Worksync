const { calculateLeaveRequestSplit } = require('../src/lib/leaveEntitlement');

// Test helper
function runCase(name, params, expected) {
  const res = calculateLeaveRequestSplit(params);
  const passed =
    res.totalPaidDays === expected.paid &&
    res.totalUnpaidDays === expected.unpaid &&
    res.payTreatment === expected.treatment;

  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`);
  if (!passed) {
    console.log('  Expected:', expected);
    console.log('  Received:', { paid: res.totalPaidDays, unpaid: res.totalUnpaidDays, treatment: res.payTreatment });
    console.log('  Month splits:', res.monthSplits);
  }
}

console.log('=== RUNNING ALL 15 LEAVE ENTITLEMENT TEST CASES ===\n');

// Test 1: Full-Time, Sep, 0.5d, Prev = 0
runCase('Test 1: 0.5 day leave, 0 used', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-01', // Tuesday (Working day)
  endDate: '2026-09-01',
  isHalfDay: true,
  existingApprovedLeaves: [],
}, { paid: 0.5, unpaid: 0, treatment: 'PAID' });

// Test 2: Full-Time, Sep, 1.0d, Prev = 0
runCase('Test 2: 1.0 day leave, 0 used', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-01', // Tuesday
  endDate: '2026-09-01',
  existingApprovedLeaves: [],
}, { paid: 1.0, unpaid: 0, treatment: 'PAID' });

// Test 3: Full-Time, Sep, 1.5d, Prev = 0 (1 full day + 1 half day)
// Note: Sep 1 (Tue) + Sep 2 (Wed is off, Thu is Sep 3)
runCase('Test 3: 1.5 days leave (via 1d + 0.5d prior)', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-04', // Friday
  endDate: '2026-09-04',
  isHalfDay: true,
  existingApprovedLeaves: [{
    id: 'l1',
    startDate: '2026-09-01',
    endDate: '2026-09-01',
    numberOfDays: 1,
    paidDays: 1,
    unpaidDays: 0,
    payTreatment: 'PAID',
    currentStage: 'APPROVED',
  }],
}, { paid: 0.5, unpaid: 0, treatment: 'PAID' });

// Test 4: Full-Time, Sep, 2 days (Sep 1 Tue, Sep 2 Thu -> wait Sep 2 is Wed off, so Sep 1 Tue, Sep 3 Thu)
runCase('Test 4: 2 working days, 0 used -> 1.5 paid + 0.5 unpaid', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-01', // Tuesday
  endDate: '2026-09-03', // Thursday (Wed is weekly off, so 2 working days: Tue & Thu)
  existingApprovedLeaves: [],
}, { paid: 1.5, unpaid: 0.5, treatment: 'SPLIT' });

// Test 5: Full-Time, Sep, 3 working days (Sep 1 Tue, Sep 3 Thu, Sep 4 Fri)
runCase('Test 5: 3 working days, 0 used -> 1.5 paid + 1.5 unpaid', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-01', // Tue
  endDate: '2026-09-04', // Fri (Tue, Thu, Fri = 3 working days)
  existingApprovedLeaves: [],
}, { paid: 1.5, unpaid: 1.5, treatment: 'SPLIT' });

// Test 6: Full-Time, Sep, Prev = 1.0d, Req = 1.0d -> 0.5 paid + 0.5 unpaid
runCase('Test 6: Prev 1.0d used, Req 1.0d -> 0.5 paid + 0.5 unpaid', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-10', // Thursday
  endDate: '2026-09-10',
  existingApprovedLeaves: [{
    id: 'l1',
    startDate: '2026-09-01',
    endDate: '2026-09-01',
    numberOfDays: 1,
    paidDays: 1,
    unpaidDays: 0,
    payTreatment: 'PAID',
    currentStage: 'APPROVED',
  }],
}, { paid: 0.5, unpaid: 0.5, treatment: 'SPLIT' });

// Test 7: Full-Time, Sep, Prev = 1.5d, Req = 1.0d -> 0 paid + 1.0 unpaid
runCase('Test 7: Prev 1.5d used, Req 1.0d -> 0 paid + 1.0 unpaid', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-10', // Thursday
  endDate: '2026-09-10',
  existingApprovedLeaves: [{
    id: 'l1',
    startDate: '2026-09-01',
    endDate: '2026-09-03',
    numberOfDays: 2,
    paidDays: 1.5,
    unpaidDays: 0.5,
    payTreatment: 'SPLIT',
    currentStage: 'APPROVED',
  }],
}, { paid: 0, unpaid: 1.0, treatment: 'UNPAID' });

// Test 8: Monthly reset: Sep Used = 1.5, Oct Req = 1.5 (Oct 1 Thu, Oct 2 Fri = 2 days)
runCase('Test 8: Sep Used 1.5, Oct fresh 1.5 entitlement', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-10-01', // Thursday
  endDate: '2026-10-02', // Friday (2 days)
  existingApprovedLeaves: [{
    id: 'l1',
    startDate: '2026-09-01',
    endDate: '2026-09-03',
    numberOfDays: 2,
    paidDays: 1.5,
    unpaidDays: 0.5,
    payTreatment: 'SPLIT',
    currentStage: 'APPROVED',
  }],
}, { paid: 1.5, unpaid: 0.5, treatment: 'SPLIT' });

// Test 9: Full-Time Team Lead, Sep, Req 2 days -> 1.5 paid + 0.5 unpaid
runCase('Test 9: Full-Time Team Lead receives 1.5 paid days/month', {
  user: { role: 'TEAM_LEAD', employmentType: 'FULL_TIME' },
  startDate: '2026-09-01',
  endDate: '2026-09-03', // 2 working days
  existingApprovedLeaves: [],
}, { paid: 1.5, unpaid: 0.5, treatment: 'SPLIT' });

// Test 10: Intern, Req 2 days -> 0 paid + 2.0 unpaid
runCase('Test 10: Intern does NOT get Full-Time 1.5 paid days', {
  user: { role: 'EMPLOYEE', employmentType: 'INTERN' },
  startDate: '2026-09-01',
  endDate: '2026-09-03',
  existingApprovedLeaves: [],
}, { paid: 0, unpaid: 2.0, treatment: 'UNPAID' });

// Test 11: Wednesday Weekly Off (Sep 2) is 0 leave days
runCase('Test 11: Wednesday Weekly off consumes 0 entitlement', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-02', // Wednesday
  endDate: '2026-09-02',
  existingApprovedLeaves: [],
}, { paid: 0, unpaid: 0, treatment: 'PAID' });

// Test 12: Company Holiday consumes 0 entitlement
runCase('Test 12: Company Holiday consumes 0 entitlement', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-01',
  endDate: '2026-09-01',
  calendarOverrides: [{ dateKey: '2026-09-01', type: 'COMPANY_HOLIDAY', title: 'Festival' }],
  existingApprovedLeaves: [],
}, { paid: 0, unpaid: 0, treatment: 'PAID' });

// Test 13: Special Working Day counts as working leave day
runCase('Test 13: Special Working Day counts as working day', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-02', // Wednesday overridden as SPECIAL_WORKING_DAY
  endDate: '2026-09-02',
  calendarOverrides: [{ dateKey: '2026-09-02', type: 'SPECIAL_WORKING_DAY', title: 'Work Day' }],
  existingApprovedLeaves: [],
}, { paid: 1.0, unpaid: 0, treatment: 'PAID' });

// Test 14: Crosses Sep 30 (Wed - wait Sep 30 is Wed? Let's check 2026-09-30)
// Sep 29 = Tue (1d), Sep 30 = Wed (Off), Oct 1 = Thu (1d), Oct 2 = Fri (1d)
runCase('Test 14: Cross-month leave (Sep 29 -> Oct 2: 1d Sep, 2d Oct)', {
  user: { role: 'EMPLOYEE', employmentType: 'FULL_TIME' },
  startDate: '2026-09-29', // Tue (1d)
  endDate: '2026-10-02', // Wed off, Thu (1d), Fri (1d) = 2d Oct
  existingApprovedLeaves: [],
}, { paid: 2.5, unpaid: 0.5, treatment: 'SPLIT' }); // Sep: 1.0 paid; Oct: 1.5 paid + 0.5 unpaid = 2.5 paid + 0.5 unpaid

console.log('\n=== ALL TEST RUNS COMPLETE ===');
