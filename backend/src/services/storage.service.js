import crypto from 'crypto';
import path from 'path';
import { getSupabase, STORAGE_BUCKET } from '../lib/supabase.js';
import { createError } from './shared/errors.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

let bucketEnsured = false;

/**
 * Tự tạo bucket nếu chưa tồn tại — chạy lần đầu khi có upload.
 * Idempotent: lần thứ 2 trở đi sẽ skip nhờ cờ `bucketEnsured`.
 *
 * Nhờ vậy user CHỈ cần điền 2 env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) —
 * không phải vào dashboard tạo bucket thủ công.
 */
const ensureBucketExists = async (supabase) => {
  if (bucketEnsured) return;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw createError(
      `Không kiểm tra được bucket Supabase: ${listError.message}. ` +
        'Hãy chắc chắn SUPABASE_SERVICE_ROLE_KEY đúng (KHÔNG dùng anon key).',
      500,
    );
  }

  const exists = buckets?.some((b) => b.name === STORAGE_BUCKET);
  if (!exists) {
    const { error: createError_ } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
    });
    if (createError_) {
      throw createError(
        `Không tạo được bucket "${STORAGE_BUCKET}": ${createError_.message}`,
        500,
      );
    }
    console.log(`[storage] auto-created bucket "${STORAGE_BUCKET}" (public).`);
  }

  bucketEnsured = true;
};

/**
 * Sinh path lưu trữ trong bucket: <projectId>/<taskId>/<uuid>-<safeFileName>.
 *  - Có projectId/taskId folder giúp cleanup hàng loạt + audit dễ hơn.
 *  - Prefix UUID tránh trùng tên khi 2 user cùng upload "report.pdf".
 *  - Sanitize tên file bỏ ký tự đặc biệt — Supabase không khoá tên có space,
 *    nhưng URL hoá sẽ dễ vỡ. Chỉ giữ alphanumeric, dash, underscore, dot.
 */
const buildStoragePath = (projectId, taskId, originalName) => {
  const ext = path.extname(originalName || '').toLowerCase();
  const base = path
    .basename(originalName || 'file', ext)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu tiếng Việt
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 80);
  const id = crypto.randomUUID();
  return `${projectId}/${taskId}/${id}-${base}${ext}`;
};

/**
 * Upload file buffer lên Supabase Storage.
 * Trả về { path, publicUrl, size, mimeType }.
 *
 * Lưu ý:
 *  - Bucket cần được tạo trước (manual ở Supabase dashboard).
 *  - Bucket khuyên đặt PUBLIC để link `publicUrl` truy cập trực tiếp. Nếu private
 *    thì FE phải gọi signed URL khi tải xuống — phức tạp hơn, không xử lý ở đây.
 */
export const uploadAttachmentFile = async ({
  projectId,
  taskId,
  file, // multer file: { buffer, originalname, mimetype, size }
}) => {
  if (!file || !file.buffer) {
    throw createError('Không có file để upload', 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw createError(
      `File vượt quá giới hạn ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      400,
    );
  }

  const supabase = getSupabase();
  // Tự tạo bucket nếu chưa có — chạy đúng 1 lần trong vòng đời process.
  await ensureBucketExists(supabase);

  const storagePath = buildStoragePath(projectId, taskId, file.originalname);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    // Phổ biến: bucket chưa tồn tại / sai quyền / file trùng tên.
    throw createError(`Lỗi khi upload Supabase: ${uploadError.message}`, 500);
  }

  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return {
    path: storagePath,
    publicUrl: publicUrlData.publicUrl,
    size: file.size,
    mimeType: file.mimetype || null,
  };
};

/**
 * Best-effort xóa file khỏi storage khi attachment bị xóa.
 * Không throw — nếu xóa lỗi (vd file đã không còn), chỉ log lại.
 */
export const deleteAttachmentFileByUrl = async (publicUrl) => {
  if (!publicUrl) return;
  // URL có dạng: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
  // Tìm phần sau '/public/{bucket}/' để lấy path.
  const marker = `/public/${STORAGE_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return; // không phải URL của bucket này — bỏ qua

  const storagePath = decodeURIComponent(publicUrl.slice(idx + marker.length));
  try {
    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);
    if (error) {
      console.warn('[storage] xóa file thất bại:', error.message);
    }
  } catch (err) {
    console.warn('[storage] xóa file lỗi:', err.message);
  }
};

export { MAX_FILE_SIZE };
