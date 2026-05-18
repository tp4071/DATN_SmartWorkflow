import { useState } from 'react'
import {
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Icon,
  PageHeader,
  Select,
  Spinner,
  useToast,
} from '../../components/ui'
import { ROUTE_PATHS } from '../../router/paths'
import { useProject } from '../../context/ProjectContext'
import { aiGenerateProjectSummary } from '../../services/ai.api'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatCard({ icon, label, value, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-neutral-50 border-neutral-200 text-on-surface',
    primary: 'bg-primary-50 border-primary-100 text-primary-900',
    warning: 'bg-tertiary-50 border-tertiary-300 text-tertiary-700',
    success: 'bg-success-50 border-success-600/20 text-success-600',
  }
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${tones[tone] ?? tones.neutral}`}>
      <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
        <Icon name={icon} className="text-[20px]" />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
        <div className="text-xs mt-1 opacity-80">{label}</div>
      </div>
    </div>
  )
}

function SummarySection({ icon, title, content, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-neutral-200',
    primary: 'border-primary-100',
    warning: 'border-tertiary-300',
    danger: 'border-danger-500/30',
    success: 'border-success-600/30',
  }
  const iconBg = {
    neutral: 'bg-neutral-100 text-neutral-700',
    primary: 'bg-primary-50 text-primary-700',
    warning: 'bg-tertiary-50 text-tertiary-700',
    danger: 'bg-danger-50 text-danger-500',
    success: 'bg-success-50 text-success-600',
  }
  return (
    <div className={`bg-white border rounded-xl p-5 ${tones[tone] ?? tones.neutral}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${iconBg[tone] ?? iconBg.neutral}`}>
          <Icon name={icon} filled className="text-[22px]" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-h3 font-h3 text-on-surface mb-2">{title}</h4>
          <p className="text-sm text-on-surface whitespace-pre-line leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  )
}

const WINDOW_OPTIONS = [
  { value: '3', label: '3 ngày qua' },
  { value: '7', label: '7 ngày qua (mặc định)' },
  { value: '14', label: '14 ngày qua' },
  { value: '30', label: '30 ngày qua' },
  { value: '60', label: '60 ngày qua' },
  { value: '90', label: '90 ngày qua' },
]

export function ProjectAIReportPage() {
  const { project, projectId, canManage } = useProject()
  const toast = useToast()

  /** stage: 'idle' | 'generating' | 'ready' | 'no_data' */
  const [stage, setStage] = useState('idle')
  const [report, setReport] = useState(null) // { summary, meta }
  const [error, setError] = useState(null)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [windowDays, setWindowDays] = useState('7')

  if (!canManage) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: 'Dự án của tôi', to: ROUTE_PATHS.myProjects },
            { label: project?.name ?? 'Dự án', to: ROUTE_PATHS.project.board(projectId) },
            { label: 'Báo cáo AI' },
          ]}
        />
        <PageHeader
          title="Báo cáo tiến độ AI"
          description="Chỉ Quản lý dự án mới sử dụng được tính năng này."
        />
        <EmptyState
          icon="lock"
          title="Bạn không có quyền truy cập"
          description="Báo cáo AI là công cụ ra quyết định cho PM. Hãy liên hệ Quản lý dự án để được chia sẻ thông tin."
        />
      </>
    )
  }

  const handleGenerate = async () => {
    setStage('generating')
    setError(null)
    try {
      const { data, message } = await aiGenerateProjectSummary(projectId, { windowDays })
      if (!data) {
        setStage('no_data')
        setError(message || `Không đủ dữ liệu để tạo báo cáo trong ${windowDays} ngày qua`)
        return
      }
      setReport(data)
      setGeneratedAt(new Date().toISOString())
      setStage('ready')
      toast.success(`Đã tạo báo cáo ${data.meta?.window_days ?? windowDays} ngày qua`)
    } catch (err) {
      setError(err.message || 'Tạo báo cáo thất bại.')
      setStage('idle')
    }
  }

  const selectedWindowLabel =
    WINDOW_OPTIONS.find((o) => o.value === windowDays)?.label ?? `${windowDays} ngày qua`

  const counts = report?.meta?.counts ?? {}

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Dự án của tôi', to: ROUTE_PATHS.myProjects },
          { label: project?.name ?? 'Dự án', to: ROUTE_PATHS.project.board(projectId) },
          { label: 'Báo cáo AI' },
        ]}
      />
      <PageHeader
        title="Báo cáo tiến độ AI"
        description="Gemini phân tích task hoàn thành, quá hạn và bình luận trong khung thời gian bạn chọn, đưa ra nhận xét + đề xuất hành động."
        actions={
          stage === 'ready' ? (
            <>
              <Select
                value={windowDays}
                onChange={setWindowDays}
                options={WINDOW_OPTIONS}
                ariaLabel="Khung thời gian phân tích"
                widthClass="w-44"
              />
              <Button variant="secondary" onClick={handleGenerate}>
                <Icon name="refresh" className="text-[18px]" />
                Sinh lại
              </Button>
            </>
          ) : null
        }
      />

      {error && stage !== 'no_data' ? (
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

      {/* IDLE — chưa từng sinh */}
      {stage === 'idle' ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center text-center py-8 px-4">
              <div className="w-16 h-16 rounded-full bg-secondary-50 text-secondary-700 flex items-center justify-center mb-4">
                <Icon name="auto_awesome" filled className="text-3xl" />
              </div>
              <h3 className="text-h2 font-h2 text-on-surface mb-2">
                Sinh báo cáo tiến độ
              </h3>
              <p className="text-sm text-on-surface-variant max-w-lg mb-6">
                AI sẽ tổng hợp các công việc hoàn thành, các điểm nghẽn (task quá hạn, bình
                luận thảo luận) và đưa ra dự báo rủi ro + đề xuất hành động — cho khung
                thời gian bạn chọn.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-2">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider sm:self-center">
                  Phân tích trong
                </label>
                <Select
                  value={windowDays}
                  onChange={setWindowDays}
                  options={WINDOW_OPTIONS}
                  ariaLabel="Khung thời gian phân tích"
                  widthClass="w-full sm:w-52"
                />
                <Button variant="secondary" onClick={handleGenerate}>
                  <Icon name="auto_awesome" className="text-[18px]" />
                  Sinh báo cáo
                </Button>
              </div>

              <div className="mt-4 text-[11px] text-outline flex items-center gap-1.5">
                <Icon name="info" className="text-[14px]" />
                <span>Thường mất 5–15 giây.</span>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* GENERATING */}
      {stage === 'generating' ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center text-center py-12 px-4 gap-3">
              <Spinner size="lg" />
              <div className="font-semibold text-on-surface">Gemini đang phân tích...</div>
              <div className="text-xs text-outline">
                Thu thập task & comment trong {selectedWindowLabel.toLowerCase()}, gửi cho LLM.
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* NO DATA */}
      {stage === 'no_data' ? (
        <EmptyState
          icon="hourglass_empty"
          title="Không đủ dữ liệu để tạo báo cáo"
          description={
            error ||
            `Trong ${selectedWindowLabel.toLowerCase()} chưa có task hoàn thành, task quá hạn hoặc bình luận nào. Thử mở rộng khung thời gian hoặc đợi có thêm hoạt động.`
          }
          action={
            <div className="flex flex-wrap items-center gap-2 justify-center">
              <Select
                value={windowDays}
                onChange={setWindowDays}
                options={WINDOW_OPTIONS}
                ariaLabel="Đổi khung thời gian"
                widthClass="w-52"
              />
              <Button variant="secondary" onClick={handleGenerate}>
                <Icon name="refresh" className="text-[18px]" />
                Thử lại
              </Button>
            </div>
          }
        />
      ) : null}

      {/* READY — render summary */}
      {stage === 'ready' && report ? (
        <>
          {/* Stats row từ meta.counts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-gap">
            <StatCard
              icon="task_alt"
              label={`Task hoàn thành (${report.meta?.window_days ?? windowDays} ngày)`}
              value={counts.completed_tasks ?? 0}
              tone="success"
            />
            <StatCard
              icon="warning"
              label="Task quá hạn"
              value={counts.overdue_tasks ?? 0}
              tone={counts.overdue_tasks > 0 ? 'warning' : 'neutral'}
            />
            <StatCard
              icon="comment"
              label="Bình luận mới"
              value={counts.recent_comments ?? 0}
              tone="primary"
            />
          </div>

          {/* 3 phần chính của báo cáo */}
          <div className="flex flex-col gap-stack-gap">
            <SummarySection
              icon="assessment"
              title="Đánh giá tổng quan"
              content={report.summary.danh_gia_tong_quan}
              tone="primary"
            />
            <SummarySection
              icon="warning"
              title="Điểm nghẽn"
              content={report.summary.diem_nghen}
              tone="warning"
            />
            <SummarySection
              icon="auto_awesome"
              title="Dự báo & Đề xuất hành động"
              content={report.summary.du_bao_rui_ro}
              tone="success"
            />
          </div>

          {/* Footer meta */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between flex-wrap gap-3 text-xs text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                  <Icon name="auto_awesome" className="text-[14px] text-secondary-700" />
                  <span>
                    Báo cáo do AI sinh, dựa trên dữ liệu thực tế 7 ngày qua. Vui lòng đối chiếu
                    với tình hình dự án trước khi đưa ra quyết định.
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon name="schedule" className="text-[14px]" />
                  <span>Tạo lúc {formatDateTime(generatedAt)}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      ) : null}
    </>
  )
}
