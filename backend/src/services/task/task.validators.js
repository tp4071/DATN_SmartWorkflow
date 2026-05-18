import { createError } from '../shared/errors.js';
import { PRIORITY_VALUES, STATUS_VALUES } from './task.constants.js';

export const validateTitle = (title) => {
  if (!title || !title.trim()) {
    throw createError('Tiêu đề công việc (title) là bắt buộc', 400);
  }
  return title.trim();
};

export const validatePriority = (priority, defaultValue) => {
  const finalPriority = priority || defaultValue;
  if (!PRIORITY_VALUES.includes(finalPriority)) {
    throw createError(`priority phải là một trong: ${PRIORITY_VALUES.join(', ')}`, 400);
  }
  return finalPriority;
};

export const validateStatus = (status) => {
  if (!status || !STATUS_VALUES.includes(status)) {
    throw createError(`new_status phải là một trong: ${STATUS_VALUES.join(', ')}`, 400);
  }
  return status;
};

export const parseDateField = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createError(`Trường ${fieldName} không đúng định dạng ngày`, 400);
  }
  return date;
};

export const parseEstimateHours = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    throw createError('estimate_hours phải là số không âm', 400);
  }
  return num;
};

export const parseOrderValue = (value, fieldName) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    throw createError(`${fieldName} phải là số hợp lệ hoặc null`, 400);
  }
  return num;
};
