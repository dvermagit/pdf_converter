import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export interface JpgResult {
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
}

export async function pdfToJpg(
  file: File,
  quality: number = 0.92,
  scale: number = 2.0
): Promise<JpgResult[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const results: JpgResult[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d')!;

    await page.render({ canvasContext: context, viewport, canvas } as any).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b!),
        'image/jpeg',
        quality
      );
    });

    results.push({ pageNumber: i, dataUrl, blob });
  }

  return results;
}

export async function downloadAllAsZip(results: JpgResult[], baseName: string): Promise<void> {
  const zip = new JSZip();
  for (const result of results) {
    zip.file(`${baseName}_page_${result.pageNumber}.jpg`, result.blob);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${baseName}_images.zip`);
}
