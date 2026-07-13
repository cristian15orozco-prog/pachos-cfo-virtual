import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRole } from "../middleware/requireRole";
import { auditAction } from "../middleware/auditLogger";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]);
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB, suficiente para una foto de celular

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Solo se aceptan imágenes (JPG, PNG, WEBP, HEIC) o PDF."));
      return;
    }
    cb(null, true);
  },
});

/**
 * Cualquier usuario autenticado (incluido Empleado) puede subir una foto de
 * comprobante. Queda "sin asignar" (invoiceId/checkId nulos) hasta que un
 * Administrador o el Dueño la vincule a una factura real.
 */
router.post(
  "/upload",
  upload.single("file"),
  auditAction("ATTACHMENT_UPLOAD", "attachment"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "Falta el archivo." } });
    }

    const attachment = await prisma.attachment.create({
      data: {
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileData: req.file.buffer,
        notes: typeof req.body?.notes === "string" ? req.body.notes : undefined,
        uploadedById: req.auth!.userId,
      },
      select: { id: true, fileName: true, mimeType: true, notes: true, createdAt: true },
    });

    res.status(201).json({ data: attachment });
  })
);

/** Bandeja de comprobantes subidos que todavía no se han vinculado a ninguna factura/cheque. */
router.get(
  "/pending",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const pending = await prisma.attachment.findMany({
      where: { invoiceId: null, checkId: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        notes: true,
        createdAt: true,
        uploadedBy: { select: { fullName: true } },
      },
    });
    res.json({ data: pending });
  })
);

/** Devuelve el archivo binario (para mostrarlo/descargarlo). */
router.get(
  "/:id/file",
  asyncHandler(async (req, res) => {
    const attachment = await prisma.attachment.findUniqueOrThrow({ where: { id: req.params.id } });
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${attachment.fileName}"`);
    res.send(attachment.fileData);
  })
);

const linkSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  checkId: z.string().uuid().optional(),
});

/** Vincula un comprobante pendiente a una factura o cheque ya existente. */
router.post(
  "/:id/link",
  requireRole("ADMIN"),
  auditAction("ATTACHMENT_LINK", "attachment"),
  asyncHandler(async (req, res) => {
    const parsed = linkSchema.safeParse(req.body);
    if (!parsed.success || (!parsed.data.invoiceId && !parsed.data.checkId)) {
      return res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Envía invoiceId o checkId para vincular el comprobante." },
      });
    }

    const attachment = await prisma.attachment.update({
      where: { id: req.params.id },
      data: { invoiceId: parsed.data.invoiceId, checkId: parsed.data.checkId },
      select: { id: true, invoiceId: true, checkId: true },
    });
    res.json({ data: attachment });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  auditAction("ATTACHMENT_DELETE", "attachment"),
  asyncHandler(async (req, res) => {
    await prisma.attachment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
