import { sql } from "drizzle-orm";
import { db } from "../server/api/config/db";
import { users } from "../shared/schema";

async function backfillUserStatus() {
  console.log("🚀 Starting user status backfill...");

  try {
    // 1. Update status to 'active' for verified users
    const activeResult = await db
      .update(users)
      .set({ status: "active" })
      .where(sql`${users.email_verified} = true`);

    console.log(`✅ Set verified users to 'active'`);

    // 2. Update status to 'pending' for unverified users
    const pendingResult = await db
      .update(users)
      .set({ status: "pending" })
      .where(sql`${users.email_verified} = false OR ${users.email_verified} IS NULL`);

    console.log(`✅ Set unverified users to 'pending'`);

    console.log("🏁 Backfill completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  }
}

backfillUserStatus();
