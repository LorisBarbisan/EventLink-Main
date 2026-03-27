import { ObjectStorageService } from "../utils/object-storage";

export interface ExtractedText {
  rawText: string;
  cleanText: string;
  lines: string[];
}

export class CvTextExtractionService {
  async extractFromUrl(cvFileUrl: string, contentType?: string): Promise<ExtractedText> {
    const objectStorageService = new ObjectStorageService();
    const file = await objectStorageService.getCVFile(cvFileUrl);
    const [buffer] = await file.download();
    console.log(`📥 Downloaded CV file: ${buffer.length} bytes, contentType: ${contentType}`);

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
    const pdfModule = await import("pdf-parse");

    // Try standard function API (pdf-parse v1 style)
    const fn = (pdfModule as any).default || pdfModule;
    if (typeof fn === "function") {
      try {
        const data = await fn(buffer);
        if (data?.text) return data.text;
      } catch (err) {
        console.warn("pdf-parse function API failed:", err);
      }
    }

    // Try class-based API (pdf-parse v2 style)
    const PDFParse = (pdfModule as any).PDFParse || (pdfModule as any).default?.PDFParse;
    if (PDFParse) {
      try {
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        await (parser as any).load();
        const result = await parser.getText();
        const text = typeof result === "string" ? result : result?.text || "";
        if (text) return text;
      } catch (err) {
        console.warn("pdf-parse class API failed:", err);
      }
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
