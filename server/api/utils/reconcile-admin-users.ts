import { storage } from "../../storage";

// Admin reconciliation function - ensures admin users have correct roles
export async function reconcileAdminUsers(): Promise<void> {
  try {
    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((email) => email.trim().toLowerCase())
      : [];

    if (adminEmails.length === 0) {
      console.log("⚠️ No admin emails configured in ADMIN_EMAILS");
      return;
    }

    console.log(`🔧 Reconciling admin users: ${adminEmails.join(", ")}`);

    for (const email of adminEmails) {
      if (!email) continue;

      // Find user by email
      const user = await storage.getUserByEmail(email);

      if (user) {
        if (user.role !== "admin") {
          console.log(`🆙 Upgrading user ${email} to admin role`);
          await storage.updateUserRole(user.id, "admin");
        } else {
          console.log(`✅ Admin email ${email} already has admin role`);
        }
      } else {
        console.log(`ℹ️ Admin email ${email} not found in database - skipping`);
      }
    }

    console.log("✅ Admin reconciliation complete");
  } catch (error) {
    console.error("❌ Admin reconciliation failed:", error);
  }
}
