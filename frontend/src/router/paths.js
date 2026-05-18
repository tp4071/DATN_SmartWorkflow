export const ROUTE_PATHS = {
  root: '/',
  login: '/login',

  admin: {
    dashboard: '/admin/dashboard',
    users: '/admin/users',
    projects: '/admin/projects',
    stats: '/admin/stats',
  },

  myProjects: '/projects',
  myTasks: '/my-tasks',
  notifications: '/notifications',

  project: {
    board: (id = ':projectId') => `/project/${id}/board`,
    members: (id = ':projectId') => `/project/${id}/members`,
    proposals: (id = ':projectId') => `/project/${id}/proposals`,
    aiTasks: (id = ':projectId') => `/project/${id}/ai-tasks`,
    suggest: (id = ':projectId') => `/project/${id}/suggest`,
    stats: (id = ':projectId') => `/project/${id}/stats`,
    aiReport: (id = ':projectId') => `/project/${id}/ai-report`,
  },

  notFound: '*',
}

export const ROLES = {
  ADMIN: 'ADMIN',
  PM: 'PM',
  MEMBER: 'MEMBER',
}
