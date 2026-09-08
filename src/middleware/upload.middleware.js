import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

// Memory storage for processing with sharp
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedPrefixes = ['image/', 'audio/', 'video/'];
  const allowedExact = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
  ];

  const isAllowed =
    allowedPrefixes.some(prefix => file.mimetype.startsWith(prefix)) ||
    allowedExact.includes(file.mimetype);

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`), false);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter,
});