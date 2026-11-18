/**
 * Checks a file's first bytes against its declared type, so a file can't
 * claim to be a PDF or image while being something else (say, HTML).
 */
const SIGNATURES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/jpg": [[0xff, 0xd8, 0xff]],
};

export function matchesDeclaredType(buffer: Buffer, contentType: string): boolean {
  const sigs = SIGNATURES[contentType.toLowerCase()];
  if (!sigs) return false;
  return sigs.some((sig) => sig.every((byte, i) => buffer[i] === byte));
}
