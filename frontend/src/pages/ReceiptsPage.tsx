import { useRef, useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card, Badge } from "../components/ui";
import { useAuth } from "../hooks/useAuth";

interface PendingAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  notes: string | null;
  createdAt: string;
  uploadedBy: { fullName: string };
}

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  total: string;
  provider: { name: string };
}

export function ReceiptsPage() {
  const { user } = useAuth();
  const canReview = user?.role === "OWNER" || user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});
  const [viewError, setViewError] = useState<string | null>(null);

  // El navegador no manda el token de sesión en un <a href> directo a la
  // API — por eso se descarga el archivo con fetch (que sí lo incluye) y se
  // abre desde ahí, en vez de enlazar la URL cruda del backend.
  async function viewAttachment(id: string) {
    setViewError(null);
    try {
      const blob = await api.getBlob(`/attachments/${id}/file`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setViewError((err as Error).message);
    }
  }

  const upload = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (notes) formData.append("notes", notes);
      return api.postFormData("/attachments/upload", formData);
    },
    onSuccess: () => {
      setNotes("");
      setUploadError(null);
      setUploadSuccess(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["attachments-pending"] });
      setTimeout(() => setUploadSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setUploadError(err.message);
      setUploadSuccess(false);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
  }

  const pending = useQuery({
    queryKey: ["attachments-pending"],
    queryFn: () => api.get<{ data: PendingAttachment[] }>("/attachments/pending").then((r) => r.data),
    enabled: canReview,
  });

  const invoices = useQuery({
    queryKey: ["invoices-simple"],
    queryFn: () => api.get<{ data: InvoiceOption[] }>("/invoices").then((r) => r.data),
    enabled: canReview,
  });

  const linkAttachment = useMutation({
    mutationFn: ({ id, invoiceId }: { id: string; invoiceId: string }) =>
      api.post(`/attachments/${id}/link`, { invoiceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments-pending"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const discardAttachment = useMutation({
    mutationFn: (id: string) => api.delete(`/attachments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attachments-pending"] }),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Comprobantes</h2>

      <Card title="Subir foto de una factura recibida">
        <p className="text-sm text-slate-500 mb-3">
          Toma una foto de la factura física que recibiste del proveedor. Queda guardada aquí para que el Dueño o
          un Administrador la vincule a la factura correspondiente en el sistema.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nota (opcional)</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              placeholder="Ej. Factura de Distribuidora La Central"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <label className="bg-pachos-green text-white text-sm rounded-md px-4 py-2 cursor-pointer disabled:opacity-50">
            {upload.isPending ? "Subiendo..." : "📷 Tomar / Subir Foto"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              disabled={upload.isPending}
              onChange={handleFileChange}
            />
          </label>
        </div>
        {uploadSuccess && <p className="text-sm text-pachos-green mt-2">Foto subida correctamente.</p>}
        {uploadError && <p className="text-sm text-red-600 mt-2">{uploadError}</p>}
      </Card>

      {canReview && (
        <Card title="Bandeja pendiente de vincular">
          {viewError && <p className="text-sm text-red-600 mb-3">{viewError}</p>}
          {pending.isLoading && <p className="text-slate-400 text-sm">Cargando...</p>}
          {!pending.isLoading && pending.data?.length === 0 && (
            <p className="text-slate-400 text-sm">No hay comprobantes pendientes de revisión.</p>
          )}
          <ul className="divide-y divide-slate-100">
            {pending.data?.map((att) => (
              <li key={att.id} className="py-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => viewAttachment(att.id)}
                  className="text-sm text-pachos-green underline"
                >
                  {att.fileName}
                </button>
                <Badge>{att.uploadedBy.fullName}</Badge>
                <span className="text-xs text-slate-400">{new Date(att.createdAt).toLocaleString()}</span>
                {att.notes && <span className="text-sm text-slate-500">— {att.notes}</span>}

                <div className="ml-auto flex items-center gap-2">
                  <select
                    className="border border-slate-300 rounded-md px-2 py-1 text-sm"
                    value={linkChoice[att.id] ?? ""}
                    onChange={(e) => setLinkChoice({ ...linkChoice, [att.id]: e.target.value })}
                  >
                    <option value="">Vincular a factura…</option>
                    {invoices.data?.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.provider.name} — {inv.invoiceNumber}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!linkChoice[att.id] || linkAttachment.isPending}
                    onClick={() => linkAttachment.mutate({ id: att.id, invoiceId: linkChoice[att.id] })}
                    className="text-sm px-3 py-1 rounded-md bg-pachos-green text-white disabled:opacity-50"
                  >
                    Vincular
                  </button>
                  <button
                    onClick={() => discardAttachment.mutate(att.id)}
                    className="text-sm px-3 py-1 rounded-md border border-slate-300"
                  >
                    Descartar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
