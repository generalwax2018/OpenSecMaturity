import writeExcelFile from "write-excel-file/universal";

function saveBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ascii(value: string): string {
  return value.replace(/·/g, "|").replace(/→/g, "->").replace(/[^\x20-\x7E\n]/g, "");
}

function wrap(text: string, width: number): string[] {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pdfEscape(value: string): string {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function downloadTextReport(lines: string[]) {
  saveBlob(new Blob([lines.join("\n")], { type: "text/plain" }), "opensecmaturity-report.txt");
}

export function downloadPdfReport(lines: string[], filename = "opensecmaturity-report.pdf") {
  const wrapped: string[] = [];
  for (const line of lines) {
    if (!line.trim()) wrapped.push("");
    else wrapped.push(...wrap(line, 88));
  }
  const perPage = 46;
  const pages: string[][] = [];
  for (let index = 0; index < wrapped.length; index += perPage) pages.push(wrapped.slice(index, index + perPage));
  if (pages.length === 0) pages.push(["OpenSecMaturity report"]);

  const pageIds = pages.map((_, index) => 3 + index * 2);
  const contentIds = pages.map((_, index) => 4 + index * 2);
  const fontId = 3 + pages.length * 2;
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);

  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(`<< /Type /Pages /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] /Count ${pages.length} >>`);
  pages.forEach((pageLines, index) => {
    const commands = ["BT", "/F1 11 Tf", "14 TL", "48 750 Td"];
    pageLines.forEach((line, lineIndex) => {
      commands.push(lineIndex === 0 ? `(${pdfEscape(line)}) Tj` : `T* (${pdfEscape(line)}) Tj`);
    });
    commands.push("ET");
    const stream = commands.join("\n");
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentIds[index]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  const body = objects.map((object, index) => `${index + 1} 0 obj\n${object}\nendobj\n`);
  for (const part of body) {
    offsets.push(pdf.length);
    pdf += part;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${body.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= body.length; index += 1) {
    pdf += String(offsets[index]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer << /Size ${body.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  saveBlob(new Blob([pdf], { type: "application/pdf" }), filename);
}

export async function downloadWorkbook(sheets: Record<string, Record<string, string | number>[]>) {
  const book = Object.entries(sheets).map(([name, rows]) => {
    const records = rows.length > 0 ? rows : [{ Note: "None" }];
    const columns = Object.keys(records[0] ?? {});
    return {
      sheet: name.slice(0, 31),
      data: [
        columns.map((column) => ({ value: column, fontWeight: "bold" as const })),
        ...records.map((record) => columns.map((column) => ({ value: record[column] ?? "" }))),
      ],
    };
  });
  const blob = await writeExcelFile(book).toBlob();
  saveBlob(blob, "opensecmaturity-report.xlsx");
}
