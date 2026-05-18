// Client-side PDF export — captures the rendered results panel including charts.
// Uses jsPDF + html2canvas (both pure JS).

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportResultsToPdf(targetEl, filenameBase = 'sales_rate_plan') {
  if (!targetEl) throw new Error('No element to export.');

  const canvas = await html2canvas(targetEl, {
    backgroundColor: '#FFFFFF',
    scale: 2,
    useCORS: true,
    windowWidth: targetEl.scrollWidth,
    windowHeight: targetEl.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth - 40;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 20;

  pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
  heightLeft -= (pageHeight - 40);

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 20;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 40);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  pdf.save(`${filenameBase}_${stamp}.pdf`);
}
