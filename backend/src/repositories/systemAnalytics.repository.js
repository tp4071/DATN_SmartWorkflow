import { pool } from '../config/db.js';

/**
 * Số liệu tổng quan toàn hệ thống cho Admin Dashboard.
 *  - users: tổng + theo system_role + active/inactive
 *  - projects: tổng + theo status
 *  - tasks: tổng (loại trừ 'Chờ duyệt') + theo status + quá hạn
 *
 * Chạy nhiều count song song qua 1 query để tránh N round-trip — dùng FILTER (WHERE ...).
 */
export const getSystemOverview = async () => {
  const usersQ = pool.query(
    `SELECT
       COUNT(*)::int                                                  AS total,
       COUNT(*) FILTER (WHERE system_role = 'ADMIN')::int             AS admins,
       COUNT(*) FILTER (WHERE system_role = 'USER')::int              AS users,
       COUNT(*) FILTER (WHERE status = 'Active')::int                 AS active,
       COUNT(*) FILTER (WHERE status = 'Inactive')::int               AS inactive
     FROM public.users`
  );

  const projectsQ = pool.query(
    `SELECT
       COUNT(*)::int                                                  AS total,
       COUNT(*) FILTER (WHERE status = 'Đang hoạt động')::int         AS active,
       COUNT(*) FILTER (WHERE status = 'Đóng')::int                   AS closed,
       COUNT(*) FILTER (WHERE status = 'Lưu trữ')::int                AS archived
     FROM public.projects`
  );

  const tasksQ = pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status <> 'Chờ duyệt')::int             AS total_visible,
       COUNT(*) FILTER (WHERE status = 'Chờ duyệt')::int              AS proposed,
       COUNT(*) FILTER (WHERE status = 'Cần làm')::int                AS todo,
       COUNT(*) FILTER (WHERE status = 'Đang làm')::int               AS in_progress,
       COUNT(*) FILTER (WHERE status = 'Chờ đánh giá')::int           AS review,
       COUNT(*) FILTER (WHERE status = 'Hoàn thành')::int             AS done,
       COUNT(*) FILTER (
         WHERE status NOT IN ('Hoàn thành', 'Chờ duyệt')
           AND due_date IS NOT NULL
           AND due_date < CURRENT_DATE
       )::int                                                         AS overdue
     FROM public.tasks`
  );

  const [users, projects, tasks] = await Promise.all([usersQ, projectsQ, tasksQ]);

  return {
    users: users.rows[0],
    projects: projects.rows[0],
    tasks: tasks.rows[0],
  };
};

/**
 * Top N user có nhiều task đang phụ trách nhất (chưa Hoàn thành, không Chờ duyệt).
 * Dùng cho biểu đồ "Workload tải cao".
 */
export const getTopWorkloadUsers = async (limit = 8) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, COUNT(t.id)::int AS active_tasks
       FROM public.users u
       JOIN public.tasks t ON t.assignee_id = u.id
      WHERE t.status IN ('Cần làm', 'Đang làm', 'Chờ đánh giá')
      GROUP BY u.id, u.full_name, u.email
      ORDER BY active_tasks DESC
      LIMIT $1`,
    [limit]
  );
  return rows;
};

/**
 * Top N dự án theo số lượng task (gồm cả tỉ lệ hoàn thành).
 */
export const getTopActiveProjects = async (limit = 5) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.project_code, p.name, p.status,
            COUNT(t.id) FILTER (WHERE t.status <> 'Chờ duyệt')::int           AS total_tasks,
            COUNT(t.id) FILTER (WHERE t.status = 'Hoàn thành')::int           AS done_tasks
       FROM public.projects p
       LEFT JOIN public.tasks t ON t.project_id = p.id
      WHERE p.status = 'Đang hoạt động'
      GROUP BY p.id
      ORDER BY total_tasks DESC, done_tasks DESC
      LIMIT $1`,
    [limit]
  );
  return rows;
};
