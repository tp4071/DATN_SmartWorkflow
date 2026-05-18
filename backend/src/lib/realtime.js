import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SECRET_KEY;
let io = null;

/**
 * Khởi tạo Socket.IO server, gắn vào HTTP server đã có và bật JWT auth.
 *
 * Mỗi client kết nối phải truyền token qua handshake auth:
 *   const socket = io(URL, { auth: { token } })
 *
 * Sau khi auth thành công, socket được tự động JOIN room `user:<userId>`
 * để các service khác có thể nhắm tới đúng user (notification.service.js).
 */
export function attachSocketIO(httpServer) {
  if (!JWT_SECRET) {
    console.warn('[realtime] SECRET_KEY chưa set — Socket.IO sẽ từ chối mọi connect.');
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    // Realtime-only: không persist event ở server
    serveClient: false,
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== 'string') {
        return next(new Error('Thiếu token xác thực'));
      }
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.data.user = {
        id: decoded.id,
        email: decoded.email,
        system_role: decoded.system_role,
      };
      return next();
    } catch (err) {
      return next(new Error('Token không hợp lệ hoặc đã hết hạn'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user?.id) {
      socket.disconnect(true);
      return;
    }
    // Personal room — notification service emit thông báo riêng cho từng user
    socket.join(`user:${user.id}`);

    // Project rooms — client tự subscribe khi mở 1 project (board/members/...)
    socket.on('project:subscribe', (projectId) => {
      if (typeof projectId === 'string' && projectId) {
        socket.join(`project:${projectId}`);
      }
    });
    socket.on('project:unsubscribe', (projectId) => {
      if (typeof projectId === 'string' && projectId) {
        socket.leave(`project:${projectId}`);
      }
    });

    if (process.env.DEBUG_REALTIME !== 'false') {
      console.log(`🔌 socket connected user=${user.id}`);
      socket.on('disconnect', (reason) => {
        console.log(`🔌 socket disconnected user=${user.id} reason=${reason}`);
      });
    }
  });

  return io;
}

/** Trả về instance Socket.IO đã khởi tạo, hoặc null nếu server chưa init. */
export function getIo() {
  return io;
}
