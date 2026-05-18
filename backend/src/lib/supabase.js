import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';

// Đảm bảo .env được load trước khi đọc env vars (cùng cách db.js đang làm).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });


/**
 * Supabase client (server-side) dùng service_role key.
 *
 * QUAN TRỌNG:
 *  - service_role key có FULL quyền, bypass mọi RLS. KHÔNG được expose ra frontend.
 *  - Backend đã có lớp phân quyền (requireProjectAccess) trước khi gọi storage,
 *    nên việc bypass RLS ở đây là chấp nhận được.
 *
 * Env cần thiết:
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
 *   SUPABASE_STORAGE_BUCKET=task-attachments
 */
/**
 * SUPABASE_URL có thể suy ra từ DATABASE_URL.
 *   DB:    postgresql://postgres.<ref>:***@<host>:6543/postgres
 *   API:   https://<ref>.supabase.co
 *
 * Nhờ vậy người dùng chỉ cần điền SUPABASE_SERVICE_ROLE_KEY (không thể suy ra),
 * còn URL được tự sinh nếu chưa cấu hình tay.
 */
const deriveSupabaseUrlFromDatabaseUrl = () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  // user trong DSN có dạng "postgres.<projectRef>"
  const m = dbUrl.match(/postgresql?:\/\/postgres\.([a-z0-9]+):/i);
  if (!m) return null;
  return `https://${m[1]}.supabase.co`;
};

const SUPABASE_URL = process.env.SUPABASE_URL || deriveSupabaseUrlFromDatabaseUrl();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'task-attachments';

let supabaseClient = null;

/**
 * Lazy init — chỉ tạo client khi cần (cho phép start server kể cả khi chưa cấu hình storage).
 * Throw rõ ràng nếu env thiếu để dev biết phải cấu hình.
 */
export const getSupabase = () => {
  if (supabaseClient) return supabaseClient;
  if (!SUPABASE_URL) {
    const err = new Error(
      'Không xác định được Supabase URL. Hãy thêm SUPABASE_URL vào .env, ' +
        'hoặc đảm bảo DATABASE_URL có dạng postgresql://postgres.<projectRef>:...',
    );
    err.statusCode = 503;
    err.isOperational = true;
    throw err;
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error(
      'Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env. Lấy ở: Dashboard → Settings → API → service_role key. ' +
        'KHÔNG dùng anon key.',
    );
    err.statusCode = 503;
    err.isOperational = true;
    throw err;
  }
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    // Node < 22 chưa có WebSocket native. supabase-js v2 luôn init RealtimeClient
    // (dù ta chỉ dùng Storage) — cần truyền 'ws' để khỏi crash.
    realtime: { transport: ws },
  });
  return supabaseClient;
};

export const isStorageConfigured = () =>
  !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
