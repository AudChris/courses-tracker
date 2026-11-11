import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
export {
  extractCourseTextForGemini,
  extractCoursesFromText
} from '../utils/course-parser.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_PAGES = 300;
const MIN_EMBEDDED_TEXT_LENGTH = 40;

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function getPageText(textContent) {
  const lines = new Map();

  textContent.items.forEach((item) => {
    if (typeof item.str !== 'string' || !item.str.trim()) return;
    const y = Math.round(item.transform[5]);
    const line = lines.get(y) || [];
    line.push({ x: item.transform[4], text: item.str });
    lines.set(y, line);
  });

  return [...lines.entries()]
    .sort(([firstY], [secondY]) => secondY - firstY)
    .map(([, line]) => line
      .sort((first, second) => first.x - second.x)
      .map((item) => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean)
    .join('\n');
}

export async function readCoursePdf(file, onProgress = () => {}) {
  if (
    !(file instanceof File)
    || (file.type && file.type !== 'application/pdf')
    || !file.name.toLocaleLowerCase().endsWith('.pdf')
  ) {
    throw new Error('กรุณาเลือกไฟล์ PDF เท่านั้น');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('ไฟล์ PDF ต้องมีขนาดไม่เกิน 20 MB');
  }

  const pdf = await getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false
  }).promise;
  let ocrWorker;
  let activeOcrPage = 1;

  try {
    if (pdf.numPages > MAX_PAGES) {
      throw new Error(`รองรับ PDF ไม่เกิน ${MAX_PAGES} หน้า`);
    }

    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const pageText = getPageText(await page.getTextContent());
      pages.push(pageText);

      if (pageText.replace(/\s/g, '').length < MIN_EMBEDDED_TEXT_LENGTH) {
        activeOcrPage = pageNumber;
        if (!ocrWorker) {
          onProgress({
            phase: 'ocr',
            page: pageNumber,
            totalPages: pdf.numPages,
            status: 'กำลังเตรียม OCR ภาษาไทยและอังกฤษ...'
          });
          ocrWorker = await createWorker('tha+eng', undefined, {
            logger: ({ status, progress }) => onProgress({
              phase: 'ocr',
              page: activeOcrPage,
              totalPages: pdf.numPages,
              status,
              progress
            })
          });
        }

        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(
          2,
          2400 / Math.max(viewport.width, viewport.height)
        );
        const scaledViewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(scaledViewport.width);
        canvas.height = Math.ceil(scaledViewport.height);

        try {
          await page.render({
            canvas,
            viewport: scaledViewport
          }).promise;
          const result = await ocrWorker.recognize(canvas);
          pages[pageNumber - 1] = result.data.text;
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      }

      onProgress({
        phase: 'reading',
        page: pageNumber,
        totalPages: pdf.numPages,
        status: `อ่าน PDF หน้า ${pageNumber}/${pdf.numPages}`
      });
      page.cleanup();
    }

    return pages.join('\n\f\n');
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
    await pdf.destroy();
  }
}

