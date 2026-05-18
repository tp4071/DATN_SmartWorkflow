export const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH'];

export const STATUS_VALUES = [
  'Chờ duyệt',
  'Cần làm',
  'Đang làm',
  'Chờ đánh giá',
  'Hoàn thành'
];

export const DEFAULT_STATUS = 'Cần làm';
export const DEFAULT_PRIORITY = 'MEDIUM';

// Khoảng cách chuẩn giữa 2 task liền kề trong cùng 1 cột Kanban.
export const ORDER_STEP = 1000;

// Ngưỡng kích hoạt rebalance: khi (next - prev) < MIN_GAP.
export const MIN_GAP = 0.01;
