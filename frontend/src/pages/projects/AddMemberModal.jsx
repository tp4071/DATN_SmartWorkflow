import { useEffect, useRef, useState } from 'react'
import { Modal, Button, Icon, Avatar, SearchInput, Spinner } from '../../components/ui'
import { searchAvailableUsers } from '../../services/projectMembers.api'

function makeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Modal thêm thành viên cho dự án.
 *  - Mở: gọi search lần đầu với q=''
 *  - Người dùng gõ -> debounce 300ms -> gọi lại search
 *  - Click một user -> gọi onAdd(user). Trong khi backend xử lý, hiển thị spinner cạnh user đó.
 *    Kết quả thành công sẽ được parent update vào state; user vừa thêm tự biến mất khỏi list (vì
 *    search loại trừ thành viên đã có ở backend), không cần xử lý thêm ở UI.
 */
export function AddMemberModal({ open, projectId, onClose, onAdd }) {
  const [keyword, setKeyword] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [addingId, setAddingId] = useState(null)
  const debounceRef = useRef(null)
  const reqIdRef = useRef(0)

  // Reset state mỗi khi mở
  useEffect(() => {
    if (open) {
      setKeyword('')
      setError(null)
      setAddingId(null)
    }
  }, [open])

  // Search (lần đầu open + mỗi khi keyword đổi)
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const reqId = ++reqIdRef.current
      setLoading(true)
      setError(null)
      try {
        const data = await searchAvailableUsers(projectId, keyword)
        if (reqId === reqIdRef.current) {
          setUsers(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (reqId === reqIdRef.current) {
          setError(err.message || 'Không tải được danh sách người dùng.')
          setUsers([])
        }
      } finally {
        if (reqId === reqIdRef.current) setLoading(false)
      }
    }, keyword ? 300 : 0)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [open, keyword, projectId])

  const handleAdd = async (user) => {
    if (addingId) return
    setAddingId(user.id)
    try {
      await onAdd(user)
      // Loại bỏ user đó khỏi list local ngay (chờ search reload sẽ trễ)
      setUsers((arr) => arr.filter((u) => u.id !== user.id))
    } catch {
      // Parent đã hiển thị toast; không cần thêm
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm thành viên vào dự án"
      size="md"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="p-6 flex flex-col gap-4">
        <SearchInput
          value={keyword}
          onChange={setKeyword}
          placeholder="Tìm theo tên hoặc email..."
          widthClass="w-full"
        />

        {loading ? (
          <div className="py-10 flex justify-center">
            <Spinner label="Đang tìm kiếm..." />
          </div>
        ) : error ? (
          <div className="px-3 py-2 border border-error-container rounded-lg bg-danger-50 text-error text-sm">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center text-on-surface-variant">
            <Icon name="person_search" className="text-3xl text-outline mb-2" />
            <p className="text-sm">
              {keyword
                ? 'Không tìm thấy người dùng phù hợp.'
                : 'Không còn nhân sự khả dụng để thêm.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1 max-h-[420px] overflow-y-auto scrollbar-thin -mx-2 px-2">
            {users.map((u) => {
              const isAdding = addingId === u.id
              const isOtherAdding = !!addingId && !isAdding
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={isAdding || isOtherAdding}
                    onClick={() => handleAdd(u)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg border border-transparent hover:border-primary-100 hover:bg-primary-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
                  >
                    <Avatar initials={makeInitials(u.full_name)} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-on-surface truncate">{u.full_name}</div>
                      <div className="text-xs text-on-surface-variant truncate">{u.email}</div>
                    </div>
                    {u.system_role === 'ADMIN' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-primary-100 text-primary-700 bg-primary-50 font-semibold">
                        ADMIN
                      </span>
                    ) : null}
                    {isAdding ? (
                      <Icon name="progress_activity" className="text-base spin text-outline" />
                    ) : (
                      <Icon name="add" className="text-base text-outline" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
