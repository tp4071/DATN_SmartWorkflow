import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Icon,
  PageHeader,
  PriorityBadge,
  Spinner,
  useToast,
} from '../../components/ui'
import { ROUTE_PATHS } from '../../router/paths'
import { useProject } from '../../context/ProjectContext'
import { aiConfirmTasks, aiGenerateTasks } from '../../services/ai.api'
import { qk } from '../../lib/queryKeys'

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
]

const REQUIREMENT_MAX = 4000
const REQUIREMENT_MIN = 20

const SAMPLE_PROMPTS = [
  'Triển khai chức năng đăng nhập với JWT, kèm form quên mật khẩu và xác thực OTP qua email.',
  'Xây dựng module quản lý nhân sự cho admin: CRUD users, lọc tìm kiếm và phân quyền.',
  'Tích hợp thanh toán Stripe cho luồng đặt hàng — từ checkout, webhook đến trang quản lý đơn.',
]

/**
 * Step indicator trên đầu trang. Hiện trạng "đang ở bước nào".
 */
function StepIndicator({ stage }) {
  const steps = [
    { key: 'input', icon: 'edit_note', label: 'Mô tả yêu cầu' },
    { key: 'review', icon: 'fact_check', label: 'Rà soát & chỉnh sửa' },
    { key: 'done', icon: 'verified', label: 'Lưu vào dự án' },
  ]
  const activeIdx =
    stage === 'review' || stage === 'saving' ? 1 : stage === 'done' ? 2 : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const isActive = i === activeIdx
        const isPast = i < activeIdx
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                isActive
                  ? 'bg-primary-container text-white border-primary-container font-semibold'
                  : isPast
                    ? 'bg-success-50 text-success-600 border-success-600/30'
                    : 'bg-white text-outline border-neutral-200'
              }`}
            >
              <Icon name={isPast ? 'check' : s.icon} className="text-[14px]" />
              <span>{i + 1}. {s.label}</span>
            </div>
            {i < steps.length - 1 ? (
              <Icon name="chevron_right" className="text-outline text-[14px]" />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Card chỉnh sửa task nháp.
 */
function DraftTaskCard({ index, draft, onChange, onRemove, disabled }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-3 hover:border-primary-300 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-xs shrink-0">
          {index + 1}
        </div>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="Tiêu đề task"
          disabled={disabled}
          maxLength={250}
          className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm font-medium focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="p-1.5 rounded text-outline hover:text-danger-500 hover:bg-danger-50 transition-colors disabled:opacity-50"
          title="Xóa khỏi danh sách"
        >
          <Icon name="delete" className="text-[18px]" />
        </button>
      </div>

      <textarea
        value={draft.description ?? ''}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        placeholder="Mô tả chi tiết các bước cần làm..."
        rows={2}
        disabled={disabled}
        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-outline uppercase tracking-wider">Ưu tiên</span>
          <select
            value={draft.priority}
            onChange={(e) => onChange({ ...draft, priority: e.target.value })}
            disabled={disabled}
            className="px-2 py-1 border border-neutral-200 rounded-lg text-xs bg-white focus:outline-none focus:border-primary-container"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-outline uppercase tracking-wider">Ước tính</span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={draft.estimateHours ?? ''}
            onChange={(e) => onChange({ ...draft, estimateHours: e.target.value })}
            disabled={disabled}
            className="w-20 px-2 py-1 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:border-primary-container"
          />
          <span className="text-[11px] text-outline">giờ</span>
        </div>
        <div className="ml-auto">
          <PriorityBadge priority={draft.priority} />
        </div>
      </div>
    </div>
  )
}

export function ProjectAITasksPage() {
  const { project, projectId, canManage } = useProject()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  /** stage: 'input' | 'generating' | 'review' | 'saving' */
  const [stage, setStage] = useState('input')
  const [requirement, setRequirement] = useState('')
  const [drafts, setDrafts] = useState([])
  const [error, setError] = useState(null)

  if (!canManage) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: 'Dự án của tôi', to: ROUTE_PATHS.myProjects },
            { label: project?.name ?? 'Dự án', to: ROUTE_PATHS.project.board(projectId) },
            { label: 'AI tách task' },
          ]}
        />
        <PageHeader
          title="AI tách công việc"
          description="Chỉ Quản lý dự án mới sử dụng được tính năng này."
        />
        <EmptyState
          icon="lock"
          title="Bạn không có quyền truy cập"
          description="Chỉ PM được dùng AI để khởi tạo công việc cho dự án."
        />
      </>
    )
  }

  const trimmedReq = requirement.trim()
  const reqError =
    trimmedReq.length > 0 && trimmedReq.length < REQUIREMENT_MIN
      ? `Mô tả quá ngắn (tối thiểu ${REQUIREMENT_MIN} ký tự).`
      : trimmedReq.length > REQUIREMENT_MAX
        ? `Mô tả quá dài (tối đa ${REQUIREMENT_MAX} ký tự).`
        : null
  const canSubmitReq =
    trimmedReq.length >= REQUIREMENT_MIN &&
    trimmedReq.length <= REQUIREMENT_MAX &&
    stage === 'input'

  const handleGenerate = async () => {
    if (!canSubmitReq) return
    setStage('generating')
    setError(null)
    try {
      const items = await aiGenerateTasks(projectId, trimmedReq)
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('AI không sinh được task nào. Hãy thử mô tả rõ hơn.')
      }
      setDrafts(
        items.map((it) => ({
          // gắn local id để key không trùng khi user thêm/xóa
          _id: crypto.randomUUID(),
          title: it.title ?? '',
          description: it.description ?? '',
          priority: it.priority ?? 'MEDIUM',
          estimateHours: it.estimateHours ?? '',
        })),
      )
      setStage('review')
      toast.success(`AI đã sinh ${items.length} task. Hãy rà soát trước khi lưu.`)
    } catch (err) {
      setError(err.message || 'AI sinh task thất bại.')
      setStage('input')
    }
  }

  const updateDraft = (idx, next) => {
    setDrafts((arr) => arr.map((d, i) => (i === idx ? { ...next, _id: d._id } : d)))
  }
  const removeDraft = (idx) => {
    setDrafts((arr) => arr.filter((_, i) => i !== idx))
  }
  const addBlankDraft = () => {
    setDrafts((arr) => [
      ...arr,
      {
        _id: crypto.randomUUID(),
        title: '',
        description: '',
        priority: 'MEDIUM',
        estimateHours: '',
      },
    ])
  }
  const resetAll = () => {
    setDrafts([])
    setRequirement('')
    setError(null)
    setStage('input')
  }

  const draftsValid = drafts.every((d) => d.title.trim().length > 0)

  const handleConfirm = async () => {
    if (drafts.length === 0) {
      toast.error('Danh sách trống — không có gì để lưu.')
      return
    }
    if (!draftsValid) {
      toast.error('Có task chưa có tiêu đề. Vui lòng điền hoặc xóa.')
      return
    }
    setStage('saving')
    setError(null)
    try {
      const created = await aiConfirmTasks(projectId, drafts)
      // Invalidate cache để Kanban refetch ngay khi user về
      queryClient.invalidateQueries({ queryKey: qk.projects.tasks(projectId) })
      toast.success(`Đã lưu ${created.length} task vào cột "Cần làm".`)
      navigate(ROUTE_PATHS.project.board(projectId))
    } catch (err) {
      setError(err.message || 'Lưu thất bại.')
      setStage('review')
    }
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Dự án của tôi', to: ROUTE_PATHS.myProjects },
          { label: project?.name ?? 'Dự án', to: ROUTE_PATHS.project.board(projectId) },
          { label: 'AI tách task' },
        ]}
      />
      <PageHeader
        title="AI tách công việc"
        description="Mô tả nghiệp vụ bằng tiếng Việt — Gemini sẽ phân rã thành danh sách task có cấu trúc, bạn rà soát rồi mới lưu vào dự án."
        actions={
          stage === 'review' || stage === 'saving' ? (
            <Button variant="ghost" onClick={resetAll} disabled={stage === 'saving'}>
              <Icon name="restart_alt" className="text-[18px]" />
              Bắt đầu lại
            </Button>
          ) : null
        }
      />

      <StepIndicator stage={stage} />

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger-50 border border-error-container text-error text-sm"
        >
          <Icon name="error" filled className="text-base mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-error/70 hover:text-error"
            aria-label="Đóng"
          >
            <Icon name="close" className="text-base" />
          </button>
        </div>
      ) : null}

      {/* STAGE: input | generating */}
      {stage === 'input' || stage === 'generating' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-stack-gap">
          <Card className="xl:col-span-2">
            <CardHeader>
              <h3 className="text-h3 font-h3 text-on-surface">Mô tả yêu cầu nghiệp vụ</h3>
              <span className="text-xs text-outline">
                Càng cụ thể càng tốt — AI sẽ phân rã sát yêu cầu hơn.
              </span>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-3">
                <textarea
                  value={requirement}
                  onChange={(e) => setRequirement(e.target.value)}
                  rows={10}
                  maxLength={REQUIREMENT_MAX}
                  disabled={stage === 'generating'}
                  placeholder={`Ví dụ:\n${SAMPLE_PROMPTS[0]}`}
                  className={`w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-1 transition-colors ${
                    reqError
                      ? 'border-error focus:border-error focus:ring-error'
                      : 'border-neutral-200 focus:border-primary-container focus:ring-primary-container'
                  } disabled:bg-neutral-50`}
                />
                <div className="flex items-center justify-between text-xs">
                  <span className={reqError ? 'text-error' : 'text-outline'}>
                    {reqError ?? `${trimmedReq.length}/${REQUIREMENT_MAX} ký tự`}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={handleGenerate}
                    disabled={!canSubmitReq || stage === 'generating'}
                  >
                    {stage === 'generating' ? (
                      <>
                        <Icon name="progress_activity" className="text-sm spin" />
                        AI đang phân tích...
                      </>
                    ) : (
                      <>
                        <Icon name="auto_awesome" className="text-[18px]" />
                        Sinh task bằng AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-h3 font-h3 text-on-surface">Gợi ý mô tả</h3>
            </CardHeader>
            <CardBody>
              <ul className="flex flex-col gap-2">
                {SAMPLE_PROMPTS.map((sample, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setRequirement(sample)}
                      disabled={stage === 'generating'}
                      className="w-full text-left text-xs text-on-surface-variant bg-neutral-50 hover:bg-primary-50 hover:text-primary-900 border border-neutral-200 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
                    >
                      <Icon name="lightbulb" className="text-[14px] mr-1 text-secondary-700" />
                      {sample}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-[11px] text-outline flex items-start gap-1.5">
                <Icon name="info" className="text-[14px] mt-0.5" />
                <span>
                  AI dùng ngữ cảnh dự án ({project?.name}) và các task gần nhất để tránh
                  trùng lặp. Task sinh ra ban đầu sẽ ở cột "Cần làm" và chưa được giao
                  ai — bạn gán PM sau.
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {/* STAGE: review | saving */}
      {stage === 'review' || stage === 'saving' ? (
        <>
          <div className="bg-secondary-50 border border-secondary-100 rounded-lg p-3 text-xs text-secondary-900 flex items-start gap-2">
            <Icon name="auto_awesome" className="text-base mt-0.5 text-secondary-700" />
            <span>
              AI đã sinh <b>{drafts.length}</b> task nháp. Bạn có thể sửa trực tiếp các trường,
              xóa task không phù hợp, hoặc thêm task mới trước khi lưu.
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {drafts.map((draft, i) => (
              <DraftTaskCard
                key={draft._id}
                index={i}
                draft={draft}
                onChange={(next) => updateDraft(i, next)}
                onRemove={() => removeDraft(i)}
                disabled={stage === 'saving'}
              />
            ))}
            {drafts.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="Đã xóa hết task nháp"
                description="Bạn có thể bắt đầu lại để mô tả yêu cầu khác hoặc thêm task thủ công."
              />
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 sticky bottom-4 bg-white border border-neutral-200 rounded-xl px-4 py-3 shadow-md">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={addBlankDraft}
                disabled={stage === 'saving'}
              >
                <Icon name="add" className="text-[18px]" />
                Thêm task trống
              </Button>
              <span className="text-xs text-outline">
                {drafts.length} task · {!draftsValid ? 'có task thiếu tiêu đề' : 'sẵn sàng lưu'}
              </span>
            </div>
            <Button
              onClick={handleConfirm}
              disabled={stage === 'saving' || drafts.length === 0 || !draftsValid}
            >
              {stage === 'saving' ? (
                <>
                  <Icon name="progress_activity" className="text-sm spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Icon name="save" className="text-[18px]" />
                  Lưu {drafts.length > 0 ? `${drafts.length} task ` : ''}vào dự án
                </>
              )}
            </Button>
          </div>
        </>
      ) : null}

      {stage === 'generating' ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <div className="text-sm text-on-surface-variant text-center">
            <div className="font-semibold text-on-surface">Gemini đang phân tích yêu cầu...</div>
            <div className="text-xs mt-1">Thường mất 5–15 giây tùy độ phức tạp.</div>
          </div>
        </div>
      ) : null}
    </>
  )
}
