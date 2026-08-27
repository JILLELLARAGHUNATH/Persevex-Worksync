import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔒 Initializing Executive Manager Account...');

  const existingConfig = await prisma.systemSetting.findUnique({ where: { id: 'global_config' } });
  if (!existingConfig) {
    await prisma.systemSetting.create({
      data: {
        id: 'global_config',
        companyName: 'Persevex Education Consultancy LLP',
        companyEmail: 'contact@persevex.com',
        officeStartTime: '09:00',
        officeEndTime: '18:00',
        gracePeriodMinutes: 15,
        workingDays: 'Monday,Tuesday,Thursday,Friday,Saturday,Sunday',
      },
    });
  }

  const userCount = await prisma.user.count({ where: { isDeleted: false } });
  if (userCount === 0) {
    const passwordHash = await bcrypt.hash('Password@123', 10);
    const headManager = await prisma.user.create({
      data: {
        employeeId: 'EMP-MGR-001',
        email: 'manager@persevex.com',
        fullName: 'Chief Executive Manager',
        password: passwordHash,
        role: 'MANAGER',
        designation: 'Chief Executive Manager',
        accountStatus: 'ACTIVE',
      },
    });

    const leaveTypes = ['CASUAL', 'SICK', 'PAID', 'WORK_FROM_HOME', 'EMERGENCY'];
    for (const lt of leaveTypes) {
      await prisma.leaveBalance.create({
        data: {
          userId: headManager.id,
          leaveType: lt,
          totalQuota: 18,
          usedQuota: 0,
          year: new Date().getFullYear(),
        },
      });
    }
    console.log('✓ Created Head Manager account: manager@persevex.com');
  }

  console.log('✅ Manager is configured as the main authority.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });