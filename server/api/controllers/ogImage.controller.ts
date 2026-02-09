import type { Request, Response } from "express";
import sharp from "sharp";
import { storage } from "../../storage";

function formatDateBritish(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine) {
      if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) break;
      }
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length === maxLines && words.length > 0) {
    const lastLine = lines[maxLines - 1];
    if (text.length > lines.join(" ").length) {
      lines[maxLines - 1] = lastLine.substring(0, lastLine.length - 3) + "...";
    }
  }

  return lines;
}

export async function getJobOgImage(req: Request, res: Response) {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res.status(404).send("Not found");
    }

    const job = await storage.getJobById(jobId);
    if (!job || (job.status !== "active" && job.status !== "private")) {
      return res.status(404).send("Not found");
    }

    const title = escapeXml(job.title);
    const location = escapeXml(job.location);
    const rate = escapeXml(`£${job.rate.replace(/^£/, "")}`);

    let dateStr = "";
    if (job.event_date) {
      dateStr = formatDateBritish(job.event_date);
      if (job.end_date) dateStr += ` - ${formatDateBritish(job.end_date)}`;
    }

    const titleLines = wrapText(title, 30, 2);
    const titleSvgLines = titleLines.map((line, i) =>
      `<text x="80" y="${200 + i * 60}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="bold" fill="#1a1a1a">${line}</text>`
    ).join("\n    ");

    const detailY = 200 + titleLines.length * 60 + 20;

    let descriptionSvg = "";
    if (job.description && job.description.trim()) {
      const descLines = wrapText(job.description.trim(), 55, 3);
      descriptionSvg = descLines.map((line, i) =>
        `<text x="80" y="${detailY + 60 + i * 30}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#4a4a4a">${escapeXml(line)}</text>`
      ).join("\n    ");
    }

    const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFF7ED;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFEDD5;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Top accent bar -->
  <rect width="1200" height="8" fill="#D8690E" />

  <!-- Left accent stripe -->
  <rect x="0" y="0" width="8" height="630" fill="#D8690E" />

  <!-- Job Title -->
  ${titleSvgLines}

  <!-- Location pin + Location -->
  <text x="80" y="${detailY}" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#D8690E" font-weight="600">${escapeXml(location)}${dateStr ? `  ·  ${escapeXml(dateStr)}` : ""}  ·  ${rate}</text>

  <!-- Description -->
  ${descriptionSvg}

  <!-- Bottom bar -->
  <rect y="580" width="1200" height="50" fill="#D8690E" />

  <!-- EventLink branding bottom right -->
  <text x="1120" y="614" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="end">EventLink</text>

  <!-- "View & Apply" bottom left -->
  <text x="80" y="614" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="white">View &amp; apply on EventLink</text>
</svg>`;

    const pngBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    });
    return res.send(pngBuffer);
  } catch (error) {
    console.error("OG image generation error:", error);
    return res.status(500).send("Error generating image");
  }
}
