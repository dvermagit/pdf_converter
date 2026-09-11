import { PDFDocument } from 'pdf-lib';

export async function mergePdfs(files: File[]): Promise<Blob> {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
}
