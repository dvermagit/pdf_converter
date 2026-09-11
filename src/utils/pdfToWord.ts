import {
  Document,
  Packer,
  Paragraph,
  ImageRun,
  PageBreak,
  convertMillimetersToTwip,
} from 'docx';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/** Convert mm to pixels at 96 DPI (what docx ImageRun expects) */
function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * 96);
}

/**
 * Converts a PDF to a Word document by rendering each page as a high-res
 * image and embedding it full-page into the .docx. This preserves the
 * exact visual layout (tables, images, logos, formatting, etc.)
 */
export async function pdfToWord(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  // A4 dimensions
  const marginMm = 10;
  const contentWidthMm = 210 - marginMm * 2; // 190mm
  const contentHeightMm = 297 - marginMm * 2; // 277mm

  // Render scale for quality
  const renderScale = 2.5;

  const children: Paragraph[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    // Convert canvas to PNG ArrayBuffer
    const pngBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    const pngBuffer = await pngBlob.arrayBuffer();

    // Calculate image dimensions to fit the content area while preserving aspect ratio
    const pageAspect = viewport.width / viewport.height;
    const contentAspect = contentWidthMm / contentHeightMm;

    let imgWidthPx: number;
    let imgHeightPx: number;

    if (pageAspect > contentAspect) {
      // Wider than content area — fit to width
      imgWidthPx = mmToPx(contentWidthMm);
      imgHeightPx = Math.round(imgWidthPx / pageAspect);
    } else {
      // Taller — fit to height
      imgHeightPx = mmToPx(contentHeightMm);
      imgWidthPx = Math.round(imgHeightPx * pageAspect);
    }

    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: pngBuffer,
            transformation: {
              width: imgWidthPx,
              height: imgHeightPx,
            },
            type: 'png',
          }),
        ],
      })
    );

    // Add page break after each page except the last
    if (i < numPages) {
      children.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(marginMm),
              bottom: convertMillimetersToTwip(marginMm),
              left: convertMillimetersToTwip(marginMm),
              right: convertMillimetersToTwip(marginMm),
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
