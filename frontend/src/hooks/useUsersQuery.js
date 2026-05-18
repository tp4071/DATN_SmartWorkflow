import { useQuery } from '@tanstack/react-query'
import { qk } from '../lib/queryKeys'
import { listUsers } from '../services/users.api'

/**
 * Hook list toàn bộ user hệ thống — dùng cho AdminUsersPage và ProjectFormModal
 * (chọn PM khi tạo dự án). Cache giúp đóng/mở modal không refetch nếu < staleTime.
 */
export function useUsersQuery() {
  return useQuery({
    queryKey: qk.users.list(),
    queryFn: () => listUsers(),
    staleTime: 30_000,
  })
}
