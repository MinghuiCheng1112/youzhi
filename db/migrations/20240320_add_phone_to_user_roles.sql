-- 添加phone字段到user_roles表
ALTER TABLE IF EXISTS public.user_roles
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 添加电话索引以加快搜索
CREATE INDEX IF NOT EXISTS user_roles_phone_idx ON public.user_roles (phone); 