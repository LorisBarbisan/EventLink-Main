// Loaded before validation so module-scope reads work when this file is
// imported ahead of server/index.ts calling dotenv.config()
import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} environment variable is required. Set it in the environment (or .env for local development) before starting the server.`
    );
  }
  return value;
}

// Validated once at startup — importing this module fails fast instead of
// silently falling back to a hardcoded (forgeable) secret at request time.
export const SESSION_SECRET = requireEnv("SESSION_SECRET");
export const JWT_SECRET = requireEnv("JWT_SECRET");
