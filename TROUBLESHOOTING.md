# 问题排查指南

## 启动界面异常

### 问题：Failed to resolve import "react-query" from "src/main.tsx"

原因：`package.json`中删除了`react-query`依赖，但代码中仍在使用。

解决方法：
1. 修改`src/main.tsx`文件，移除`react-query`相关的导入和使用
2. 重启开发服务器

### 问题：数据库连接错误

原因：Supabase配置不正确或服务未启动。

解决方法：
1. 确认`.env`文件中的`VITE_SUPABASE_URL`和`VITE_SUPABASE_ANON_KEY`设置正确
2. 确认Supabase项目已创建并正常运行
3. 在Supabase控制台中执行SQL迁移脚本创建所需的表

### 问题：认证服务错误

原因：缺少必要的数据库表或权限设置。

解决方法：
1. 确保执行了`supabase/migrations`目录下的所有SQL脚本
2. 在Supabase控制台启用身份验证服务
3. 配置正确的RLS（行级安全）策略

## Supabase设置步骤

1. 注册/登录Supabase：https://supabase.com
2. 创建新项目
3. 在SQL编辑器中执行以下脚本：
   - `20240320000000_create_customers_table.sql`
   - `20240321000000_create_roles_table.sql`
4. 在"身份验证"设置中启用邮箱登录
5. 复制项目URL和匿名密钥到`.env`文件

## 管理员账号设置

确保`.env`文件中设置了管理员邮箱和密码：

```
VITE_ADMIN_EMAIL=your_admin_email@example.com
VITE_ADMIN_PASSWORD=your_admin_password
```

首次登录时，系统会自动创建管理员角色并分配给该邮箱账户。 