import { api } from "./apiClient";
import { buildInvoicePdf } from "./invoicePdf";

/**
 * Comprime y combina las fotos en un solo PDF (una página por foto), lo sube
 * y lo vincula a la factura. Las páginas que no se pudieron comprimir (ej.
 * un formato que el navegador no soporta) se suben aparte, sin combinar, en
 * vez de perderse.
 */
export async function attachPhotosToInvoice(invoiceId: string, pages: File[], invoiceNumber?: string) {
  if (pages.length === 0) return;

  const { pdf, pageCount, skipped } = await buildInvoicePdf(pages);

  if (pdf) {
    const formData = new FormData();
    formData.append("file", pdf, `factura-${invoiceNumber || invoiceId}.pdf`);
    formData.append("notes", `Factura fotografiada (${pageCount} página${pageCount > 1 ? "s" : ""})`);
    const uploaded = await api.postFormData<{ data: { id: string } }>("/attachments/upload", formData);
    await api.post(`/attachments/${uploaded.data.id}/link`, { invoiceId });
  }

  for (const file of skipped) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("notes", "Página de factura (no se pudo combinar en el PDF)");
    const uploaded = await api.postFormData<{ data: { id: string } }>("/attachments/upload", formData);
    await api.post(`/attachments/${uploaded.data.id}/link`, { invoiceId });
  }
}
