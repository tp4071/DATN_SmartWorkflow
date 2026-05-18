import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Breadcrumb,
  Button,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  Icon,
  PageHeader,
  Pill,
  SearchInput,
  Spinner,
  useToast,
} from '../../components/ui'
import { ROUTE_PATHS } from '../../router/paths'
import { useProject } from '../../context/ProjectContext'
import {
  addProjectMember,
  removeProjectMember,
} from '../../services/projectMembers.api'
import { useProjectMembersQuery } from '../../hooks/useProjectQueries'
import { qk } from '../../lib/queryKeys'
import { AddMemberModal } from './AddMemberModal'
import { removeVietnameseTones } from '../../utils/vietnameseSearch'

function makeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ProjectMembersPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { project, projectId, canManage } = useProject()

  const membersKey = qk.projects.members(projectId)
  const {
    data: membersData,
    isLoading: loading,
    isError: loadIsError,
    error: loadErr,
    refetch: fetchMembers,
  } = useProjectMembersQuery(projectId)
  const members = useMemo(() => membersData ?? [], [membersData])
  const loadError = loadIsError ? loadErr?.message || 'Không tải được thành viên.' : null

  const patchMembers = (updater) => {
    queryClient.setQueryData(membersKey, (prev) => updater(prev ?? []))
  }

  const [keyword, setKeyword] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [confirmState, setConfirmState] = useState({ open: false, member: null, busy: false })

  const filtered = useMemo(() => {
    const kw = removeVietnameseTones(keyword)
    if (!kw) return members
    return members.filter((m) =>
      removeVietnameseTones(`${m.full_name ?? ''} ${m.email ?? ''}`).includes(kw),
    )
  }, [members, keyword])

  const managerCount = members.filter((m) => m.project_role === 'MANAGER').length
  const memberCount = members.length - managerCount

  const handleAdd = async (user) => {
    try {
      await addProjectMember(projectId, user.id)
      patchMembers((arr) => [
        ...arr,
        {
          project_id: projectId,
          user_id: user.id,
          project_role: 'MEMBER',
          full_name: user.full_name,
          email: user.email,
          status: 'Active',
          system_role: user.system_role,
        },
      ])
      toast.success(`Đã thêm ${user.full_name} vào dự án`)
    } catch (err) {
      toast.error(err.message || 'Không thêm được thành viên.')
      throw err
    }
  }

  const askRemove = (member) => setConfirmState({ open: true, member, busy: false })
  const closeConfirm = () => setConfirmState({ open: false, member: null, busy: false })

  const handleConfirmRemove = async () => {
    const target = confirmState.member
    if (!target) return
    setConfirmState((s) => ({ ...s, busy: true }))
    try {
      const result = await removeProjectMember(projectId, target.user_id)
      patchMembers((arr) => arr.filter((m) => m.user_id !== target.user_id))
      const tasksMsg =
        result?.tasksUnassigned > 0
          ? ` Đã gỡ phụ trách khỏi ${result.tasksUnassigned} công việc.`
          : ''
      toast.success(`Đã gỡ ${target.full_name} khỏi dự án.${tasksMsg}`)
      closeConfirm()
    } catch (err) {
      toast.error(err.message || 'Không gỡ được thành viên.')
      setConfirmState((s) => ({ ...s, busy: false }))
    }
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Dự án của tôi', to: ROUTE_PATHS.myProjects },
          { label: project?.name ?? 'Dự án', to: ROUTE_PATHS.project.board(projectId) },
          { label: 'Thành viên' },
        ]}
      />
      <PageHeader
        title="Thành viên dự án"
        description={
          canManage
            ? 'Quản lý nhân sự tham gia dự án. Khi gỡ thành viên, mọi công việc đang giao cho họ sẽ tự động chuyển về trạng thái chưa có người phụ trách.'
            : 'Danh sách thành viên hiện tại của dự án.'
        }
        actions={
          canManage ? (
            <Button onClick={() => setShowAdd(true)}>
              <Icon name="person_add" className="text-[18px]" />
              Thêm thành viên
            </Button>
          ) : null
        }
      />

      <FilterBar
        right={
          !loading ? (
            <span className="text-xs text-outline">
              {managerCount} quản lý · {memberCount} thành viên
            </span>
          ) : null
        }
      >
        <SearchInput
          value={keyword}
          onChange={setKeyword}
          placeholder="Tìm theo tên hoặc email..."
          widthClass="w-full sm:w-72"
        />
      </FilterBar>

      {loading ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 flex justify-center">
          <Spinner size="lg" label="Đang tải thành viên..." />
        </div>
      ) : loadError ? (
        <EmptyState
          icon="error"
          title="Không tải được dữ liệu"
          description={loadError}
          action={
            <Button variant="ghost" onClick={fetchMembers}>
              <Icon name="refresh" className="text-[18px]" />
              Thử lại
            </Button>
          }
        />
      ) : filtered.length === 0 && keyword ? (
        <EmptyState
          icon="search_off"
          title="Không tìm thấy thành viên"
          description="Thử với từ khóa khác."
        />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-700">
              <tr>
                <th className="px-6 py-4 font-semibold">Họ tên</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Vai trò</th>
                <th className="px-6 py-4 font-semibold">Trạng thái</th>
                {canManage ? (
                  <th className="px-6 py-4 font-semibold text-right w-32">Thao tác</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-neutral-200">
              {filtered.map((m) => {
                const isManager = m.project_role === 'MANAGER'
                const isProjectPm = project?.pm_id === m.user_id
                return (
                  <tr key={m.user_id} className="hover:bg-primary-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={makeInitials(m.full_name)} size="sm" />
                        <span className="font-medium text-on-surface">{m.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-on-surface-variant">{m.email}</td>
                    <td className="px-6 py-3">
                      <Pill tone={isManager ? 'primary' : 'neutral'}>
                        {isManager ? 'MANAGER' : 'MEMBER'}
                      </Pill>
                    </td>
                    <td className="px-6 py-3">
                      <Pill tone={m.status === 'Active' ? 'success' : 'neutral'}>
                        {m.status === 'Active' ? 'Hoạt động' : 'Đã khóa'}
                      </Pill>
                    </td>
                    {canManage ? (
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => askRemove(m)}
                            disabled={isProjectPm}
                            title={
                              isProjectPm
                                ? 'Đây là Quản lý dự án hiện tại, đổi PM trước khi gỡ.'
                                : 'Gỡ khỏi dự án'
                            }
                            className="p-1.5 rounded transition-colors text-danger-500 hover:bg-danger-50 disabled:text-neutral-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                          >
                            <Icon name="person_remove" className="text-[20px]" />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <AddMemberModal
          open={showAdd}
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
        />
      ) : null}

      <ConfirmDialog
        open={confirmState.open}
        loading={confirmState.busy}
        onClose={closeConfirm}
        onConfirm={handleConfirmRemove}
        tone="danger"
        title="Gỡ thành viên khỏi dự án"
        confirmLabel="Gỡ thành viên"
        message={
          confirmState.member
            ? `Gỡ "${confirmState.member.full_name}" khỏi dự án?\nMọi công việc đang giao cho họ trong dự án này sẽ tự động chuyển về trạng thái chưa có người phụ trách (assignee = NULL).`
            : ''
        }
      />
    </>
  )
}
