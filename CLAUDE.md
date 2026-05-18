# CLAUDE.md

Tài liệu này cung cấp ngữ cảnh cho Claude Code khi làm việc với mã nguồn của dự án này.

## 1. Tổng quan dự án

**Tên dự án:** Smart Workflow — Ứng dụng web quản trị công việc tích hợp AI

**Mô tả ngắn:** Hệ thống quản lý dự án/công việc theo mô hình Kanban, tích hợp Google Gemini AI để tự động:
- Phân rã yêu cầu nghiệp vụ thành danh sách công việc (task drafts)
- Tóm tắt tiến độ dự án thành báo cáo ngắn gọn

**Đối tượng người dùng:** Doanh nghiệp / nhóm phát triển phần mềm cần chuẩn hóa quy trình giao việc - thực thi - nghiệm thu.

## 2. Kiến trúc tổng thể

Mô hình **Client - Server** 3 tầng tách biệt:

```
┌─────────────────┐    HTTP/HTTPS     ┌─────────────────┐    SQL    ┌──────────────────┐
│  Frontend       │ ←──── REST ─────→ │  Backend        │ ←───────→ │  PostgreSQL 15   │
│  ReactJS + Vite │                   │  NodeJS + JWT   │           │  (trên Supabase) │
└─────────────────┘                   └─────────────────┘           └──────────────────┘
        ↑                                      │
        │           WebSocket (real-time)      │
        └──────────────────────────────────────┘
                                               │
                                               ↓
                                    ┌──────────────────────┐
                                    │  Google Gemini API   │
                                    │  (sinh task & report)│
                                    └──────────────────────┘
```

Chi tiết: xem [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 3. Tech Stack

| Lớp | Công nghệ | Phiên bản |
|---|---|---|
| Frontend | ReactJS | 19.2.5 |
| Frontend build tool | Vite | 7.1.0 |
| Backend runtime | NodeJS | 20.18 |
| Package manager | NPM | 10.8.2 |
| Authentication | JWT (JSON Web Token) | — |
| Database | PostgreSQL | 15 |
| Cloud platform | Supabase (DB + Storage) | — |
| AI | Google Gemini API | — |
| Real-time | WebSocket | — |

## 4. Vai trò & Phân quyền (rất quan trọng)

Hệ thống có **2 cấp phân quyền**:

### Cấp hệ thống (`users.system_role`)
- `ADMIN` — Quản trị hệ thống: quản lý nhân sự, tạo dự án, bổ nhiệm PM, xem thống kê tổng
- `USER` — Người dùng thường (vai trò cụ thể được xác định ở cấp dự án)

### Cấp dự án (`project_members.project_role`)
- `MANAGER` — Project Manager (PM): toàn quyền trong dự án được giao
- `MEMBER` — Thành viên: thực thi công việc, đề xuất task

> **Lưu ý quan trọng:** Mọi API (trừ login) đều phải đi qua middleware:
> 1. Xác thực JWT
> 2. Kiểm tra quyền cấp hệ thống (nếu cần) HOẶC
> 3. Kiểm tra quyền cấp dự án (membership + project_role)

Chi tiết quyền cho từng chức năng: xem [`docs/BUSINESS_LOGIC.md`](docs/BUSINESS_LOGIC.md).

## 5. Cấu trúc Database

7 bảng chính:

| Bảng | Mục đích |
|---|---|
| `users` | Tài khoản, mật khẩu hash, vai trò hệ thống |
| `projects` | Dự án, mã dự án, PM được giao |
| `project_members` | Bảng trung gian N-N giữa users và projects |
| `tasks` | Công việc, có hỗ trợ sub-task qua `parent_task_id` |
| `task_comments` | Bình luận trên task (có @mention) |
| `task_attachments` | File minh chứng (lưu trên Supabase Storage) |
| `activity_logs` | Lịch sử thao tác (audit log) |

**Mọi khóa chính dùng UUID** (`gen_random_uuid()`).

Schema đầy đủ + SQL: xem [`docs/DATABASE.md`](docs/DATABASE.md).

## 6. Luồng nghiệp vụ trọng tâm

### 6.1. Luồng trạng thái Task trên Kanban
```
[Chờ duyệt] ──(PM phê duyệt)──→ [Cần làm] ──→ [Đang làm] ──(member gửi nghiệm thu)──→ [Chờ đánh giá]
     ↑                                                                                       │
     │                                                                          (PM phê duyệt)│
(member đề xuất task mới)                                                                    ↓
                                                                                      [Hoàn thành]
                                                                                              │
                                          (PM từ chối nghiệm thu)←──────────────[Đang làm]
```

**Điều kiện chuyển trạng thái cốt lõi:**
- `Đang làm` → `Chờ đánh giá`: BẮT BUỘC phải có ít nhất 1 attachment
- `Chờ đánh giá` → `Hoàn thành`: chỉ PM mới có quyền
- Member tự gửi nghiệm thu thì sẽ bị **khóa quyền tự đổi trạng thái** task đó

### 6.2. Luồng AI tích hợp
- **UC05 — Tạo task bằng AI:** PM nhập yêu cầu nghiệp vụ → backend gọi Gemini API với system prompt buộc trả về JSON → parse → hiển thị bản nháp → PM duyệt → lưu DB với cờ `is_ai_generated = true`
- **UC14 — Tóm tắt tiến độ bằng AI:** PM bấm "Tạo báo cáo" → backend lấy data 7 ngày gần nhất (status changes, comments) → gửi Gemini → hiển thị báo cáo dạng popup

Chi tiết: xem [`docs/AI_INTEGRATION.md`](docs/AI_INTEGRATION.md).

## 7. Quy ước & ràng buộc kỹ thuật

### Bảo mật (BẮT BUỘC tuân thủ)
- Mật khẩu phải hash trước khi lưu (KHÔNG BAO GIỜ lưu plain text)
- Mọi endpoint trừ `/login` phải có JWT middleware
- Endpoint thao tác task/project/member phải kiểm tra `project_id` có nằm trong `project_members` của user không
- API trả `403 Forbidden` khi sai quyền (KHÔNG ĐƯỢC trả 404 để giấu)

### UI/UX
- Thiết kế phẳng (flat design), responsive
- Drag & drop trên Kanban: dùng `tasks.order_index` (DOUBLE PRECISION) để sắp xếp — khi kéo thả, tính giá trị mới giữa 2 thẻ liền kề (tránh phải re-index toàn cột)
- Mọi thay đổi trạng thái/giao việc/comment đều phải:
  1. Ghi vào `activity_logs`
  2. Phát thông báo real-time qua WebSocket cho người liên quan

### Validation
- `due_date` của task phải nằm trong `[projects.start_date, projects.end_date]`
- `assignee_id` phải là member của project tương ứng
- `email` ở `users` là UNIQUE
- `project_code` ở `projects` là UNIQUE

## 8. Tài liệu chi tiết

| File | Nội dung |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Kiến trúc, tech stack, mô hình triển khai |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema chi tiết + SQL khởi tạo + trigger |
| [`docs/BUSINESS_LOGIC.md`](docs/BUSINESS_LOGIC.md) | Vai trò, ma trận phân quyền, quy tắc nghiệp vụ |
| [`docs/USE_CASES.md`](docs/USE_CASES.md) | Đặc tả đầy đủ 16 use case (UC01-UC16) |
| [`docs/AI_INTEGRATION.md`](docs/AI_INTEGRATION.md) | Cách tích hợp Gemini, prompt design, error handling |

## 9. Khi cần thêm tính năng mới

Trước khi code, hãy:
1. Đọc use case liên quan trong `docs/USE_CASES.md`
2. Kiểm tra ma trận quyền trong `docs/BUSINESS_LOGIC.md`
3. Xác định bảng DB bị ảnh hưởng trong `docs/DATABASE.md`
4. Đảm bảo thêm activity log + WebSocket notify nếu là thao tác làm thay đổi task/project

## 10. Hạn chế hiện tại (cần lưu ý khi cải tiến)

- AI tóm tắt chỉ dùng dữ liệu 7 ngày gần nhất → có thể mở rộng cấu hình
- UI chưa tối ưu mobile (chủ yếu cho desktop browser)
- AI dùng qua API third-party (Gemini) chứ chưa self-host model riêng
