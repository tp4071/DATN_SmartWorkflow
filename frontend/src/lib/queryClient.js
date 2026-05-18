import { QueryClient } from '@tanstack/react-query'

/**
 * QueryClient toàn cục với defaults phù hợp app:
 *  - staleTime 30s: data được coi là "tươi" 30s — không refetch trong khoảng đó.
 *    => Điều hướng giữa 2 page cùng query key trong 30s sẽ KHÔNG flicker / refetch.
 *  - gcTime 5min: cache giữ trong 5 phút sau khi không còn observer.
 *  - refetchOnWindowFocus false: không refetch khi đổi tab — tránh request thừa.
 *    Realtime cập nhật đã có Socket.IO; window focus refetch không cần thiết.
 *  - retry 1: thử lại 1 lần khi lỗi mạng (tránh spam khi backend down).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
})
