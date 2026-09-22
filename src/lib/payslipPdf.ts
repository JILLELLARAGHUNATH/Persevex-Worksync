import { jsPDF } from 'jspdf';

export interface PayslipEmployeeData {
  userId: string;
  fullName: string;
  employeeId: string;
  teamName: string;
  role?: string;
  employmentType?: string;
  salaryEffectiveFrom?: string | Date | null;
  baseSalary: number;
  dailyRate: number;
  calendarDays: number;
  workingDays: number;
  weeklyOffs: number;
  companyHolidays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  presentAndPaidLeaveSalary?: number;
  weekOffAndHolidaySalary?: number;
  unpaidDeduction: number;
  finalPayable: number;
  status: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Loads the official Persevex logo from public/logo.svg.webp and converts it
 * into a high-fidelity PNG Data URL via browser canvas decoding.
 */
export async function getLogoPngDataUrl(): Promise<string> {
  if (typeof window === 'undefined') return '';
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Native dimensions of logo.svg.webp: 878 x 391
        canvas.width = img.naturalWidth || 878;
        canvas.height = img.naturalHeight || 391;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve('');
        }
      } catch (err) {
        console.warn('Canvas conversion warning:', err);
        resolve('');
      }
    };
    img.onerror = () => {
      console.warn('Failed to load /logo.svg.webp');
      resolve('');
    };
    img.src = '/logo.svg.webp';
  });
}

/**
 * Loads the Geist font from /fonts/Geist-Regular.ttf for proper Unicode Indian Rupee symbol rendering.
 */
export async function getFontBase64(): Promise<string> {
  if (typeof window === 'undefined') return '';
  try {
    const res = await fetch('/fonts/Geist-Regular.ttf');
    if (!res.ok) return '';
    const arrayBuffer = await res.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (err) {
    console.warn('Font loading fallback:', err);
    return '';
  }
}

/**
 * Formats numbers into Indian standard currency format (e.g. ₹20,000.00, -₹15,333.33)
 */
export function formatINR(val: number): string {
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-₹${formatted}` : `₹${formatted}`;
}

/**
 * Generates and triggers download of a corporate MNC-style Employee Salary Slip PDF.
 * Uses the exact authoritative payroll calculation results without any re-calculation.
 */
export async function downloadEmployeePayslipPdf(
  data: PayslipEmployeeData,
  year: number,
  month: number
): Promise<{ success: boolean; fileName?: string; error?: string }> {
  try {
    if (!data.baseSalary || data.baseSalary <= 0) {
      return {
        success: false,
        error: 'Salary is not configured for this employee. Please configure salary before downloading a payslip.',
      };
    }

    const monthName = MONTH_NAMES[month - 1] || `Month_${month}`;
    const safeName = (data.fullName || 'Employee').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Persevex_Payslip_${safeName}_${monthName}_${year}.pdf`;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const fontBase64 = await getFontBase64();
    const useUnicodeFont = !!fontBase64;
    if (fontBase64) {
      doc.addFileToVFS('Geist-Regular.ttf', fontBase64);
      doc.addFont('Geist-Regular.ttf', 'Geist', 'normal');
      doc.addFont('Geist-Regular.ttf', 'Geist', 'bold');
      doc.setFont('Geist', 'normal');
    }

    const fontNormal = useUnicodeFont ? 'Geist' : 'helvetica';
    const fontBold = useUnicodeFont ? 'Geist' : 'helvetica';

    const setFont = (type: 'normal' | 'bold', size: number) => {
      doc.setFont(type === 'bold' ? fontBold : fontNormal, type);
      doc.setFontSize(size);
    };

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2; // 182mm

    // Helper for section headers
    const drawHeaderBar = (title: string, yPos: number, height: number = 6.5) => {
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(margin, yPos, contentWidth, height, 'F');
      setFont('bold', 8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(title, margin + 3, yPos + height - 2);
    };

    // 1. TOP HEADER SECTION
    let y = 14;

    // Official Logo (Top Left)
    const logoPng = await getLogoPngDataUrl();
    if (logoPng) {
      // 44mm width, aspect ratio 2.245524 -> 19.59mm height
      doc.addImage(logoPng, 'PNG', margin, y, 44, 19.6);
    } else {
      setFont('bold', 18);
      doc.setTextColor(15, 23, 42);
      doc.text('PERSEVEX', margin, y + 10);
    }

    // Company subtitle below logo
    setFont('bold', 8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Persevex WorkSync · Corporate HR & Payroll', margin, y + 24.5);

    // Document Title & Period (Top Right)
    setFont('bold', 16);
    doc.setTextColor(15, 23, 42);
    doc.text('EMPLOYEE SALARY SLIP', pageWidth - margin, y + 6, { align: 'right' });

    setFont('bold', 10);
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(`Payroll Period: ${monthName} ${year}`, pageWidth - margin, y + 12, { align: 'right' });

    setFont('normal', 8);
    doc.setTextColor(100, 116, 139);
    doc.text('Private & Confidential', pageWidth - margin, y + 17, { align: 'right' });

    // Top Divider Line
    y = 41;
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);

    // 2. METADATA ROW TABLE
    y = 44;
    const metaHeight = 9.5;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, metaHeight, 'FD');

    const metaColWidth = contentWidth / 4; // 45.5mm each
    const metaLabels = ['PAYROLL PERIOD', 'PAYROLL REFERENCE', 'GENERATED ON', 'PAYROLL STATUS'];
    const nowStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const refCode = `PAY-${year}-${String(month).padStart(2, '0')}-${data.employeeId || 'EMP'}`;
    const isFinalized = data.status === 'FINALIZED';
    const metaValues = [
      `${monthName} ${year}`,
      refCode,
      nowStr,
      isFinalized ? 'FINALIZED' : (data.status || 'CALCULATED')
    ];

    metaLabels.forEach((label, i) => {
      const cellX = margin + i * metaColWidth;
      if (i > 0) {
        doc.setDrawColor(226, 232, 240);
        doc.line(cellX, y, cellX, y + metaHeight);
      }
      setFont('bold', 6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, cellX + 3, y + 3.8);

      setFont('bold', 8);
      if (i === 3) {
        if (isFinalized) {
          doc.setTextColor(5, 150, 105); // emerald-600
        } else {
          doc.setTextColor(217, 119, 6); // amber-600
        }
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(metaValues[i], cellX + 3, y + 7.8);
    });

    // 3. SECTION 1: EMPLOYEE INFORMATION
    y = 57;
    drawHeaderBar('1. EMPLOYEE INFORMATION', y);
    y += 6.5;

    const empTableHeight = 24; // 3 rows of 8mm
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, empTableHeight, 'FD');

    const labelW = 40;
    const col2X = margin + contentWidth / 2;

    const effDateStr = data.salaryEffectiveFrom
      ? new Date(data.salaryEffectiveFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : `01 ${monthName.slice(0, 3)} ${year}`;

    const empRows = [
      [
        { label: 'Employee Name', val: data.fullName || '-' },
        { label: 'Employee ID', val: data.employeeId || '-' },
      ],
      [
        { label: 'Department / Team', val: data.teamName || 'General' },
        { label: 'Designation / Role', val: data.role === 'TEAM_LEAD' ? 'Team Lead' : 'Employee' },
      ],
      [
        { label: 'Employment Type', val: data.employmentType === 'INTERN' ? 'Intern' : 'Full-Time' },
        { label: 'Salary Effective From', val: effDateStr },
      ],
    ];

    empRows.forEach((row, rIdx) => {
      const rowY = y + rIdx * 8;
      if (rIdx > 0) {
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, rowY, margin + contentWidth, rowY);
      }

      // Shaded label backgrounds
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rowY, labelW, 8, 'F');
      doc.rect(col2X, rowY, labelW, 8, 'F');

      // Dividers
      doc.setDrawColor(226, 232, 240);
      doc.line(margin + labelW, rowY, margin + labelW, rowY + 8);
      doc.line(col2X, rowY, col2X, rowY + 8);
      doc.line(col2X + labelW, rowY, col2X + labelW, rowY + 8);

      // Column 1
      setFont('bold', 7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(row[0].label, margin + 3, rowY + 5.2);

      setFont('bold', 8);
      doc.setTextColor(15, 23, 42);
      doc.text(row[0].val, margin + labelW + 3, rowY + 5.2);

      // Column 2
      setFont('bold', 7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(row[1].label, col2X + 3, rowY + 5.2);

      setFont('normal', 8);
      doc.setTextColor(15, 23, 42);
      doc.text(row[1].val, col2X + labelW + 3, rowY + 5.2);
    });

    // 4. SECTION 2: ATTENDANCE & LEAVE SUMMARY
    y = 91;
    drawHeaderBar('2. ATTENDANCE & LEAVE SUMMARY', y);
    y += 6.5;

    const attColCount = 7;
    const attColW = contentWidth / attColCount; // 26mm each
    const attH = 14;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, attH, 'FD');

    // Header row for attendance table
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(margin, y, contentWidth, 6.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);

    const attHeaders = [
      'Calendar Days',
      'Working Days',
      'Present Days',
      'Paid Leave',
      'Weekly Offs',
      'Holidays',
      'Unpaid Days'
    ];

    const attVals = [
      String(data.calendarDays || 30),
      String(data.workingDays || 26),
      String(data.presentDays || 0),
      String(data.paidLeaveDays || 0),
      String(data.weeklyOffs || 4),
      String(data.companyHolidays || 0),
      String(data.unpaidLeaveDays || 0),
    ];

    attHeaders.forEach((hd, i) => {
      const cx = margin + i * attColW;
      if (i > 0) {
        doc.setDrawColor(226, 232, 240);
        doc.line(cx, y, cx, y + attH);
      }
      setFont('bold', 6.5);
      doc.setTextColor(71, 85, 105);
      doc.text(hd, cx + attColW / 2, y + 4.5, { align: 'center' });

      setFont(i === 6 ? 'bold' : (i === 2 || i === 3 ? 'bold' : 'normal'), 8.5);
      if (i === 6 && data.unpaidLeaveDays > 0) {
        doc.setTextColor(185, 28, 28); // red-700
      } else if (i === 2 && data.presentDays > 0) {
        doc.setTextColor(22, 101, 52); // green-800
      } else if (i === 3 && data.paidLeaveDays > 0) {
        doc.setTextColor(30, 64, 175); // blue-800
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(attVals[i], cx + attColW / 2, y + 11.5, { align: 'center' });
    });

    // 5. SECTION 3: SALARY BREAKDOWN (EARNINGS & DEDUCTIONS)
    y = 115;
    drawHeaderBar('3. SALARY BREAKDOWN (EARNINGS & DEDUCTIONS)', y);
    y += 6.5;

    const halfW = contentWidth / 2; // 91mm
    const salTableH = 50;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, salTableH, 'FD');

    // Center vertical separator between Earnings and Deductions
    doc.setDrawColor(203, 213, 225);
    doc.line(margin + halfW, y, margin + halfW, y + salTableH);

    // Sub-headers: EARNINGS | DEDUCTIONS
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, halfW, 7, 'F');
    doc.rect(margin + halfW, y, halfW, 7, 'F');
    doc.line(margin, y + 7, margin + contentWidth, y + 7);

    setFont('bold', 7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('EARNINGS & ALLOWANCES', margin + 3, y + 4.8);
    doc.text('AMOUNT', margin + halfW - 3, y + 4.8, { align: 'right' });

    doc.text('DEDUCTIONS & ADJUSTMENTS', margin + halfW + 3, y + 4.8);
    doc.text('AMOUNT', margin + contentWidth - 3, y + 4.8, { align: 'right' });

    // Calculate breakdown values
    const hasSal = data.baseSalary > 0;
    const unroundedDailyRate = hasSal ? data.baseSalary / (data.calendarDays || 30) : 0;
    const presSal = hasSal
      ? (data.presentAndPaidLeaveSalary ?? Math.round((data.presentDays + data.paidLeaveDays) * unroundedDailyRate * 100) / 100)
      : 0;
    const weekSal = hasSal
      ? (data.weekOffAndHolidaySalary ?? Math.round((data.weeklyOffs + data.companyHolidays) * unroundedDailyRate * 100) / 100)
      : 0;

    const earningsItems = [
      { label: 'Monthly Base Salary', amount: formatINR(data.baseSalary), bold: true },
      { label: 'Present + Paid Leave Salary', amount: formatINR(presSal), bold: false },
      { label: 'Week Off + Holiday Salary', amount: formatINR(weekSal), bold: false },
      { label: `Daily Rate Basis (${data.calendarDays} calendar days)`, amount: formatINR(data.dailyRate), bold: false, italic: true },
    ];

    const deductionItems = [
      { label: `Unpaid Days Deduction (${data.unpaidLeaveDays} days)`, amount: data.unpaidDeduction > 0 ? formatINR(-data.unpaidDeduction) : '₹0.00', bold: true, color: [185, 28, 28] },
      { label: 'Provident Fund (PF)', amount: '₹0.00', bold: false },
      { label: 'Professional Tax (PT)', amount: '₹0.00', bold: false },
      { label: 'Income Tax / TDS', amount: '₹0.00', bold: false },
    ];

    const rowH = 8.5;
    for (let r = 0; r < 4; r++) {
      const itemY = y + 7 + r * rowH;

      // Zebra striping
      if (r % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin + 0.5, itemY, halfW - 1, rowH, 'F');
        doc.rect(margin + halfW + 0.5, itemY, halfW - 1, rowH, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, itemY + rowH, margin + contentWidth, itemY + rowH);

      // Earnings item
      const eItem = earningsItems[r];
      setFont(eItem.bold ? 'bold' : 'normal', 7.5);
      doc.setTextColor(eItem.italic ? 100 : 51, eItem.italic ? 116 : 65, eItem.italic ? 139 : 85);
      doc.text(eItem.label, margin + 3, itemY + 5.5);

      setFont(eItem.bold ? 'bold' : 'normal', 8);
      doc.setTextColor(15, 23, 42);
      doc.text(eItem.amount, margin + halfW - 3, itemY + 5.5, { align: 'right' });

      // Deduction item
      const dItem = deductionItems[r];
      setFont(dItem.bold ? 'bold' : 'normal', 7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(dItem.label, margin + halfW + 3, itemY + 5.5);

      setFont(dItem.bold ? 'bold' : 'normal', 8);
      if (dItem.color) {
        doc.setTextColor(dItem.color[0], dItem.color[1], dItem.color[2]);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(dItem.amount, margin + contentWidth - 3, itemY + 5.5, { align: 'right' });
    }

    // Subtotal row at bottom of salary table
    const subtotalY = y + 7 + 4 * rowH;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, subtotalY, contentWidth, 9, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, subtotalY, margin + contentWidth, subtotalY);

    setFont('bold', 8);
    doc.setTextColor(15, 23, 42);
    doc.text('Gross Base Salary:', margin + 3, subtotalY + 5.8);
    doc.text(formatINR(data.baseSalary), margin + halfW - 3, subtotalY + 5.8, { align: 'right' });

    doc.text('Total Deductions:', margin + halfW + 3, subtotalY + 5.8);
    doc.setTextColor(185, 28, 28);
    doc.text(data.unpaidDeduction > 0 ? formatINR(-data.unpaidDeduction) : '₹0.00', margin + contentWidth - 3, subtotalY + 5.8, { align: 'right' });

    // 6. SECTION 4: NET PAYABLE HIGHLIGHT BANNER
    y = 175;
    const netH = 22;
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.setDrawColor(134, 239, 172); // emerald-300
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, contentWidth, netH, 2, 2, 'FD');

    setFont('bold', 10.5);
    doc.setTextColor(22, 101, 52); // emerald-800
    doc.text('NET SALARY PAYABLE', margin + 6, y + 9);

    setFont('normal', 7.5);
    doc.setTextColor(21, 128, 61); // emerald-700
    doc.text('Net payable amount after applicable attendance & unpaid deductions', margin + 6, y + 15);

    setFont('bold', 18);
    doc.setTextColor(6, 95, 70); // emerald-900
    doc.text(formatINR(data.finalPayable), margin + contentWidth - 6, y + 14, { align: 'right' });

    // 7. SECTION 5: NOTES & STATUTORY DECLARATION
    y = 203;
    const notesH = 24;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, notesH, 'FD');

    setFont('bold', 7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('IMPORTANT NOTES & INSTRUCTIONS:', margin + 4, y + 5.5);

    setFont('normal', 7);
    doc.setTextColor(71, 85, 105);
    doc.text('• This is an official system-generated salary slip issued by Persevex WorkSync HR & Payroll Management.', margin + 4, y + 10.5);
    doc.text('• Salary calculations are authoritative and computed based on verified attendance records and authorized company calendar rules.', margin + 4, y + 15);
    doc.text('• Wednesday Weekly Offs and Company Holidays are fully paid and incur zero salary deductions.', margin + 4, y + 19.5);

    // 8. SECTION 6: AUTHORIZATION & SIGNATURE BLOCK
    y = 233;
    const sigH = 30;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, sigH, 'FD');

    const halfBox = contentWidth / 2;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin + halfBox, y, margin + halfBox, y + sigH);

    // Left Signatory (Employee)
    setFont('bold', 7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Employee Acknowledgment', margin + 4, y + 6);
    setFont('normal', 6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Signature / Confirmation', margin + 4, y + 25);

    // Right Signatory (Company / HR)
    setFont('bold', 7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('For Persevex WorkSync', margin + halfBox + 4, y + 6);

    setFont('bold', 8);
    doc.setTextColor(30, 41, 59);
    doc.text('Authorised Signatory', margin + halfBox + 4, y + 21);

    setFont('normal', 6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Corporate HR & Payroll Administration', margin + halfBox + 4, y + 25.5);

    // 9. FOOTER
    const footerY = pageHeight - 12;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    setFont('bold', 7);
    doc.setTextColor(100, 116, 139);
    doc.text('Persevex WorkSync · Corporate HR & Payroll Management', margin, footerY);

    setFont('normal', 7);
    doc.text(`Generated on: ${nowStr} | Confidential Document | Page 1 of 1`, pageWidth - margin, footerY, { align: 'right' });

    // Save and trigger browser download
    doc.save(fileName);

    return { success: true, fileName };
  } catch (err: any) {
    console.error('downloadEmployeePayslipPdf error:', err);
    return { success: false, error: err.message || 'Failed to generate payslip PDF.' };
  }
}
