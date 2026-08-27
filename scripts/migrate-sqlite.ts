import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import path from "path";

const prisma = new PrismaClient();

// Path to your old SQLite database
const sqlitePath = path.join(process.cwd(), "prisma", "dev.db");

const sqlite = new Database(sqlitePath, {
  readonly: true,
});

async function main() {
  console.log("Starting SQLite → Supabase migration...");
  console.log("Reading database:", sqlitePath);

  // ==========================================
  // 1. SYSTEM SETTINGS
  // ==========================================
  console.log("\nMigrating SystemSettings...");

  const systemSettings = sqlite
    .prepare("SELECT * FROM SystemSetting")
    .all() as any[];

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: {
        id: setting.id,
      },
      update: {
        companyName: setting.companyName,
        companyEmail: setting.companyEmail,
        officeStartTime: setting.officeStartTime,
        officeEndTime: setting.officeEndTime,
        gracePeriodMinutes: setting.gracePeriodMinutes,
        workingDays: setting.workingDays,
        officeLatitude: setting.officeLatitude,
        officeLongitude: setting.officeLongitude,
        officeRadiusMeters: setting.officeRadiusMeters,
        enableLocationCheck: Boolean(setting.enableLocationCheck),
      },
      create: {
        id: setting.id,
        companyName: setting.companyName,
        companyEmail: setting.companyEmail,
        officeStartTime: setting.officeStartTime,
        officeEndTime: setting.officeEndTime,
        gracePeriodMinutes: setting.gracePeriodMinutes,
        workingDays: setting.workingDays,
        officeLatitude: setting.officeLatitude,
        officeLongitude: setting.officeLongitude,
        officeRadiusMeters: setting.officeRadiusMeters,
        enableLocationCheck: Boolean(setting.enableLocationCheck),
      },
    });
  }

  console.log(`✓ Migrated ${systemSettings.length} system settings`);

  // ==========================================
  // 2. USERS
  // ==========================================
  console.log("\nMigrating Users...");

  const users = sqlite
    .prepare("SELECT * FROM User")
    .all() as any[];

  for (const user of users) {
    await prisma.user.upsert({
      where: {
        id: user.id,
      },
      update: {
        employeeId: user.employeeId,
        email: user.email,
        password: user.password,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        designation: user.designation,
        accountStatus: user.accountStatus,
        mustChangePassword: Boolean(user.mustChangePassword),
        isDeleted: Boolean(user.isDeleted),
        teamId: user.teamId,
      },
      create: {
        id: user.id,
        employeeId: user.employeeId,
        email: user.email,
        password: user.password,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        designation: user.designation,
        accountStatus: user.accountStatus,
        mustChangePassword: Boolean(user.mustChangePassword),
        isDeleted: Boolean(user.isDeleted),
        teamId: null,
      },
    });
  }

  console.log(`✓ Migrated ${users.length} users`);

  // ==========================================
  // 3. TEAMS
  // ==========================================
  console.log("\nMigrating Teams...");

  const teams = sqlite
    .prepare("SELECT * FROM Team")
    .all() as any[];

  for (const team of teams) {
    await prisma.team.upsert({
      where: {
        id: team.id,
      },
      update: {
        name: team.name,
        code: team.code,
        isActive: Boolean(team.isActive),
        teamLeadId: team.teamLeadId,
      },
      create: {
        id: team.id,
        name: team.name,
        code: team.code,
        isActive: Boolean(team.isActive),
        teamLeadId: team.teamLeadId,
      },
    });
  }

  console.log(`✓ Migrated ${teams.length} teams`);

  // ==========================================
  // 4. UPDATE USER TEAM RELATIONSHIPS
  // ==========================================
  console.log("\nUpdating User-Team relationships...");

  for (const user of users) {
    if (user.teamId) {
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          teamId: user.teamId,
        },
      });
    }
  }

  console.log("✓ User-Team relationships updated");

  // ==========================================
  // 5. ATTENDANCE
  // ==========================================
  console.log("\nMigrating Attendance...");

  const attendances = sqlite
    .prepare("SELECT * FROM Attendance")
    .all() as any[];

  for (const attendance of attendances) {
    await prisma.attendance.upsert({
      where: {
        id: attendance.id,
      },
      update: {
        userId: attendance.userId,
        date: new Date(attendance.date),
        checkInTime: attendance.checkInTime
          ? new Date(attendance.checkInTime)
          : null,
        checkOutTime: attendance.checkOutTime
          ? new Date(attendance.checkOutTime)
          : null,
        totalHours: attendance.totalHours,
        status: attendance.status,
        lateStatus: attendance.lateStatus,
        isCorrected: Boolean(attendance.isCorrected),
        correctionNote: attendance.correctionNote,
      },
      create: {
        id: attendance.id,
        userId: attendance.userId,
        date: new Date(attendance.date),
        checkInTime: attendance.checkInTime
          ? new Date(attendance.checkInTime)
          : null,
        checkOutTime: attendance.checkOutTime
          ? new Date(attendance.checkOutTime)
          : null,
        totalHours: attendance.totalHours,
        status: attendance.status,
        lateStatus: attendance.lateStatus,
        isCorrected: Boolean(attendance.isCorrected),
        correctionNote: attendance.correctionNote,
      },
    });
  }

  console.log(`✓ Migrated ${attendances.length} attendance records`);

  // ==========================================
  // 6. LEAVE REQUESTS
  // ==========================================
  console.log("\nMigrating Leave Requests...");

  const leaveRequests = sqlite
    .prepare("SELECT * FROM LeaveRequest")
    .all() as any[];

  for (const leave of leaveRequests) {
    await prisma.leaveRequest.upsert({
      where: {
        id: leave.id,
      },
      update: {
        userId: leave.userId,
        leaveType: leave.leaveType,
        startDate: new Date(leave.startDate),
        endDate: new Date(leave.endDate),
        numberOfDays: leave.numberOfDays,
        reason: leave.reason,
        currentStage: leave.currentStage,
      },
      create: {
        id: leave.id,
        userId: leave.userId,
        leaveType: leave.leaveType,
        startDate: new Date(leave.startDate),
        endDate: new Date(leave.endDate),
        numberOfDays: leave.numberOfDays,
        reason: leave.reason,
        currentStage: leave.currentStage,
      },
    });
  }

  console.log(`✓ Migrated ${leaveRequests.length} leave requests`);

  // ==========================================
  // 7. LEAVE APPROVAL HISTORY
  // ==========================================
  console.log("\nMigrating Leave Approval History...");

  const leaveApprovals = sqlite
    .prepare("SELECT * FROM LeaveApprovalHistory")
    .all() as any[];

  for (const approval of leaveApprovals) {
    await prisma.leaveApprovalHistory.upsert({
      where: {
        id: approval.id,
      },
      update: {
        leaveRequestId: approval.leaveRequestId,
        actionById: approval.actionById,
        stage: approval.stage,
        action: approval.action,
        comments: approval.comments,
      },
      create: {
        id: approval.id,
        leaveRequestId: approval.leaveRequestId,
        actionById: approval.actionById,
        stage: approval.stage,
        action: approval.action,
        comments: approval.comments,
      },
    });
  }

  console.log(`✓ Migrated ${leaveApprovals.length} approval records`);

  // ==========================================
  // 8. LEAVE BALANCES
  // ==========================================
  console.log("\nMigrating Leave Balances...");

  const leaveBalances = sqlite
    .prepare("SELECT * FROM LeaveBalance")
    .all() as any[];

  for (const balance of leaveBalances) {
    await prisma.leaveBalance.upsert({
      where: {
        id: balance.id,
      },
      update: {
        userId: balance.userId,
        leaveType: balance.leaveType,
        totalQuota: balance.totalQuota,
        usedQuota: balance.usedQuota,
        year: balance.year,
      },
      create: {
        id: balance.id,
        userId: balance.userId,
        leaveType: balance.leaveType,
        totalQuota: balance.totalQuota,
        usedQuota: balance.usedQuota,
        year: balance.year,
      },
    });
  }

  console.log(`✓ Migrated ${leaveBalances.length} leave balances`);

  // ==========================================
  // 9. TASKS
  // ==========================================
  console.log("\nMigrating Tasks...");

  const tasks = sqlite
    .prepare("SELECT * FROM Task")
    .all() as any[];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: {
        id: task.id,
      },
      update: {
        taskCode: task.taskCode,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignedToId: task.assignedToId,
        assignedById: task.assignedById,
        teamId: task.teamId,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        completedDate: task.completedDate
          ? new Date(task.completedDate)
          : null,
        workNotes: task.workNotes,
      },
      create: {
        id: task.id,
        taskCode: task.taskCode,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignedToId: task.assignedToId,
        assignedById: task.assignedById,
        teamId: task.teamId,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        completedDate: task.completedDate
          ? new Date(task.completedDate)
          : null,
        workNotes: task.workNotes,
      },
    });
  }

  console.log(`✓ Migrated ${tasks.length} tasks`);

  // ==========================================
  // 10. ANNOUNCEMENTS
  // ==========================================
  console.log("\nMigrating Announcements...");

  const announcements = sqlite
    .prepare("SELECT * FROM Announcement")
    .all() as any[];

  for (const announcement of announcements) {
    await prisma.announcement.upsert({
      where: {
        id: announcement.id,
      },
      update: {
        announcementCode: announcement.announcementCode,
        title: announcement.title,
        content: announcement.content,
        priority: announcement.priority,
        targetType: announcement.targetType,
        targetId: announcement.targetId,
        createdById: announcement.createdById,
      },
      create: {
        id: announcement.id,
        announcementCode: announcement.announcementCode,
        title: announcement.title,
        content: announcement.content,
        priority: announcement.priority,
        targetType: announcement.targetType,
        targetId: announcement.targetId,
        createdById: announcement.createdById,
      },
    });
  }

  console.log(`✓ Migrated ${announcements.length} announcements`);

  // ==========================================
  // 11. ANNOUNCEMENT READS
  // ==========================================
  console.log("\nMigrating Announcement Reads...");

  const announcementReads = sqlite
    .prepare("SELECT * FROM AnnouncementRead")
    .all() as any[];

  for (const read of announcementReads) {
    await prisma.announcementRead.upsert({
      where: {
        id: read.id,
      },
      update: {
        announcementId: read.announcementId,
        userId: read.userId,
        readAt: new Date(read.readAt),
      },
      create: {
        id: read.id,
        announcementId: read.announcementId,
        userId: read.userId,
        readAt: new Date(read.readAt),
      },
    });
  }

  console.log(`✓ Migrated ${announcementReads.length} announcement reads`);

  // ==========================================
  // 12. NOTIFICATIONS
  // ==========================================
  console.log("\nMigrating Notifications...");

  const notifications = sqlite
    .prepare("SELECT * FROM Notification")
    .all() as any[];

  for (const notification of notifications) {
    await prisma.notification.upsert({
      where: {
        id: notification.id,
      },
      update: {
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link,
        isRead: Boolean(notification.isRead),
      },
      create: {
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link,
        isRead: Boolean(notification.isRead),
      },
    });
  }

  console.log(`✓ Migrated ${notifications.length} notifications`);

  // ==========================================
  // 13. AUDIT LOGS
  // ==========================================
  console.log("\nMigrating Audit Logs...");

  const auditLogs = sqlite
    .prepare("SELECT * FROM AuditLog")
    .all() as any[];

  for (const log of auditLogs) {
    await prisma.auditLog.upsert({
      where: {
        id: log.id,
      },
      update: {
        userId: log.userId,
        role: log.role,
        action: log.action,
        target: log.target,
        details: log.details,
        timestamp: new Date(log.timestamp),
      },
      create: {
        id: log.id,
        userId: log.userId,
        role: log.role,
        action: log.action,
        target: log.target,
        details: log.details,
        timestamp: new Date(log.timestamp),
      },
    });
  }

  console.log(`✓ Migrated ${auditLogs.length} audit logs`);

  console.log("\n======================================");
  console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY!");
  console.log("SQLite dev.db → Supabase PostgreSQL");
  console.log("======================================");
}

main()
  .catch((error) => {
    console.error("\n❌ MIGRATION FAILED:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });