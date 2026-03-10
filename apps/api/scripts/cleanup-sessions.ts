/**
 * Clean up old revoked sessions from database
 * Usage: npm run script:cleanup-sessions
 */
import { PrismaClient } from '@prisma/client';

async function cleanupSessions() {
  const prisma = new PrismaClient();
  
  try {
    // Delete sessions that are revoked AND expired more than 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const result = await prisma.session.deleteMany({
      where: {
        AND: [
          { isRevoked: true },
          { expiresAt: { lt: sevenDaysAgo } }
        ]
      }
    });

    console.log(`✅ Deleted ${result.count} revoked sessions`);

    // List active sessions count
    const activeSessions = await prisma.session.count({
      where: { isRevoked: false }
    });

    console.log(`📊 Active sessions: ${activeSessions}`);

  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupSessions();
