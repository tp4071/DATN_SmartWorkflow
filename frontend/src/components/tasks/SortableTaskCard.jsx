import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskCard } from './TaskCard'

/**
 * Wrap TaskCard với @dnd-kit/sortable hook.
 *
 * Trick: PointerSensor được cấu hình activationConstraint distance=8 ở DndContext
 * nên click ngắn vẫn fire onClick (mở detail modal); chỉ khi kéo > 8px mới bắt đầu drag.
 *
 * Trong khi đang drag, đặt opacity 0.4 cho thẻ gốc để cho thấy thẻ "ma" đang theo cursor.
 */
export function SortableTaskCard({ task, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={onClick} />
    </div>
  )
}
