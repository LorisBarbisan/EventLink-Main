import { describe, it, expect } from "vitest";
import { Document, Packer, Paragraph, Table, TableRow, TableCell } from "docx";
import mammoth from "mammoth";
import {
  looksDelimited,
  rowsFromText,
  largestHtmlTable,
  legacyDocText,
} from "./import-parse-utils";

describe("looksDelimited", () => {
  it("recognises tab-, comma- and semicolon-separated text", () => {
    expect(looksDelimited("Date\tDescription\tAmount\n08/05/2026\tStage One\t570")).toBe(true);
    expect(looksDelimited("Date,Amount\n08/05/2026,570\n12/05/2026,240")).toBe(true);
  });

  it("treats prose as free text", () => {
    expect(looksDelimited("Statement for May\n08/05/2026 Stage One Productions 570.00")).toBe(
      false
    );
  });
});

describe("rowsFromText", () => {
  it("reads lines that start with a date and end with an amount", () => {
    const text = [
      "Business Current Account — May 2026",
      "08/05/2026 Stage One Productions Ltd INV-0101 570.00",
      "12/05/2026   Northern AV Hire Ltd   240.00",
      "9 Apr 2026 Trainline - Return London -48.50",
      "Closing balance 1,234.00",
    ].join("\n");
    expect(rowsFromText(text)).toEqual([
      { Date: "08/05/2026", Description: "Stage One Productions Ltd INV-0101", Amount: "570.00" },
      { Date: "12/05/2026", Description: "Northern AV Hire Ltd", Amount: "240.00" },
      { Date: "9 Apr 2026", Description: "Trainline - Return London", Amount: "-48.50" },
    ]);
  });

  it("ignores a running balance after the amount", () => {
    expect(rowsFromText("08/05/2026 Stage One 570.00 4,210.55")).toEqual([
      { Date: "08/05/2026", Description: "Stage One", Amount: "570.00" },
    ]);
  });
});

describe("Word .docx", () => {
  it("takes the table from a Word document", async () => {
    const cell = (t: string) => new TableCell({ children: [new Paragraph(t)] });
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph("My earnings"),
            new Table({
              rows: [
                new TableRow({ children: [cell("Date"), cell("Description"), cell("Amount")] }),
                new TableRow({
                  children: [cell("08/05/2026"), cell("Stage One & Co"), cell("570")],
                }),
              ],
            }),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    const { value: html } = await mammoth.convertToHtml({ buffer });
    expect(largestHtmlTable(html)).toEqual([
      ["Date", "Description", "Amount"],
      ["08/05/2026", "Stage One & Co", "570"],
    ]);
  });
});

describe("legacyDocText", () => {
  it("recovers UTF-16 text runs from a binary .doc body", () => {
    const body = "08/05/2026 Stage One Productions 570.00\r12/05/2026 Northern AV 240.00\r";
    const buffer = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 1, 2, 3]),
      Buffer.from(body, "utf16le"),
      Buffer.from([0, 0, 0xff, 0xfe, 1, 2]),
    ]);
    expect(rowsFromText(legacyDocText(buffer))).toEqual([
      { Date: "08/05/2026", Description: "Stage One Productions", Amount: "570.00" },
      { Date: "12/05/2026", Description: "Northern AV", Amount: "240.00" },
    ]);
  });
});
