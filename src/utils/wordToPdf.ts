import mammoth from 'mammoth';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function wordToPdf(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  if (!html || html.trim().length === 0) {
    throw new Error('No content could be extracted from the Word file.');
  }

  // Create a visible but off-screen container (html2canvas needs it in the viewport)
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '794px'; // A4 width at 96dpi
  container.style.minHeight = '1123px'; // A4 height at 96dpi
  container.style.fontFamily = 'Inter, Arial, Helvetica, sans-serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.6';
  container.style.color = '#000';
  container.style.background = '#fff';
  container.style.padding = '60px';
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '99999';
  container.style.overflow = 'visible';
  container.innerHTML = html;
  document.body.appendChild(container);

  // Small delay to ensure fonts load and DOM renders
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    // Capture the rendered HTML as a canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Calculate the image dimensions to fit A4
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    // Add pages as needed
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}
