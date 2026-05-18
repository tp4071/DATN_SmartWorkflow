import { useQuery } from '@tanstack/react-query'
import { qk } from '../lib/queryKeys'
import { getProject, listProjects } from '../services/projects.api'
import { listProjectMembers } from '../services/projectMembers.api'
import { listTasks } from '../services/tasks.api'

/**
 * Hooks bọc các API endpoint của project bằng React Query.
 * Caller chỉ cần truyền id/filters; hook sẽ trả `{ data, isLoading, isError, error, refetch }`.
 */

export function useProjectsQuery({ status } = {}) {
  return useQuery({
    queryKey: qk.projects.list({ status }),
    queryFn: () => listProjects({ status }),
    staleTime: 30_000,
  })
}

export function useProjectQuery(projectId) {
  return useQuery({
    queryKey: qk.projects.detail(projectId),
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
    staleTime: 60_000, // detail ít đổi hơn list, cache lâu hơn
  })
}

export function useProjectMembersQuery(projectId) {
  return useQuery({
    queryKey: qk.projects.members(projectId),
    queryFn: () => listProjectMembers(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

export function useProjectTasksQuery(projectId, { status } = {}) {
  return useQuery({
    queryKey: qk.projects.tasks(projectId, { status }),
    queryFn: () => listTasks(projectId, { status }),
    enabled: !!projectId,
    staleTime: 15_000, // tasks đổi nhiều hơn — cache ngắn hơn
  })
}
