import { Request } from "express";
import jwt from "jsonwebtoken";
import { storage } from "server/storage";

const ADMIN_EMAILS = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map(email => email.trim().toLowerCase())
  : [];

// TODO: Export these from auth.ts to avoid duplication
export const blacklistedTokens = new Set<string>();

export const generateJWTToken = (user: any) => {
  const userWithRole = computeUserRole(user);
  const JWT_SECRET = process.env.JWT_SECRET!;
  return jwt.sign(
    {
      id: userWithRole.id,
      email: userWithRole.email,
      role: userWithRole.role,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
};

export const verifyJWTToken = (token: string) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : "Failed to verify JWT token");
  }
};

export const isTokenBlacklisted = (token: string): boolean => {
  return blacklistedTokens.has(token);
};

export const blacklistToken = (token: string): void => {
  blacklistedTokens.add(token);
  // Auto-cleanup: Remove tokens after 24 hours (matching JWT expiry)
  setTimeout(
    () => {
      blacklistedTokens.delete(token);
    },
    24 * 60 * 60 * 1000
  );
};

// Helper function to get the correct origin for redirects and email links
export function getOrigin(req: Request): string {
  if (process.env.NODE_ENV === "production") {
    return "https://eventlink.one";
  }
  const protocol = req.headers["x-forwarded-proto"]?.includes("https") ? "https" : req.protocol;
  const host = req.get("host");
  return `${protocol}://${host}`;
}

// Helper function to compute admin role based on email
export const computeUserRole = (user: any) => {
  if (!user) return user;

  // Check if email is in admin allowlist
  const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase());

  // If user should be admin but isn't in database, update the database in background
  if (isAdmin && user.role !== "admin") {
    // Update database role in the background (don't await)
    storage
      .updateUserRole(user.id, "admin")
      .then(() => {
        console.log(`✅ Updated ${user.email} to admin role in database`);
      })
      .catch(error => {
        console.error(`❌ Failed to update admin role for ${user.email}:`, error);
      });
  }

  return {
    ...user,
    role: isAdmin ? "admin" : user.role || "freelancer", // Set role to admin if in allowlist
    is_admin: isAdmin, // Add admin flag as well
  };
};
