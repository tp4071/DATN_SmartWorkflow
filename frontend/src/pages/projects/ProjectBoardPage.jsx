import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  Breadcrumb,
  Button,
  EmptyState,
  FilterBar,
  Icon,
  PageHeader,
  Pill,
  SearchInput,
  Select,
  Spinner,
  useToast,
} from '../../components/ui'
import { ROUTE_PATHS } from '../../router/paths'
import { useAuth } from '../../context/useAuth'
import { useProject } from '../../context/ProjectContext'
import { useNotifications } from '../../context/NotificationContext'
import { subscribeProject, unsubscribeProject } from '../../services/socket'
import {
  createTask,
  moveTaskPosition,
  searchTasks,
} from '../../services/tasks.api'
import {
  useProjectMembersQuery,
  useProjectTasksQuery,
} from '../../hooks/useProjectQueries'
import { qk } from '../../lib/queryKeys'
import { TaskFormModal } from '../../components/tasks/TaskFormModal'
import { TaskCard } from '../../components/tasks/TaskCard'
import { SortableTaskCard } from '../../components/tasks/SortableTaskCard'
import { TaskDetailModal } from '../../components/tasks/TaskDetailModal'

// 4 cột chính (Chờ duyệt được ẩn khỏi Kanban — xem Sidebar "Đề xuất chờ duyệt").
const COLUMNS = [
  { status: 'Cần làm', accent: 'bg-neutral-300' },
  { status: 'Đang làm', accent: 'bg-primary-container' },
  { status: 'Chờ đánh giá', accent: 'bg-tertiary-300' },
  { status: 'Hoàn thành', accent: 'bg-success-600' },
]

const PRIORITY_FILTERS = [
  { value: 'ALL', label: 'Tất cả mức ưu tiên' },
  { value: 'HIGH', label: 'Cao' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'LOW', label: 'Thấp' },
]

const DUE_FILTERS = [
  { value: 'ALL', label: 'Tất cả hạn chót' },
  { value: 'OVERDUE', label: 'Quá hạn' },
  { value: 'WEEK', label: 'Trong 7 ngày tới' },
  { value: 'NONE', label: 'Chưa đặt hạn' },
]

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function ProjectBoardPage() {
  const { projectId } = useParams()
  const { project, canManage, readOnly } = useProject()
  const { user } = useAuth()
  const toast = useToast()
  const { onSocketEvent } = useNotifications()
  const queryClient = useQueryClient()

  const { data: membersData } = useProjectMembersQuery(projectId)
  const members = useMemo(() => membersData ?? [], [membersData])

  // React Query là source of truth. tasksKey dùng để patch cache + invalidate.
  const tasksKey = qk.projects.tasks(projectId, {})
  const {
    data: tasksData,
    isLoading: loading,
    isError: loadIsError,
    error: loadErr,
    refetch: refetchTasks,
  } = useProjectTasksQuery(projectId)
  const tasks = useMemo(() => tasksData ?? [], [tasksData])
  const loadError = loadIsError ? loadErr?.message || 'Không tải được công việc.' : null

  // Local state cho UI tương tác (không phụ thuộc cache)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState(null)
  const [activeDragId, setActiveDragId] = useState(null)

  // UC16 — Search (giữ riêng vì search trả từ endpoint khác, không cần cache)
  const [keyword, setKeyword] = useState('')
  const [searchIds, setSearchIds] = useState(null) // null = chưa search; Set<string>
  const [searching, setSearching] = useState(false)

  // Bộ lọc client-side áp lên tasks sau khi đã apply search.
  // assigneeFilter: 'ALL' | 'MINE' | 'UNASSIGNED' | <user_id>
  const [assigneeFilter, setAssigneeFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [dueFilter, setDueFilter] = useState('ALL')

  const hasFilters =
    assigneeFilter !== 'ALL' || priorityFilter !== 'ALL' || dueFilter !== 'ALL'
  const clearFilters = () => {
    setAssigneeFilter('ALL')
    setPriorityFilter('ALL')
    setDueFilter('ALL')
  }

  const assigneeOptions = useMemo(() => {
    const base = [
      { value: 'ALL', label: 'Mọi người phụ trách' },
      { value: 'MINE', label: 'Của tôi' },
      { value: 'UNASSIGNED', label: 'Chưa phân công' },
    ]
    const memberOpts = members.map((m) => ({
      value: m.user_id,
      label: m.full_name + (m.project_role === 'MANAGER' ? ' (PM)' : ''),
    }))
    return [...base, ...memberOpts]
  }, [members])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  /** Patch cache trực tiếp — dùng cho optimistic update sau mutation. */
  const patchTasksCache = (updater) => {
    queryClient.setQueryData(tasksKey, (prev) => updater(prev ?? []))
  }

  /** Invalidate cache để re-fetch ở background (giữ data cũ, không flicker). */
  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: qk.projects.tasks(projectId) })
  }

  // Subscribe project room. Khi server emit task:updated -> invalidate cache.
  useEffect(() => {
    if (!projectId) return undefined
    subscribeProject(projectId)
    const off = onSocketEvent('task:updated', () => {
      invalidateTasks()
    })
    return () => {
      off()
      unsubscribeProject(projectId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, onSocketEvent])

  // Debounce search 300ms. Khi keyword rỗng -> reset filter.
  useEffect(() => {
    const trimmed = keyword.trim()
    if (!trimmed) {
      setSearchIds(null)
      setSearching(false)
      return undefined
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const data = await searchTasks(projectId, trimmed)
        if (cancelled) return
        setSearchIds(new Set((data || []).map((t) => t.id)))
      } catch (err) {
        if (!cancelled) {
          toast.error(err.message || 'Tìm kiếm thất bại')
          setSearchIds(new Set())
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [keyword, projectId, toast])

  const isSearching = searchIds !== null
  // Khi đang search: lọc tasks theo searchIds. Tránh hiện 'Chờ duyệt' để khớp board.
  const searchedTasks = useMemo(() => {
    if (!isSearching) return tasks
    return tasks.filter((t) => searchIds.has(t.id))
  }, [tasks, isSearching, searchIds])

  // Apply bộ lọc client-side TRÊN tập đã search.
  const visibleTasks = useMemo(() => {
    if (!hasFilters) return searchedTasks
    const today = startOfToday()
    const weekAhead = new Date(today)
    weekAhead.setDate(weekAhead.getDate() + 7)

    return searchedTasks.filter((t) => {
      // Assignee
      if (assigneeFilter === 'MINE') {
        if (!user?.id || t.assignee_id !== user.id) return false
      } else if (assigneeFilter === 'UNASSIGNED') {
        if (t.assignee_id) return false
      } else if (assigneeFilter !== 'ALL') {
        if (t.assignee_id !== assigneeFilter) return false
      }

      // Priority
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false

      // Due
      if (dueFilter === 'NONE') {
        if (t.due_date) return false
      } else if (dueFilter === 'OVERDUE') {
        if (!t.due_date || t.status === 'Hoàn thành') return false
        const d = new Date(t.due_date)
        if (Number.isNaN(d.getTime()) || d >= today) return false
      } else if (dueFilter === 'WEEK') {
        if (!t.due_date) return false
        const d = new Date(t.due_date)
        if (Number.isNaN(d.getTime())) return false
        if (d < today || d > weekAhead) return false
      }

      return true
    })
  }, [searchedTasks, hasFilters, assigneeFilter, priorityFilter, dueFilter, user?.id])

  const grouped = useMemo(() => {
    const map = new Map(COLUMNS.map((c) => [c.status, []]))
    for (const t of visibleTasks) {
      if (map.has(t.status)) map.get(t.status).push(t)
    }
    // Đảm bảo từng cột sort theo order_index ASC (backend cũng đã sort sẵn,
    // nhưng sau optimistic update local ta cần re-sort).
    for (const list of map.values()) {
      list.sort((a, b) => Number(a.order_index) - Number(b.order_index))
    }
    return map
  }, [visibleTasks])

  const totalVisible = visibleTasks.length

  const activeTask = useMemo(
    () => (activeDragId ? tasks.find((t) => t.id === activeDragId) : null),
    [activeDragId, tasks],
  )

  /**
   * Drag & drop trong CÙNG 1 cột:
   *  - Tìm danh sách hiện tại của cột active.
   *  - arrayMove → tính order_index mới (trung bình của 2 hàng xóm trong vị trí mới).
   *  - Optimistic patch local; gọi API moveTaskPosition.
   *  - Nếu drag cross-column: bỏ qua (backend không hỗ trợ; status flow cần đi
   *    qua các endpoint workflow chuyên biệt — start-progress / submit-review / accept).
   *  - Lỗi → refetch để rollback.
   */
  const handleDragEnd = (event) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeTask = tasks.find((t) => t.id === active.id)
    const overTask = tasks.find((t) => t.id === over.id)
    if (!activeTask || !overTask) return
    if (activeTask.status !== overTask.status) {
      toast.error('Hiện chỉ hỗ trợ kéo thả trong cùng 1 cột.')
      return
    }

    const columnTasks = grouped.get(activeTask.status) ?? []
    const oldIndex = columnTasks.findIndex((t) => t.id === active.id)
    const newIndex = columnTasks.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const reordered = arrayMove(columnTasks, oldIndex, newIndex)
    const prevNeighbor = reordered[newIndex - 1] ?? null
    const nextNeighbor = reordered[newIndex + 1] ?? null

    // Tính order_index local cho thẻ vừa kéo (chỉ ảnh hưởng nó, không đụng các thẻ khác).
    let newOrderIndex
    if (!prevNeighbor && nextNeighbor) {
      newOrderIndex = Number(nextNeighbor.order_index) / 2 || 500
    } else if (prevNeighbor && !nextNeighbor) {
      newOrderIndex = Number(prevNeighbor.order_index) + 1000
    } else if (prevNeighbor && nextNeighbor) {
      newOrderIndex =
        (Number(prevNeighbor.order_index) + Number(nextNeighbor.order_index)) / 2
    } else {
      newOrderIndex = 1000 // cột rỗng (không xảy ra vì có ít nhất activeTask)
    }

    // Optimistic patch cache
    patchTasksCache((arr) =>
      arr.map((t) => (t.id === active.id ? { ...t, order_index: newOrderIndex } : t)),
    )

    moveTaskPosition(projectId, active.id, {
      newStatus: activeTask.status,
      prevOrderIndex: prevNeighbor ? Number(prevNeighbor.order_index) : null,
      nextOrderIndex: nextNeighbor ? Number(nextNeighbor.order_index) : null,
    })
      .then((updated) => {
        patchTasksCache((arr) =>
          arr.map((t) =>
            t.id === updated.id ? { ...t, order_index: updated.order_index } : t,
          ),
        )
      })
      .catch((err) => {
        toast.error(err.message || 'Không sắp xếp được công việc, đang khôi phục...')
        invalidateTasks()
      })
  }

  const handleCreate = async (payload) => {
    try {
      const created = await createTask(projectId, payload)
      patchTasksCache((arr) => [...arr, created])
      toast.success('Đã tạo công việc mới')
      setCreateOpen(false)
    } catch (err) {
      toast.error(err.message || 'Không tạo được công việc.')
      throw err
    }
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Dự án của tôi', to: ROUTE_PATHS.myProjects },
          { label: project?.name ?? 'Dự án', to: ROUTE_PATHS.project.board(projectId) },
          { label: 'Bảng công việc' },
        ]}
      />
      <PageHeader
        title={project?.name ?? 'Bảng công việc'}
        description={
          project?.project_code ? `Mã dự án: ${project.project_code}` : 'Bảng công việc Kanban'
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => refetchTasks()} disabled={loading}>
              <Icon name="refresh" className={`text-[18px] ${loading ? 'spin' : ''}`} />
              Làm mới
            </Button>
            {canManage ? (
              <>
                <Link
                  to={ROUTE_PATHS.project.aiTasks(projectId)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-secondary-700 text-white text-sm font-semibold hover:bg-secondary-900 transition-colors"
                >
                  <Icon name="auto_awesome" className="text-[18px]" />
                  Tạo task bằng AI
                </Link>
                <Button onClick={() => setCreateOpen(true)}>
                  <Icon name="add" className="text-[18px]" />
                  Thêm công việc
                </Button>
              </>
            ) : readOnly ? null : (
              <Link
                to={ROUTE_PATHS.project.suggest(projectId)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-700 hover:border-primary-container hover:bg-primary-50 hover:text-primary-900 transition-colors"
              >
                <Icon name="lightbulb" className="text-[18px]" />
                Đề xuất công việc
              </Link>
            )}
          </>
        }
      />

      {loading ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 flex justify-center">
          <Spinner size="lg" label="Đang tải bảng công việc..." />
        </div>
      ) : loadError ? (
        <EmptyState
          icon="error"
          title="Không tải được công việc"
          description={loadError}
          action={
            <Button variant="ghost" onClick={() => refetchTasks()}>
              <Icon name="refresh" className="text-[18px]" />
              Thử lại
            </Button>
          }
        />
      ) : (
        <>
          <FilterBar
            right={
              isSearching ? (
                <span className="text-xs text-outline">
                  {searching
                    ? 'Đang tìm...'
                    : `${totalVisible} kết quả khớp "${keyword.trim()}"`}
                </span>
              ) : hasFilters ? (
                <span className="text-xs text-outline">
                  {totalVisible} / {tasks.length} công việc
                </span>
              ) : null
            }
          >
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="Tìm theo tên công việc hoặc người phụ trách..."
              widthClass="w-full sm:w-80"
            />
            <Select
              value={assigneeFilter}
              onChange={setAssigneeFilter}
              options={assigneeOptions}
              widthClass="w-full sm:w-52"
              ariaLabel="Lọc theo người phụ trách"
            />
            <Select
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={PRIORITY_FILTERS}
              widthClass="w-full sm:w-44"
              ariaLabel="Lọc theo mức ưu tiên"
            />
            <Select
              value={dueFilter}
              onChange={setDueFilter}
              options={DUE_FILTERS}
              widthClass="w-full sm:w-44"
              ariaLabel="Lọc theo hạn chót"
            />
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <Icon name="filter_alt_off" className="text-[16px]" />
                Xóa bộ lọc
              </Button>
            ) : null}
            {isSearching ? (
              <Button variant="ghost" size="sm" onClick={() => setKeyword('')}>
                <Icon name="search_off" className="text-[16px]" />
                Bỏ tìm kiếm
              </Button>
            ) : null}
          </FilterBar>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => setActiveDragId(active.id)}
            onDragCancel={() => setActiveDragId(null)}
            onDragEnd={readOnly || isSearching || hasFilters ? undefined : handleDragEnd}
          >
          <div className="kanban-scroll overflow-x-auto -mx-container-padding px-container-padding pb-2">
            <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 min-w-full">
            {COLUMNS.map((col) => {
              const list = grouped.get(col.status) ?? []
              const ids = list.map((t) => t.id)
              return (
                <div
                  key={col.status}
                  className="bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col min-h-[400px]"
                >
                  <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-white rounded-t-xl">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.accent}`} />
                      <h3 className="text-sm font-semibold text-on-surface">{col.status}</h3>
                    </div>
                    <Pill tone="neutral">{list.length}</Pill>
                  </div>
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      {list.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-8 text-xs text-outline">
                          <Icon name="inbox" className="text-2xl mb-2" />
                          <span>Chưa có công việc</span>
                        </div>
                      ) : (
                        list.map((task) => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            onClick={() => setDetailTaskId(task.id)}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </div>
              )
            })}
          </div>

            </div>

          {/* Ghost preview theo cursor khi đang kéo. */}
          <DragOverlay>
            {activeTask ? (
              <div className="rotate-2 shadow-lg">
                <TaskCard task={activeTask} />
              </div>
            ) : null}
          </DragOverlay>
          </DndContext>

          {isSearching && totalVisible === 0 && !searching ? (
            <EmptyState
              icon="search_off"
              title="Không tìm thấy công việc khớp"
              description={`Không có công việc nào khớp với "${keyword.trim()}". Thử từ khóa khác hoặc bỏ tìm kiếm.`}
              action={
                <Button variant="ghost" onClick={() => setKeyword('')}>
                  <Icon name="filter_alt_off" className="text-[18px]" />
                  Bỏ tìm kiếm
                </Button>
              }
            />
          ) : !isSearching && hasFilters && totalVisible === 0 ? (
            <EmptyState
              icon="filter_alt_off"
              title="Không có công việc khớp bộ lọc"
              description="Thử thay đổi tiêu chí hoặc xóa bộ lọc để xem toàn bộ bảng."
              action={
                <Button variant="ghost" onClick={clearFilters}>
                  <Icon name="filter_alt_off" className="text-[18px]" />
                  Xóa bộ lọc
                </Button>
              }
            />
          ) : null}
        </>
      )}

      {canManage ? (
        <TaskFormModal
          open={createOpen}
          mode="create"
          projectId={projectId}
          project={project}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      ) : null}

      <TaskDetailModal
        open={!!detailTaskId}
        projectId={projectId}
        taskId={detailTaskId}
        project={project}
        canManage={canManage}
        readOnly={readOnly}
        onClose={() => setDetailTaskId(null)}
        onSaved={(updated) => {
          // Patch React Query cache để Kanban phản ánh ngay; cache invalidate sẽ đẩy
          // refetch ngầm nếu cần.
          patchTasksCache((arr) =>
            arr.map((t) =>
              t.id === updated.id
                ? {
                    ...t,
                    title: updated.title,
                    description: updated.description,
                    priority: updated.priority,
                    estimate_hours: updated.estimate_hours,
                    due_date: updated.due_date,
                    status: updated.status ?? t.status,
                    assignee_id: updated.assignee_id,
                    assignee_name:
                      updated.assignee_name ?? updated.assignee?.full_name ?? null,
                    updated_at: updated.updated_at,
                  }
                : t,
            ),
          )
          invalidateTasks()
        }}
      />
    </>
  )
}
