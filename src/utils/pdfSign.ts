import { PDFDocument } from 'pdf-lib';

export interface SignaturePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

export async function addSignature(
  file: File,
  signatureDataUrl: string,
  position: SignaturePosition
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  // Convert data URL to bytes
  const signatureImageBytes = await fetch(signatureDataUrl).then((res) =>
    res.arrayBuffer()
  );

  let signatureImage;
  if (signatureDataUrl.includes('image/png')) {
    signatureImage = await pdfDoc.embedPng(signatureImageBytes);
  } else {
    signatureImage = await pdfDoc.embedJpg(signatureImageBytes);
  }

  const pages = pdfDoc.getPages();
  const page = pages[position.pageIndex];
  const { height: pageHeight } = page.getSize();

  // Draw signature - flip Y coordinate since PDF origin is bottom-left
  page.drawImage(signatureImage, {
    x: position.x,
    y: pageHeight - position.y - position.height,
    width: position.width,
    height: position.height,
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
}
