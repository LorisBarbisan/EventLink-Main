import { ObjectStorageService } from "../utils/object-storage";
import { isLocalPath, readLocally } from "../utils/local-storage-fallback";

export interface ExtractedText {
  rawText: string;
  cleanText: string;
  lines: string[];
}

export class CvTextExtractionService {
  async extractFromUrl(cvFileUrl: string, contentType?: string): Promise<ExtractedText> {
    let buffer: Buffer;

    if (isLocalPath(cvFileUrl)) {
      // Local disk fallback (development)
      buffer = await readLocally(cvFileUrl);
      console.log(`📥 Read CV from local disk: ${buffer.length} bytes`);
    } else {
      // Prefer direct GCS download (no Replit signed-URL sidecar). Fall back to signed GET URL.
      try {
        buffer = await ObjectStorageService.downloadObjectBuffer(cvFileUrl);
        console.log(`📥 Downloaded CV via GCS (${buffer.length} bytes), contentType: ${contentType}`);
      } catch (directErr) {
        console.warn("📥 GCS direct download failed, trying signed URL:", directErr);
        const signedGetUrl = await ObjectStorageService.getDownloadUrl(cvFileUrl);
        const dlResponse = await fetch(signedGetUrl);
        if (!dlResponse.ok) {
          throw new Error(`Failed to download CV from storage: ${dlResponse.status} ${await dlResponse.text().catch(() => "")}`);
        }
        const arrayBuffer = await dlResponse.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        console.log(`📥 Downloaded CV via signed URL: ${buffer.length} bytes, contentType: ${contentType}`);
      }
    }

    const isPdf =
      contentType?.includes("pdf") ||
      cvFileUrl.toLowerCase().includes(".pdf") ||
      buffer.slice(0, 4).toString() === "%PDF";

    const isDocx =
      contentType?.includes("wordprocessingml") ||
      contentType?.includes("vnd.openxmlformats") ||
      cvFileUrl.toLowerCase().includes(".docx");

    const isDoc =
      contentType?.includes("msword") ||
      cvFileUrl.toLowerCase().includes(".doc");

    let rawText = "";

    if (isPdf) {
      rawText = await this.extractPdf(buffer);
    } else if (isDocx || isDoc) {
      rawText = await this.extractDocx(buffer);
    } else {
      rawText = await this.extractPdf(buffer).catch(() => this.extractDocx(buffer));
    }

    if (!rawText || rawText.trim().length < 20) {
      throw new Error("Could not extract readable text from CV. The file may be image-based or corrupt.");
    }

    console.log(`📄 Raw text extracted: ${rawText.length} chars`);
    const cleanText = this.cleanText(rawText);
    const lines = cleanText
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0);

    return { rawText, cleanText, lines };
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    // pdf-parse v2+ exports PDFParse class only (no default callback). Package is external in the server bundle.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = typeof result === "string" ? result : (result?.text ?? "");
      if (text.trim()) return text;
    } finally {
      await parser.destroy().catch(() => {});
    }

    throw new Error("Failed to extract text from PDF with any available method");
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    if (result.messages?.length) {
      console.warn("Mammoth messages:", result.messages.slice(0, 3));
    }
    return result.value || "";
  }

  private cleanText(raw: string): string {
    return raw
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
      .replace(/[•·▪▸►–—]/g, "-")
      .replace(/[""'']/g, '"')
      .replace(/\t/g, "  ")
      .replace(/ {3,}/g, "  ")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }
}

export const cvTextExtractionService = new CvTextExtractionService();
