import { PDFDocument } from "pdf-lib";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.72;

async function compressToJpeg(file: File): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, width, height };
  } catch {
    // El navegador no pudo decodificar el formato (ej. algunos HEIC en Chrome) —
    // se sube la foto original sin combinar, en vez de bloquear todo el guardado.
    return null;
  }
}

export interface InvoicePdfResult {
  pdf: Blob | null; // null si ninguna página se pudo comprimir/combinar
  pageCount: number;
  skipped: File[]; // páginas que no se pudieron incluir en el PDF — se suben aparte
}

/** Comprime cada foto y las combina en un solo PDF de varias páginas. */
export async function buildInvoicePdf(files: File[]): Promise<InvoicePdfResult> {
  const pdfDoc = await PDFDocument.create();
  const skipped: File[] = [];
  let included = 0;

  for (const file of files) {
    const compressed = await compressToJpeg(file);
    if (!compressed) {
      skipped.push(file);
      continue;
    }
    const jpgImage = await pdfDoc.embedJpg(compressed.bytes);
    const page = pdfDoc.addPage([compressed.width, compressed.height]);
    page.drawImage(jpgImage, { x: 0, y: 0, width: compressed.width, height: compressed.height });
    included += 1;
  }

  if (included === 0) return { pdf: null, pageCount: 0, skipped };

  const pdfBytes = await pdfDoc.save();
  return { pdf: new Blob([pdfBytes as BlobPart], { type: "application/pdf" }), pageCount: included, skipped };
}
