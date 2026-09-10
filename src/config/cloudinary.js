import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '../../uploads');

// Ensure local uploads directory exists safely without crashing read-only lambdas
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (fsErr) {
  console.warn('⚠️ Note on uploads dir:', fsErr.message);
}

const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('☁️ Cloudinary configured successfully.');
} else {
  console.log('📁 Cloudinary not configured or keys missing; using local /uploads directory.');
}

/**
 * Uploads a file buffer to Cloudinary or falls back to local uploads folder
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - { folder, resourceType, originalname, mimetype }
 * @returns {Promise<{ url: string, publicId: string, resourceType: string }>}
 */
export const uploadMedia = async (buffer, options = {}) => {
  const {
    folder = 'aurawave_media',
    resourceType = 'auto',
    originalname = 'upload.bin',
  } = options;

  if (isCloudinaryConfigured()) {
    try {
      return await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: resourceType,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              resourceType: result.resource_type,
            });
          }
        );
        uploadStream.end(buffer);
      });
    } catch (err) {
      console.warn('⚠️ Cloudinary upload failed, falling back to local storage:', err.message);
    }
  }

  // Fallback: save to local /uploads directory
  const ext = path.extname(originalname) || '.bin';
  const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const filePath = path.join(uploadsDir, uniqueName);

  await fs.promises.writeFile(filePath, buffer);

  const localUrl = `/uploads/${uniqueName}`;
  return {
    url: localUrl,
    publicId: uniqueName,
    resourceType: resourceType || 'auto',
  };
};

export default cloudinary;
