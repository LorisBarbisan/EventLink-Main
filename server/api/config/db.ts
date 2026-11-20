import * as schema from "@shared/schema";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Which database this instance is on — host only, never the credentials. Makes
// "staging is still on the old database" visible in the first line of the logs.
try {
  const u = new URL(connectionString);
  console.log(`🗄️  Database: ${u.hostname}${u.pathname}`);
} catch {
  console.log("🗄️  Database: (unparseable DATABASE_URL)");
}

const client = postgres(connectionString, {
  max: 20, // Maximum connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 5, // Reduced connection timeout for faster failure detection
  prepare: false, // Disable prepared statements to reduce memory usage
  transform: {
    undefined: null, // Transform undefined to null for better SQL compatibility
  },
  debug: process.env.NODE_ENV === "development" ? false : false, // Disable debug in production
  onnotice: process.env.NODE_ENV === "development" ? console.log : () => {}, // Log notices only in dev
  // Add connection retry logic for better reliability
  connection: {
    options: `--application_name=eventlink-${process.env.NODE_ENV || "development"}`,
  },
});
export const db = drizzle(client, { schema });
