# 数据库迁移指南

这个目录包含了数据库迁移脚本和函数定义，用于更新Supabase数据库结构。

## 最新紧急修复（请先执行）

如果遇到递归策略错误，请立即执行以下SQL脚本：

```sql
-- 完全禁用RLS并重置权限

-- 删除所有现有策略
DROP POLICY IF EXISTS user_roles_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_insert_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete_policy ON public.user_roles;

-- 完全禁用RLS
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 重置权限，简化为基本的表级权限
GRANT ALL ON public.user_roles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.user_roles_id_seq TO authenticated;

-- 删除可能导致递归的函数
DROP FUNCTION IF EXISTS public.get_all_user_metadata();
DROP FUNCTION IF EXISTS public.add_user_metadata();

-- 确保email和name列存在
ALTER TABLE IF EXISTS public.user_roles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS name TEXT;
```

## 迁移步骤

1. 登录到Supabase管理控制台（https://app.supabase.io）
2. 选择您的项目
3. 点击"SQL编辑器"标签
4. 创建一个新的查询
5. 复制粘贴上面的SQL脚本或以下文件内容：
   - `migrations/20240320_disable_rls.sql`（推荐，最新修复）
   - 或 `migrations/20240320_add_name_to_user_roles.sql`（如果上面的脚本已执行）
6. 执行SQL查询
7. 确认查询成功执行，没有错误

## 检查迁移结果

执行以下SQL查询来验证name列是否已成功添加且RLS已禁用：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
  AND table_schema = 'public'
  AND column_name IN ('name', 'email');

SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'user_roles';
```

结果应显示：
1. 两行结果，显示name和email列
2. 一行结果，rowsecurity为'f'（表示RLS已禁用）

## 常见问题

### 如果仍然遇到递归错误

有时候修改RLS后仍需要重启Supabase实例，请尝试：
1. 在Supabase项目控制台中，点击"Settings" > "Database"
2. 找到"Restart Database"选项并点击
3. 等待数据库重启完成

### 如果user_roles表不存在

如果user_roles表不存在，请先创建该表：

```sql
CREATE TABLE IF NOT EXISTS public.user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  email TEXT,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 设置权限
GRANT ALL ON public.user_roles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.user_roles_id_seq TO authenticated;
```

### 如果没有权限执行函数创建

如果遇到权限问题，请确保使用管理员账号或服务角色密钥连接到数据库。 