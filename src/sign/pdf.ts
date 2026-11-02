/// <reference types="vite/client" />
// The legacy build runs on older iPhones that investors may still sign from.
// isEvalSupported stays off so a hostile PDF can't reach eval (CVE-2024-4367).
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

const ASSETS = import.meta.env.DEV ? '/node_modules/pdfjs-dist' : '/pdfjs';

export type PdfDocument = PDFDocumentProxy;

export function openPdf(data: ArrayBuffer): Promise<PdfDocument> {
  return getDocument({
    data,
    isEvalSupported: false,
    enableXfa: false,
    cMapUrl: `${ASSETS}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}/standard_fonts/`,
  }).promise;
}

// For files the server didn't measure, such as a sealed copy with its certificate.
export async function pageSizes(doc: PdfDocument) {
  const numbers = Array.from({ length: doc.numPages }, (_, i) => i + 1);
  return Promise.all(numbers.map(async (number) => {
    const { width, height } = (await doc.getPage(number)).getViewport({ scale: 1 });
    return { width, height };
  }));
}
