const fs = require('fs/promises');
const path = require('path');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

/**
 * Ensure the backup directory exists.
 */
async function ensureBackupDir() {
  const dirPath = path.resolve(process.cwd(), BACKUP_DIR);
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    console.error('Error creating backup directory:', err);
  }
  return dirPath;
}

// Custom JSON replacer to handle BigInt
const jsonReplacer = (key, value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

/**
 * Creates a JSON database backup.
 * @param {string} trigger - 'scheduled' | 'manual'
 * @returns {Promise<Object>} The backup record
 */
async function createBackup(trigger = 'manual') {
  const dirPath = await ensureBackupDir();
  
  // Create a timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.json`;
  const filePath = path.join(dirPath, filename);
  
  try {
    // 1. Fetch all data
    const data = {
      users: await prisma.user.findMany(),
      subscriptions: await prisma.subscription.findMany(),
      settings: await prisma.setting.findMany(),
      attendanceRules: await prisma.attendanceRule.findMany(),
      members: await prisma.member.findMany(),
      newCustomers: await prisma.newCustomer.findMany(),
      memberSubscriptions: await prisma.memberSubscription.findMany(),
      attendanceRecords: await prisma.attendanceRecord.findMany(),
      freezes: await prisma.freeze.findMany(),
      payments: await prisma.payment.findMany(),
      expenses: await prisma.expense.findMany(),
      activityLogs: await prisma.activityLog.findMany(),
    };

    // 2. Serialize and write to file
    const jsonString = JSON.stringify(data, jsonReplacer, 2);
    await fs.writeFile(filePath, jsonString, 'utf8');

    // 3. Get file size
    const stats = await fs.stat(filePath);
    
    // 4. Log success to DB
    const successRecord = await prisma.backup.create({
      data: {
        filePath: filePath,
        status: 'success',
        triggeredBy: trigger,
        sizeBytes: BigInt(stats.size),
      }
    });
    
    return successRecord;
  } catch (error) {
    console.error('Backup failed:', error);
    
    // Log failure to DB
    const failedRecord = await prisma.backup.create({
      data: {
        filePath: filePath,
        status: 'failed',
        triggeredBy: trigger,
        sizeBytes: 0n,
      }
    });
    
    throw new Error(`Backup failed: ${error.message}`);
  }
}

async function processJsonRestore(fileContent) {
  const data = JSON.parse(fileContent);

  await prisma.$transaction(async (tx) => {
    // 1. Truncate all involved tables. CASCADE will clear everything efficiently.
    await tx.$executeRawUnsafe(`
      TRUNCATE TABLE 
        "users", 
        "subscriptions", 
        "settings", 
        "attendance_rules", 
        "members", 
        "new_customers", 
        "member_subscriptions", 
        "attendance_records", 
        "freezes", 
        "payments", 
        "expenses", 
        "activity_log" 
      CASCADE;
    `);

    const insertMany = async (model, records) => {
      if (records && records.length > 0) {
        await tx[model].createMany({ data: records });
      }
    };

    // 2. Insert in dependency order (Parents first)
    await insertMany('user', data.users);
    await insertMany('subscription', data.subscriptions);
    await insertMany('setting', data.settings);
    await insertMany('attendanceRule', data.attendanceRules);
    await insertMany('member', data.members);
    await insertMany('newCustomer', data.newCustomers);
    await insertMany('memberSubscription', data.memberSubscriptions);
    await insertMany('attendanceRecord', data.attendanceRecords);
    await insertMany('freeze', data.freezes);
    await insertMany('payment', data.payments);
    await insertMany('expense', data.expenses);
    await insertMany('activityLog', data.activityLogs);
  }, {
    timeout: 30000
  });
}

/**
 * Restores a PostgreSQL database from a JSON backup file using an existing backup ID.
 * @param {string} backupId 
 */
async function restoreBackup(backupId) {
  const backup = await prisma.backup.findUnique({ where: { id: backupId } });
  if (!backup) {
    throw new Error('Backup not found');
  }
  if (backup.status !== 'success') {
    throw new Error('Cannot restore from a failed backup');
  }

  let fileContent;
  try {
    fileContent = await fs.readFile(backup.filePath, 'utf8');
  } catch (err) {
    throw new Error(`Backup file not found at ${backup.filePath}`);
  }

  await processJsonRestore(fileContent);
  return { message: 'Restore completed successfully' };
}

/**
 * Imports a backup from an uploaded file (.json or .sql)
 * @param {string} filePath - Path to the uploaded file
 * @param {string} originalName - Original filename
 */
async function importBackup(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  
  if (ext === '.json') {
    let fileContent;
    try {
      fileContent = await fs.readFile(filePath, 'utf8');
    } catch (err) {
      throw new Error(`Uploaded file could not be read`);
    }
    await processJsonRestore(fileContent);
    return { message: 'JSON backup imported successfully' };
  } else if (ext === '.sql') {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined');
    
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const command = `psql "${dbUrl}" -f "${filePath}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('SQL Import failed:', stderr || error.message);
          return reject(new Error(`SQL Import failed: ${error.message}`));
        }
        resolve({ message: 'SQL backup imported successfully' });
      });
    });
  } else {
    throw new Error('Unsupported file format. Please upload .json or .sql files.');
  }
}

/**
 * Schedules the periodic backup using node-cron.
 * Runs every 15 days at 2:00 AM
 */
function schedulePeriodicBackup() {
  cron.schedule('0 2 */15 * *', async () => {
    console.log('Running scheduled backup...');
    try {
      await createBackup('scheduled');
      console.log('Scheduled backup completed successfully.');
    } catch (err) {
      console.error('Scheduled backup failed:', err);
    }
  });
  console.log('Periodic database JSON backup scheduled (every 15 days at 2:00 AM).');
}

module.exports = {
  createBackup,
  restoreBackup,
  importBackup,
  schedulePeriodicBackup,
  ensureBackupDir,
};
