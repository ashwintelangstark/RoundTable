import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export async function extractResumeText(
  buffer: Buffer,
  filename: string,
  mimetype = "",
): Promise<string> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf") || mimetype.includes("pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return (result.text ?? "").replace(/\s+\n/g, "\n").trim();
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (lower.endsWith(".docx") || mimetype.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value ?? "").trim();
  }

  // Fallback for .txt, .md, or plain text buffers
  return buffer.toString("utf8").replaceAll("\0", "").trim();
}
