import { PrismaClient } from '@prisma/client';

async function testConnection() {
  console.log('Testing connection to DB...');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    const userCount = await prisma.user.count();
    console.log(`✅ Success via DATABASE_URL! Users count: ${userCount}`);
  } catch (err: any) {
    console.error(`❌ DATABASE_URL failed: ${err.message}`);
    
    if (process.env.DIRECT_URL) {
      console.log('Testing connection via DIRECT_URL (port 5432)...');
      const directPrisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DIRECT_URL,
          },
        },
      });
      try {
        const countDirect = await directPrisma.user.count();
        console.log(`✅ Success via DIRECT_URL! Users count: ${countDirect}`);
      } catch (directErr: any) {
        console.error(`❌ DIRECT_URL failed: ${directErr.message}`);
      } finally {
        await directPrisma.$disconnect();
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
