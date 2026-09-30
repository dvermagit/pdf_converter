import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';
import { createAppError } from './errorHandler.js';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];
const ALLOWED_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  // Safari, some Windows setups and CLI clients send this for .xlsx files;
  // the extension check above is what actually gates the upload.
  'application/octet-stream',
];

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.resolve('uploads'));
  },
  filename(_req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `master-${uniqueSuffix}${ext}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(createAppError(`Invalid file type: ${ext}. Only .xlsx and .xls are allowed.`, 400));
    return;
  }

  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    cb(createAppError(`Invalid MIME type: ${file.mimetype}`, 400));
    return;
  }

  cb(null, true);
}

export const uploadExcel = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

/**
 * For importing contacts into the manual form: the sheet is read once and
 * discarded, so it never touches disk.
 */
export const uploadContactsExcel = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});
