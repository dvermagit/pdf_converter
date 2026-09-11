import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  color: { r: number; g: number; b: number };
}

export async function addWatermark(
  file: File,
  options: WatermarkOptions
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
    const textHeight = font.heightAtSize(options.fontSize);

    page.drawText(options.text, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - textHeight / 2,
      size: options.fontSize,
      font,
      color: rgb(options.color.r, options.color.g, options.color.b),
      opacity: options.opacity,
      rotate: degrees(options.rotation),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
}
