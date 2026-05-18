/**
 * Query key factory — tập trung định nghĩa key tránh sai chính tả & lệch giữa
 * useQuery và queryClient.invalidateQueries.
 *
 * Pattern hierarchical: invalidate ['projects'] sẽ vô hiệu hoá cả ['projects', id]
 * và ['projects', id, 'members']. (TanStack Query default là partial match.)
 */
export const qk = {
  // Auth / current user
  me: () => ['me'],
  myTasks: (filters) => ['me', 'tasks', filters ?? {}],

  // Users (admin)
  users: {
    all: () => ['users'],
    list: () => ['users', 'list'],
  },

  // Projects
  projects: {
    all: () => ['projects'],
    list: (filters) => ['projects', 'list', filters ?? {}],
    detail: (id) => ['projects', id, 'detail'],
    members: (id) => ['projects', id, 'members'],
    tasks: (id, filters) => ['projects', id, 'tasks', filters ?? {}],
    proposals: (id) => ['projects', id, 'proposals'],
    statistics: (id) => ['projects', id, 'statistics'],
  },

  // System
  systemOverview: () => ['admin', 'stats', 'overview'],

  // Notifications
  notifications: () => ['notifications'],
}
