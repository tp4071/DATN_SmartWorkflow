import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Breadcrumb,
  Button,
  ConfirmDialog,
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
import {
  createUser,
  resetUserPassword,
  toggleUserStatus,
  updateUser,
} from '../../services/users.api'
import { useUsersQuery } from '../../hooks/useUsersQuery'
import { qk } from '../../lib/queryKeys'
import { removeVietnameseTones } from '../../utils/vietnameseSearch'
import { UserFormModal } from './UserFormModal'
import { BulkImportUsersModal } from './BulkImportUsersModal'
import { ResetPasswordResultModal } from './ResetPasswordResultModal'

const ROLE_FILTERS = [
  { value: 'ALL', label: 'Tất cả vai trò' },
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'USER', label: 'USER' },
]
const STATUS_FILTERS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'Active', label: 'Hoạt động' },
  { value: 'Inactive', label: 'Đã khóa' },
]

const ROLE_LABEL = { ADMIN: 'ADMIN', USER: 'USER' }

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AdminUsersPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()

  const usersKey = qk.users.list()
  const {
    data: usersData,
    isLoading: loading,
    isError: loadIsError,
    error: loadErr,
    refetch: fetchUsers,
  } = useUsersQuery()
  const users = useMemo(() => usersData ?? [], [usersData])
  const loadError = loadIsError ? loadErr?.message || 'Không tải được nhân sự.' : null

  const patchUsers = (updater) => {
    queryClient.setQueryData(usersKey, (prev) => updater(prev ?? []))
  }

  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [formState, setFormState] = useState({ open: false, mode: 'create', user: null })
  const [confirmState, setConfirmState] = useState({ open: false, user: null, busy: false })
  const [importOpen, setImportOpen] = useState(false)
  // Reset password flow: 2 bước -> confirm trước, sau đó hiện modal kết quả
  // chứa mật khẩu mới (chỉ trả về 1 lần từ backend).
  const [resetConfirm, setResetConfirm] = useState({ open: false, user: null, busy: false })
  const [resetResult, setResetResult] = useState({ open: false, payload: null })

  const filtered = useMemo(() => {
    const kw = removeVietnameseTones(keyword)
    return users.filter((u) => {
      if (kw) {
        const hay = removeVietnameseTones(`${u.full_name ?? ''} ${u.email ?? ''}`)
        if (!hay.includes(kw)) return false
      }
      if (roleFilter !== 'ALL' && u.system_role !== roleFilter) return false
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false
      return true
    })
  }, [users, keyword, roleFilter, statusFilter])

  const openCreate = () => setFormState({ open: true, mode: 'create', user: null })
  const openEdit = (user) => setFormState({ open: true, mode: 'edit', user })
  const closeForm = () => setFormState((s) => ({ ...s, open: false }))

  // Sau khi user vừa được thêm/đổi, invalidate cache để các nơi khác đang dùng
  // useUsersQuery (ProjectFormModal — chọn PM, TaskFormModal qua project members
  // được fetch riêng) cũng tự đồng bộ.
  const invalidateUsersCache = () =>
    queryClient.invalidateQueries({ queryKey: qk.users.all() })

  const handleSubmitForm = async (payload) => {
    if (formState.mode === 'edit') {
      const updated = await updateUser(formState.user.id, {
        fullName: payload.fullName,
        email: payload.email,
        systemRole: payload.systemRole,
      })
      patchUsers((arr) => arr.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
      invalidateUsersCache()
      toast.success('Cập nhật thông tin nhân sự thành công')
    } else {
      const created = await createUser(payload)
      patchUsers((arr) => [created, ...arr])
      invalidateUsersCache()
      toast.success('Thêm mới nhân sự thành công')
    }
    closeForm()
  }

  const askToggle = (user) => setConfirmState({ open: true, user, busy: false })
  const closeConfirm = () => setConfirmState({ open: false, user: null, busy: false })

  const askResetPassword = (user) => setResetConfirm({ open: true, user, busy: false })
  const closeResetConfirm = () => setResetConfirm({ open: false, user: null, busy: false })
  const closeResetResult = () => setResetResult({ open: false, payload: null })

  const handleConfirmReset = async () => {
    const target = resetConfirm.user
    if (!target) return
    setResetConfirm((s) => ({ ...s, busy: true }))
    try {
      const payload = await resetUserPassword(target.id)
      closeResetConfirm()
      setResetResult({ open: true, payload })
    } catch (err) {
      toast.error(err.message || 'Không reset được mật khẩu.')
      setResetConfirm((s) => ({ ...s, busy: false }))
    }
  }

  const handleConfirmToggle = async () => {
    const target = confirmState.user
    if (!target) return
    setConfirmState((s) => ({ ...s, busy: true }))
    try {
      const { user: updated, details, message } = await toggleUserStatus(target.id)
      patchUsers((arr) => arr.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
      invalidateUsersCache()
      const releasedTasks = details?.releasedTasks ?? []
      if (releasedTasks.length > 0) {
        toast.success(
          message ||
            `Đã khóa tài khoản. Đã tự động gỡ phụ trách ${releasedTasks.length} công việc.`,
          { duration: 6000 },
        )
      } else {
        toast.success(
          updated.status === 'Active' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản',
        )
      }
      closeConfirm()
    } catch (err) {
      const managedProjects = err?.details?.managedProjects
      if (Array.isArray(managedProjects) && managedProjects.length > 0) {
        const preview = managedProjects
          .slice(0, 3)
          .map((p) => p.project_code || p.name)
          .join(', ')
        const more = managedProjects.length > 3 ? `, +${managedProjects.length - 3} dự án khác` : ''
        toast.error(
          `${err.message} Dự án liên quan: ${preview}${more}.`,
          { duration: 6000 },
        )
      } else {
        toast.error(err.message || 'Không cập nhật được trạng thái.')
      }
      setConfirmState((s) => ({ ...s, busy: false }))
    }
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Trang chủ', to: ROUTE_PATHS.admin.dashboard },
          { label: 'Quản lý nhân sự' },
        ]}
      />
      <PageHeader
        title="Quản lý nhân sự"
        description="Quản lý tài khoản người dùng và trạng thái hoạt động trong hệ thống."
        actions={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              <Icon name="upload_file" className="text-[18px]" />
              Nhập từ CSV
            </Button>
            <Button onClick={openCreate}>
              <Icon name="add" className="text-[18px]" />
              Thêm nhân sự
            </Button>
          </>
        }
      />

      <FilterBar
        right={
          !loading ? (
            <span className="text-xs text-outline">
              {filtered.length} / {users.length} nhân sự
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
        <Select
          value={roleFilter}
          onChange={setRoleFilter}
          options={ROLE_FILTERS}
          ariaLabel="Lọc theo vai trò"
          widthClass="w-full sm:w-44"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS}
          ariaLabel="Lọc theo trạng thái"
          widthClass="w-full sm:w-44"
        />
      </FilterBar>

      {loading ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 flex justify-center">
          <Spinner size="lg" label="Đang tải danh sách nhân sự..." />
        </div>
      ) : loadError ? (
        <EmptyState
          icon="error"
          title="Không tải được dữ liệu"
          description={loadError}
          action={
            <Button variant="ghost" onClick={() => fetchUsers()}>
              <Icon name="refresh" className="text-[18px]" />
              Thử lại
            </Button>
          }
        />
      ) : users.length === 0 ? (
        <EmptyState
          icon="group"
          title="Chưa có nhân sự nào"
          description="Bắt đầu bằng cách thêm tài khoản cho thành viên đầu tiên."
          action={
            <Button onClick={openCreate}>
              <Icon name="add" className="text-[18px]" />
              Thêm nhân sự
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search_off"
          title="Không tìm thấy kết quả"
          description="Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc."
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
                <th className="px-6 py-4 font-semibold">Ngày tạo</th>
                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-neutral-200">
              {filtered.map((u) => {
                const isActive = u.status === 'Active'
                return (
                  <tr key={u.id} className="hover:bg-primary-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-on-surface">{u.full_name}</td>
                    <td className="px-6 py-3 text-on-surface-variant">{u.email}</td>
                    <td className="px-6 py-3">
                      <Pill tone={u.system_role === 'ADMIN' ? 'primary' : 'neutral'}>
                        {ROLE_LABEL[u.system_role] ?? u.system_role}
                      </Pill>
                    </td>
                    <td className="px-6 py-3">
                      <Pill tone={isActive ? 'success' : 'neutral'}>
                        {isActive ? 'Hoạt động' : 'Đã khóa'}
                      </Pill>
                    </td>
                    <td className="px-6 py-3 text-on-surface-variant">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="p-1.5 text-neutral-700 hover:text-primary-container hover:bg-primary-50 rounded transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Icon name="edit" className="text-[20px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => askResetPassword(u)}
                          disabled={u.id === currentUser?.id}
                          className="p-1.5 text-neutral-700 hover:text-tertiary-700 hover:bg-tertiary-50 rounded transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-700 disabled:cursor-not-allowed"
                          title={
                            u.id === currentUser?.id
                              ? 'Không thể reset mật khẩu của chính bạn'
                              : 'Reset mật khẩu'
                          }
                        >
                          <Icon name="lock_reset" className="text-[20px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => askToggle(u)}
                          className={`p-1.5 rounded transition-colors ${
                            isActive
                              ? 'text-danger-500 hover:bg-danger-50'
                              : 'text-success-600 hover:bg-success-50'
                          }`}
                          title={isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                        >
                          <Icon name={isActive ? 'lock' : 'lock_open'} className="text-[20px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal
        open={formState.open}
        mode={formState.mode}
        initialUser={formState.user}
        onClose={closeForm}
        onSubmit={handleSubmitForm}
      />

      <BulkImportUsersModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCompleted={(created) => {
          // Backend trả users mới (đầy đủ trường) — prepend vào state
          patchUsers((arr) => [...created, ...arr])
          if (created.length > 0) {
            toast.success(`Đã thêm ${created.length} nhân sự từ CSV`)
          }
        }}
      />

      <ConfirmDialog
        open={confirmState.open}
        loading={confirmState.busy}
        onClose={closeConfirm}
        onConfirm={handleConfirmToggle}
        tone={confirmState.user?.status === 'Active' ? 'danger' : 'success'}
        title={
          confirmState.user?.status === 'Active'
            ? 'Khóa tài khoản'
            : 'Mở khóa tài khoản'
        }
        confirmLabel={confirmState.user?.status === 'Active' ? 'Khóa' : 'Mở khóa'}
        message={
          confirmState.user
            ? confirmState.user.status === 'Active'
              ? `Bạn có chắc chắn muốn khóa tài khoản của "${confirmState.user.full_name}"?\nNgười dùng này sẽ không thể đăng nhập vào hệ thống.`
              : `Mở khóa tài khoản của "${confirmState.user.full_name}"?\nNgười dùng có thể đăng nhập trở lại sau khi mở khóa.`
            : ''
        }
      />

      <ConfirmDialog
        open={resetConfirm.open}
        loading={resetConfirm.busy}
        onClose={closeResetConfirm}
        onConfirm={handleConfirmReset}
        tone="warning"
        title="Reset mật khẩu"
        confirmLabel="Reset"
        message={
          resetConfirm.user
            ? `Reset mật khẩu cho "${resetConfirm.user.full_name}"?\nMật khẩu cũ sẽ không còn dùng được. Hệ thống sẽ sinh mật khẩu ngẫu nhiên và hiển thị 1 lần để bạn chuyển cho người dùng.`
            : ''
        }
      />

      <ResetPasswordResultModal
        open={resetResult.open}
        result={resetResult.payload}
        onClose={closeResetResult}
      />
    </>
  )
}
