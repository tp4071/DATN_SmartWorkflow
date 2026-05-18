import multer from 'multer';
import { MAX_FILE_SIZE } from '../services/storage.service.js';

/**
 * Multer cấu hình lưu file trong RAM (memoryStorage) — file sẽ chuyển thẳng
 * sang Supabase, không ghi đĩa local trước.
 *
 * Field name multipart: 'file' (FE phải dùng formData.append('file', ...)).
 */
export const uploadSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
}).single('file');

/**
 * Wrapper trả 400 chuẩn JSON khi multer reject (vd: file quá lớn).
 */
export const handleSingleFile = (req, res, next) => {
  uploadSingleFile(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `File vượt quá giới hạn ${MAX_FILE_SIZE / 1024 / 1024}MB`
          : err.message || 'Lỗi khi nhận file';
      return res.status(400).json({
        success: false,
        error: message,
        statusCode: 400,
      });
    }
    next();
  });
};
