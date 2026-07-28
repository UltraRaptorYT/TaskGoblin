import { describe, expect, it } from "vitest";

import { readProjectBriefBuffer } from "@/lib/project-brief-parser";

function createTextPdf(text: string) {
  const escapedText = text.replace(/[()\\]/g, "\\$&");
  const stream = `BT /F1 12 Tf 72 720 Td (${escapedText}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf);
}

describe("readProjectBriefBuffer", () => {
  it("extracts PDF text using the embedded serverless worker", async () => {
    const result = await readProjectBriefBuffer(
      "brief.pdf",
      createTextPdf("TaskGoblin deployment brief"),
    );
    const { PDFParse } = await import("pdf-parse");

    expect(result.text).toContain("TaskGoblin deployment brief");
    expect(PDFParse.setWorker()).toMatch(/^data:text\/javascript;base64,/);
  });
});
