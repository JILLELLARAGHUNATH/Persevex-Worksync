import { buildMonthWorkCalendar } from '../src/lib/calendar';
import { calculateLeaveRequestSplit, isEligibleForMonthlyPaidLeave, MONTHLY_PAID_LEAVE_QUOTA } from '../src/lib/leaveEntitlement';
import { calculateEmployeePayroll } from '../src/lib/payroll';

console.log('========================================================================');
console.log('   PERSEVEX WORKSYNC — COMPREHENSIVE ENTITLEMENT & PAYROLL TEST SUITE   ');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] Test ${totalTests}: ${desc}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] Test ${totalTests}: ${desc}`);
  }
}

// 1. Policy Quota Constant
assert(MONTHLY_PAID_LEAVE_QUOTA === 1.5, 'Authoritative Monthly Paid Leave Quota is 1.5 days');

// 2. Eligibility
const ftEmployee = { id: 'u1', fullName: 'Alice FT', role: 'EMPLOYEE', employmentType: 'FULL_TIME' };
const ftTeamLead = { id: 'u2', fullName: 'Bob TL', role: 'TEAM_LEAD', employmentType: 'FULL_TIME' };
const intern = { id: 'u3', fullName: 'Charlie Intern', role: 'EMPLOYEE', employmentType: 'INTERN' };
const manager = { id: 'u4', fullName: 'Dave Manager', role: 'MANAGER', employmentType: 'FULL_TIME' };

assert(isEligibleForMonthlyPaidLeave(ftEmployee) === true, 'Full-time employee is eligible for 1.5d/month');
assert(isEligibleForMonthlyPaidLeave(ftTeamLead) === true, 'Full-time team lead is eligible for 1.5d/month');
assert(isEligibleForMonthlyPaidLeave(intern) === false, 'Intern is NOT eligible for paid leave entitlement');
assert(isEligibleForMonthlyPaidLeave(manager) === false, 'Manager is excluded from employee leave entitlement');

// 3. Single Day Leave (1.0 Day)
// Sep 1, 2026 is Tuesday (Working day)
const res1 = calculateLeaveRequestSplit({
  user: ftEmployee,
  startDate: new Date(2026, 8, 1),
  endDate: new Date(2026, 8, 1),
  calendarOverrides: [],
  existingApprovedLeaves: [],
});
assert(res1.totalApplicableDays === 1.0, '1-day leave is 1.0 working day');
assert(res1.totalPaidDays === 1.0, '1-day leave allocated 1.0 Paid day');
assert(res1.totalUnpaidDays === 0.0, '1-day leave allocated 0.0 Unpaid days');
assert(res1.payTreatment === 'PAID', 'Pay treatment is PAID');
assert(res1.monthSplits[0].remainingAfter === 0.5, 'Remaining entitlement after 1-day leave is 0.5 days');

// 4. Half Day Leave (0.5 Day)
const resHalf = calculateLeaveRequestSplit({
  user: ftEmployee,
  startDate: new Date(2026, 8, 1),
  endDate: new Date(2026, 8, 1),
  isHalfDay: true,
  calendarOverrides: [],
  existingApprovedLeaves: [],
});
assert(resHalf.totalApplicableDays === 0.5, 'Half-day leave is 0.5 working days');
assert(resHalf.totalPaidDays === 0.5, 'Half-day leave allocated 0.5 Paid days');
assert(resHalf.totalUnpaidDays === 0.0, 'Half-day leave allocated 0.0 Unpaid days');
assert(resHalf.payTreatment === 'PAID', 'Half-day pay treatment is PAID');
assert(resHalf.monthSplits[0].remainingAfter === 1.0, 'Remaining entitlement after half day is 1.0 days');

// 5. Automatic Split (2 Working Days requested with 1.5 Quota)
// Sep 1 (Tue), Sep 3 (Thu) - Sep 2 is Wed Weekly Off -> 2 working days
const resSplit = calculateLeaveRequestSplit({
  user: ftEmployee,
  startDate: new Date(2026, 8, 1),
  endDate: new Date(2026, 8, 3), // Sep 1 (Tue), Sep 2 (Wed - Off), Sep 3 (Thu)
  calendarOverrides: [],
  existingApprovedLeaves: [],
});
assert(resSplit.totalApplicableDays === 2.0, 'Sep 1-3 spans 2 working days (Wed excluded)');
assert(resSplit.totalPaidDays === 1.5, 'Allocated 1.5 Paid days');
assert(resSplit.totalUnpaidDays === 0.5, 'Allocated 0.5 Unpaid days');
assert(resSplit.payTreatment === 'SPLIT', 'Pay treatment is SPLIT');
assert(resSplit.monthSplits[0].remainingAfter === 0.0, 'Remaining entitlement is 0.0 after split');

// 6. Subsequent Leave in same month when entitlement is exhausted
const existingSepLeaves = [
  {
    id: 'l1',
    startDate: new Date(2026, 8, 1),
    endDate: new Date(2026, 8, 3),
    paidDays: 1.5,
    unpaidDays: 0.5,
    numberOfDays: 2.0,
    currentStage: 'APPROVED',
  },
];
const resExhausted = calculateLeaveRequestSplit({
  user: ftEmployee,
  startDate: new Date(2026, 8, 10), // Sep 10 (Thu)
  endDate: new Date(2026, 8, 11), // Sep 11 (Fri) -> 2 working days
  calendarOverrides: [],
  existingApprovedLeaves: existingSepLeaves as any,
});
assert(resExhausted.totalApplicableDays === 2.0, 'Subsequent leave is 2.0 working days');
assert(resExhausted.totalPaidDays === 0.0, 'Allocated 0.0 Paid days (Exhausted)');
assert(resExhausted.totalUnpaidDays === 2.0, 'Allocated 2.0 Unpaid days');
assert(resExhausted.payTreatment === 'UNPAID', 'Pay treatment is UNPAID when exhausted');
assert(resExhausted.monthSplits[0].remainingBefore === 0.0, 'Remaining entitlement was 0.0');

// 7. Cross-Month Leave (Sep 29 to Oct 03)
// Sep 29 (Tue: Working), Sep 30 (Wed: Off) -> 1 working day in Sep
// Oct 01 (Thu: Working), Oct 02 (Fri: Working), Oct 03 (Sat: Working) -> 3 working days in Oct
const resCross = calculateLeaveRequestSplit({
  user: ftEmployee,
  startDate: new Date(2026, 8, 29),
  endDate: new Date(2026, 9, 3),
  calendarOverrides: [],
  existingApprovedLeaves: [],
});
console.log('Cross-month split details:', JSON.stringify(resCross.monthSplits, null, 2));

assert(resCross.monthSplits.length === 2, 'Cross-month leave splits across 2 calendar months');
const sepSplit = resCross.monthSplits.find((m) => m.monthKey === '2026-09')!;
const octSplit = resCross.monthSplits.find((m) => m.monthKey === '2026-10')!;
assert(sepSplit.applicableDays === 1.0, 'Sep portion is 1.0 working day (Wed off)');
assert(sepSplit.paidDays === 1.0, 'Sep portion allocated 1.0 Paid day');
assert(sepSplit.remainingAfter === 0.5, 'Sep remaining entitlement is 0.5 days');
assert(octSplit.applicableDays === 3.0, 'Oct portion is 3.0 working days');
assert(octSplit.paidDays === 1.5, 'Oct fresh reset allows 1.5 Paid days');
assert(octSplit.unpaidDays === 1.5, 'Oct excess is 1.5 Unpaid days');
assert(octSplit.remainingAfter === 0.0, 'Oct remaining entitlement is 0.0 days');
assert(resCross.totalPaidDays === 2.5, 'Total cross-month Paid days = 1.0 + 1.5 = 2.5d');
assert(resCross.totalUnpaidDays === 1.5, 'Total cross-month Unpaid days = 1.5d');

// 8. Payroll Engine Integration Test
const sepCalendar = buildMonthWorkCalendar(2026, 9, []);
const salaryRecords = [
  {
    id: 's1',
    baseSalary: 30000,
    employmentType: 'FULL_TIME',
    effectiveFrom: new Date(2026, 0, 1),
    effectiveTo: null,
  },
];

// Provide attendance for all working days not on leave (23 days PRESENT)
const attendances = sepCalendar.days
  .filter((d) => d.isWorkingDay && d.dateKey !== '2026-09-01' && d.dateKey !== '2026-09-03')
  .map((d, i) => ({
    id: `att-${i}`,
    date: new Date(d.canonicalDate),
    status: 'PRESENT',
  }));

// Employee has 1 leave in Sep (Sep 1 to 3) approved as SPLIT (1.5 Paid, 0.5 Unpaid)
const payrollCalc = calculateEmployeePayroll({
  user: {
    id: 'u1',
    fullName: 'Alice FT',
    employeeId: 'PVS-001',
    employmentType: 'FULL_TIME',
    team: { name: 'Engineering' },
  },
  calendarSummary: sepCalendar,
  salaryRecords,
  attendances,
  leaveRequests: [
    {
      id: 'l1',
      startDate: new Date(2026, 8, 1),
      endDate: new Date(2026, 8, 3),
      leaveType: 'CASUAL',
      currentStage: 'APPROVED',
      payTreatment: 'SPLIT',
      paidDays: 1.5,
      unpaidDays: 0.5,
      numberOfDays: 2.0,
      managerNote: JSON.stringify({
        split: resSplit,
      }),
    },
  ],
});

console.log('\nPayroll Output for Alice FT (Sep 2026):');
console.log(`  Base Salary: ₹${payrollCalc.baseSalary}`);
console.log(`  Daily Rate: ₹${payrollCalc.dailyRate}`);
console.log(`  Present Days: ${payrollCalc.presentDays}`);
console.log(`  Paid Leave Days: ${payrollCalc.paidLeaveDays}`);
console.log(`  Unpaid Leave Days: ${payrollCalc.unpaidLeaveDays}`);
console.log(`  Unpaid Deduction: ₹${payrollCalc.unpaidDeduction}`);
console.log(`  Final Payable: ₹${payrollCalc.finalPayable}`);

assert(payrollCalc.baseSalary === 30000, 'Base salary is ₹30,000');
assert(payrollCalc.dailyRate === 1000, 'Daily rate is ₹1,000 (30,000 / 30)');
assert(payrollCalc.presentDays === 23, 'Present days = 23 working days');
assert(payrollCalc.paidLeaveDays === 1.5, 'Payroll calculated exact 1.5 Paid Leave days');
assert(payrollCalc.unpaidLeaveDays === 0.5, 'Payroll calculated exact 0.5 Unpaid Leave days');
assert(payrollCalc.unpaidDeduction === 500, 'Payroll deducted exact ₹500 (0.5 * ₹1,000)');
assert(payrollCalc.finalPayable === 29500, 'Final payable is ₹29,500');

console.log(`\n========================================================================`);
console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round(passedTests/totalTests*100)}%)   `);
console.log(`========================================================================\n`);
