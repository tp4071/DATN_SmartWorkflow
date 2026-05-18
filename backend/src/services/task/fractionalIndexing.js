import { ORDER_STEP, MIN_GAP } from './task.constants.js';
import * as TaskRepository from '../../repositories/task.repository.js';

/**
 * Tính order_index mới theo fractional indexing.
 *   - cả prev và next null  -> ORDER_STEP (cột trống)
 *   - prev null             -> next / 2
 *   - next null             -> prev + ORDER_STEP
 *   - cả hai có giá trị     -> (prev + next) / 2
 */
export const computeFractionalIndex = (prev, next) => {
  if (prev === null && next === null) return ORDER_STEP;
  if (prev === null) return next / 2;
  if (next === null) return prev + ORDER_STEP;
  return (prev + next) / 2;
};

/**
 * Kiểm tra precision exhaustion: khoảng cách (next - prev) < MIN_GAP.
 */
export const needsRebalance = (prev, next) => {
  if (prev === null || next === null) return false;
  return (next - prev) < MIN_GAP;
};

/**
 * Rebalance 1 cột Kanban: gán lại order_index tuần tự ORDER_STEP, 2*ORDER_STEP, ...
 * cho các task theo thứ tự xuất hiện trong columnRows.
 *
 * @param {import('pg').PoolClient} client - đang trong transaction.
 * @param {Array<{id: string, order_index: number}>} columnRows - danh sách task sort ASC.
 * @returns {Promise<Map<string, number>>} map task_id -> order_index mới.
 */
export const rebalanceColumn = async (client, columnRows) => {
  const newValueById = new Map();
  for (let i = 0; i < columnRows.length; i += 1) {
    const row = columnRows[i];
    const newVal = (i + 1) * ORDER_STEP;
    newValueById.set(row.id, newVal);
    await TaskRepository.updateOrderIndex(client, row.id, newVal);
  }
  return newValueById;
};
