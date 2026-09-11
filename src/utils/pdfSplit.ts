import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function getPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  return pdf.getPageCount();
}

export async function splitPdf(
  file: File,
  ranges: { start: number; end: number }[]
): Promise<Blob[]> {
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const results: Blob[] = [];

  for (const range of ranges) {
    const newPdf = await PDFDocument.create();
    const pageIndices: number[] = [];
    for (let i = range.start; i <= range.end; i++) {
      pageIndices.push(i - 1); // Convert to 0-indexed
    }
    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
    for (const page of copiedPages) {
      newPdf.addPage(page);
    }
    const pdfBytes = await newPdf.save();
    results.push(new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' }));
  }

  return results;
}

export async function downloadSplitsAsZip(
  blobs: Blob[],
  baseName: string,
  ranges: { start: number; end: number }[]
): Promise<void> {
  const zip = new JSZip();
  blobs.forEach((blob, index) => {
    const range = ranges[index];
    zip.file(`${baseName}_pages_${range.start}-${range.end}.pdf`, blob);
  });
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${baseName}_split.zip`);
}
