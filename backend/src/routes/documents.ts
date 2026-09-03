import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { uploadDocumentSchema } from '../schemas/documents.js';
import { ApiError } from '../lib/ApiError.js';
import { assertProjectAccess } from '../lib/orgAccess.js';
import { config } from '../config.js';
import { extensionOf, SUPPORTED_EXTENSIONS } from '../services/textExtraction.js';
import { ingestDocument } from '../services/documentIngestion.js';

export const documentsRouter = Router();

// Memory storage: files are small enough (config.maxDocumentSizeBytes,
// default 20MB) to hold in a Buffer for the duration of one request — no
// need for disk staging. Applied only on this route, not globally
// (app.ts's express.json() body limit is unrelated to multipart bodies).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxDocumentSizeBytes } });

documentsRouter.post(
  '/',
  upload.single('file'),
  validateBody(uploadDocumentSchema),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'No file uploaded (expected multipart field "file")');

    const ext = extensionOf(req.file.originalname);
    if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
      throw new ApiError(
        400,
        `Unsupported file type ".${ext}" — supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      );
    }

    const { project_id, document_type } = req.body;
    await assertProjectAccess(project_id, req.user!.organisationId);

    const { document, chunkCount } = await ingestDocument({
      project_id,
      filename: req.file.originalname,
      document_type,
      buffer: req.file.buffer,
      mime_type: req.file.mimetype || 'application/octet-stream',
      uploaded_by: req.user!.id,
    });

    res.status(201).json({ document, chunk_count: chunkCount });
  }),
);
