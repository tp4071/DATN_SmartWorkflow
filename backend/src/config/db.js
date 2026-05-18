import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },

    // Pool tuning — quan trọng khi DB đặt xa (Supabase Mumbai từ VN ~80ms RTT).
    // Giữ kết nối ấm để tránh phải bắt tay TLS + SCRAM mỗi request.
    max: 10,                          // số connection tối đa cùng lúc
    min: 2,                           // luôn giữ ít nhất 2 kết nối ấm
    idleTimeoutMillis: 30_000,        // connection idle 30s mới đóng
    connectionTimeoutMillis: 5_000,   // chờ tối đa 5s khi xin connection
    keepAlive: true,                  // bật TCP keep-alive
    statement_timeout: 10_000,        // hủy query chạy quá 10s
});

pool.on('error', (err) => {
    console.error('Lỗi kết nối database:', err.message);
});

// Wrapper query có log thời gian + SQL bị cắt để debug performance.
export const query = async (text, params) => {
    const start = process.hrtime.bigint();
    try {
        const result = await pool.query(text, params);
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        if (process.env.DEBUG_SQL !== 'false') {
            const tag = ms > 300 ? '🐢' : ms > 100 ? '⏱' : '⚡';
            const preview = text.replace(/\s+/g, ' ').trim().slice(0, 80);
            console.log(`  ${tag} sql ${ms.toFixed(0)}ms · ${preview}`);
        }
        return result;
    } catch (err) {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        console.error(`  ❌ sql ${ms.toFixed(0)}ms · ${err.message}`);
        throw err;
    }
};

// Pre-warm: chạy 1 query rỗng lúc startup để trả phí TLS/auth ngay,
// các request đầu tiên của user sẽ nhanh.
export const warmupPool = async () => {
    const start = Date.now();
    try {
        await pool.query('SELECT 1');
        console.log(`Pool warmed up in ${Date.now() - start}ms`);
    } catch (err) {
        console.error('Pool warmup failed:', err.message);
    }
};
