import { promises as fs } from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const LOCAL_PREFIX = "local://";

export function isLocalPath(objectPath: string): boolean {
  return objectPath.startsWith(LOCAL_PREFIX);
}

export function toLocalPath(relPath: string): string {
  return `${LOCAL_PREFIX}${relPath}`;
}

export function fromLocalPath(localPath: string): string {
  return localPath.slice(LOCAL_PREFIX.length);
}

export function resolveLocalPath(localPath: string): string {
  const relPath = fromLocalPath(localPath);
  return path.join(UPLOADS_DIR, relPath);
}

export async function saveLocally(relPath: string, buffer: Buffer): Promise<string> {
  const fullPath = path.join(UPLOADS_DIR, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
  console.log(`💾 CV saved locally at: ${fullPath}`);
  return toLocalPath(relPath);
}

export async function readLocally(localPath: string): Promise<Buffer> {
  const fullPath = resolveLocalPath(localPath);
  return fs.readFile(fullPath);
}

export async function deleteLocally(localPath: string): Promise<void> {
  try {
    const fullPath = resolveLocalPath(localPath);
    await fs.unlink(fullPath);
    console.log(`🗑️  Deleted local CV: ${fullPath}`);
  } catch {
    // Ignore if already gone
  }
}
