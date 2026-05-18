import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  Icon,
  PageHeader,
  useToast,
} from '../../components/ui'
import { ROUTE_PATHS } from '../../router/paths'
import { useProject } from '../../context/ProjectContext'
import { proposeTask } from '../../services/tasks.api'
import { TaskFormModal } from '../../components/tasks/TaskFormModal'

/**
 * UC07 — Trang đề xuất công việc cho Member.
 *
 * Phân quyền: chỉ Member thường (canManage=false) thấy hữu ích. PM có thể truy cập
 * nhưng không có lý do dùng vì PM tạo task trực tiếp qua UC06.
 *
 * Hiện tại trang đơn giản: 1 thẻ giải thích quy trình + 1 nút mở TaskFormModal.
 * (Có thể mở rộng sau: hiển thị danh sách đề xuất của chính mình kèm trạng thái duyệt
 * — cần endpoint backend mới.)
 */
export function ProjectSuggestPage() {
  const { projectId } = useParams()
  const { project, canManage } = useProject()
  const navigate = useNavigate()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [submittedCount, setSubmittedCount] = useState(0)

  const handleSubmit = async (payload) => {
    try {
      await proposeTask(projectId, payload)
      toast.success('Đã gửi đề xuất, chờ PM phê duyệt')
      setSubmittedCount((c) => c + 1)
      setOpen(false)
    } catch (err) {
      toast.error(err.message || 'Không gửi được đề xuất.')
      throw err
    }
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Dự án của tôi', to: ROUTE_PATHS.myProjects },
          { label: project?.name ?? 'Dự án', to: ROUTE_PATHS.project.board(projectId) },
          { label: 'Đề xuất công việc' },
        ]}
      />
      <PageHeader
        title="Đề xuất công việc"
        description={
          canManage
            ? 'Bạn là Quản lý dự án — có thể tạo công việc trực tiếp ở Bảng công việc thay vì đi qua đề xuất.'
            : 'Đề xuất sẽ được PM xét duyệt. Sau khi được duyệt, công việc sẽ xuất hiện trên bảng để cả nhóm theo dõi.'
        }
        actions={
          <Button variant="ghost" onClick={() => navigate(ROUTE_PATHS.project.board(projectId))}>
            <Icon name="arrow_back" className="text-[18px]" />
            Về bảng công việc
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-gap">
        <Card className="md:col-span-2">
          <CardHeader>
            <h3 className="text-h3 font-h3 text-on-surface">Gửi đề xuất mới</h3>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-on-surface-variant">
                Mô tả ngắn gọn công việc bạn muốn đề xuất, kèm mức ưu tiên và hạn dự kiến (nếu
                có). PM sẽ xem xét, có thể chỉnh sửa và bổ sung người phụ trách trước khi đưa
                vào bảng.
              </p>
              <Button onClick={() => setOpen(true)}>
                <Icon name="lightbulb" className="text-[18px]" />
                Mở form đề xuất
              </Button>

              {submittedCount > 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success-50 border border-success-600/20 text-success-600 text-sm">
                  <Icon name="check_circle" filled className="text-base" />
                  Đã gửi {submittedCount} đề xuất trong phiên này. PM sẽ nhận thông báo realtime.
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-h3 font-h3 text-on-surface">Quy trình duyệt</h3>
          </CardHeader>
          <CardBody>
            <ol className="flex flex-col gap-3 text-sm">
              {[
                {
                  icon: 'edit_note',
                  title: 'Bạn gửi đề xuất',
                  desc: 'Task đi vào trạng thái "Chờ duyệt", ẩn khỏi bảng chính.',
                },
                {
                  icon: 'rate_review',
                  title: 'PM xem xét',
                  desc: 'PM có thể chỉnh sửa thông tin trước khi quyết định.',
                },
                {
                  icon: 'verified',
                  title: 'Phê duyệt hoặc từ chối',
                  desc: 'Nếu duyệt → vào cột "Cần làm". Nếu từ chối → task bị xóa.',
                },
                {
                  icon: 'notifications_active',
                  title: 'Bạn được thông báo',
                  desc: 'Realtime ngay trong app + lịch sử ở mục Thông báo.',
                },
              ].map((step, i) => (
                <li key={step.title} className="flex items-start gap-3">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-xs">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 font-semibold text-on-surface">
                      <Icon name={step.icon} className="text-[16px] text-primary-700" />
                      {step.title}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-0.5">{step.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      <TaskFormModal
        open={open}
        mode="propose"
        projectId={projectId}
        project={project}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  )
}
