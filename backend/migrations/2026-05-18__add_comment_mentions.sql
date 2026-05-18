-- Migration: hỗ trợ @mention trong task_comments
-- Ngày: 2026-05-18
-- Chạy 1 lần trên Supabase SQL editor.

-- 1. Thêm cột lưu danh sách user_id được @mention trong 1 comment.
ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

-- 2. Index GIN để truy vấn "comment nào có nhắc user X" nhanh.
CREATE INDEX IF NOT EXISTS idx_task_comments_mentions
  ON public.task_comments USING GIN (mentioned_user_ids);
