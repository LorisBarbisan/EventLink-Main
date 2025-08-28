// Complete user data cleanup utility
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

export async function nukeAllUserData(): Promise<void> {
  console.log('🚨 NUCLEAR CLEANUP: Removing all user data traces...');
  
  try {
    // Use raw SQL for maximum reliability
    await client`TRUNCATE TABLE users RESTART IDENTITY CASCADE;`;
    console.log('✅ Users table completely emptied');
    
    await client`TRUNCATE TABLE freelancer_profiles RESTART IDENTITY CASCADE;`;
    console.log('✅ Freelancer profiles emptied');
    
    await client`TRUNCATE TABLE recruiter_profiles RESTART IDENTITY CASCADE;`;
    console.log('✅ Recruiter profiles emptied');
    
    await client`TRUNCATE TABLE jobs RESTART IDENTITY CASCADE;`;
    console.log('✅ Jobs emptied');
    
    await client`TRUNCATE TABLE job_applications RESTART IDENTITY CASCADE;`;
    console.log('✅ Job applications emptied');
    
    await client`TRUNCATE TABLE conversations RESTART IDENTITY CASCADE;`;
    console.log('✅ Conversations emptied');
    
    await client`TRUNCATE TABLE messages RESTART IDENTITY CASCADE;`;
    console.log('✅ Messages emptied');
    
    await client`TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;`;
    console.log('✅ Notifications emptied');
    
    // Check for any session tables
    try {
      await client`DELETE FROM sessions;`;
      console.log('✅ Sessions cleared');
    } catch (e) {
      console.log('ℹ️ No session table found');
    }
    
    // Verify cleanup
    const userCount = await client`SELECT COUNT(*) as count FROM users;`;
    console.log(`🔍 Verification: ${userCount[0].count} users remaining`);
    
    if (userCount[0].count === 0 || userCount[0].count === '0') {
      console.log('✅ NUCLEAR CLEANUP COMPLETE: All user data eliminated');
    } else {
      console.log('❌ CLEANUP FAILED: Users still exist');
    }
    
  } catch (error) {
    console.error('💥 Cleanup error:', error);
  }
}

// Export only - do not run automatically
// This prevents the cleanup from running during server startup or imports