import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, warmupPool } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import meRoutes from './routes/me.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { timing } from './middlewares/timing.middleware.js';
import { generalRateLimit } from './middlewares/rateLimit.middleware.js';
import { attachSocketIO } from './lib/realtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(timing);
// Rate limit chung cho mọi /api/* — bảo vệ trước spam/abuse.
// Lưu ý: khi deploy sau reverse proxy (nginx, Cloudflare), uncomment dòng dưới
// để rateLimit lấy đúng client IP từ X-Forwarded-For.
// app.set('trust proxy', 1);
app.use('/api', generalRateLimit);

app.get('/', (req, res) => {
    res.json({ message: 'Smart Workflow API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/me', meRoutes);
app.use('/api/admin', adminRoutes);

// Centralized error handler (phải đặt cuối cùng)
app.use(errorHandler);

// Wrap Express trong HTTP server để có thể gắn cùng instance với Socket.IO.
const httpServer = http.createServer(app);
attachSocketIO(httpServer);

httpServer.listen(PORT, async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('Database connected:', result.rows[0].now);
        await warmupPool();
    } catch (err) {
        console.error('Database connection failed:', err.message);
    }
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO server attached on same port`);
});
