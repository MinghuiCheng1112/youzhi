# 数据库连接脚本使用说明

这个目录包含了用于连接和操作Supabase PostgreSQL数据库的实用工具脚本。这些脚本可以帮助您在Cursor环境中直接与数据库交互，执行查询，查看表结构，以及执行其他数据库操作。

## 环境设置

所有脚本都依赖于项目根目录中的`.env`文件中的环境变量。请确保您的`.env`文件包含以下变量：

```
SUPABASE_DB_HOST=db.rkkkicdabwqtjzsoaxty.supabase.co
SUPABASE_DB=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=你的数据库密码
SUPABASE_DB_PORT=5432
```

## 可用脚本

### 1. supabase-cursor-connect.js

这个脚本用于测试与Supabase数据库的连接，并显示数据库的基本信息，包括表列表、列数、视图和行级安全策略。

**使用方法：**
```bash
node scripts/supabase-cursor-connect.js
```

### 2. run-query.js

这个脚本提供了一个交互式SQL查询界面，允许您执行SQL命令并查看结果。

**使用方法：**
```bash
node scripts/run-query.js
```

**特殊命令：**
- `tables` - 显示所有可用的表
- `views` - 显示所有可用的视图
- `describe [表名]` 或 `desc [表名]` - 显示指定表的结构
- `exit` - 退出查询界面

### 3. view-db-structure.mjs

这个脚本显示数据库的详细结构，包括所有表的完整定义，列信息，主键，外键，索引，视图定义等。

**使用方法：**
```bash
node scripts/view-db-structure.mjs
```

## 示例

### 查询客户表

```bash
node scripts/run-query.js
```

然后在SQL提示符中输入：
```sql
SELECT * FROM customers LIMIT 10;
```

### 查看表结构

```bash
node scripts/run-query.js
```

然后在SQL提示符中输入：
```
describe customers
```

## 删除旧的脚本

以下旧的连接脚本已被删除并由上述新脚本替代：
- cursor-connect.js
- pg-connect.js
- db-connect.js
- db-connect-simple.js

## 注意事项

这些脚本直接连接到Supabase的PostgreSQL数据库，绕过了Supabase的API和行级安全策略。因此，这些工具应该只用于开发和调试目的，不应在生产环境中使用。

# 数据库触发器脚本使用说明

本目录包含用于增强数据库功能的触发器和函数脚本。

## auto_update_drawing_change.sql

此脚本实现了一个自动更新图纸变更状态的触发器，具体功能:

- 当组件数量(module_count)字段有值(大于0)时，自动将图纸变更(drawing_change)字段设置为"已出图"
- 仅在drawing_change字段为"未出图"或null时进行更新，保留其他已存在的值
- 会自动更新数据库中现有的记录

### 应用方法

#### 本地开发环境

如果使用Supabase本地开发:

```bash
# 切换到项目根目录
cd /path/to/customer-management-system

# 使用psql执行SQL脚本
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -f scripts/database/auto_update_drawing_change.sql
```

#### 生产环境

1. 使用Supabase控制台:

   - 登录Supabase控制台 (https://app.supabase.com)
   - 选择项目
   - 点击"SQL编辑器"
   - 复制`auto_update_drawing_change.sql`文件内容
   - 粘贴到SQL编辑器并执行

2. 使用Supabase CLI:

   ```bash
   # 确保已安装并配置Supabase CLI
   supabase login
   
   # 链接到您的项目
   supabase link --project-ref your-project-ref
   
   # 执行SQL脚本
   supabase db execute --file=scripts/database/auto_update_drawing_change.sql
   ```

3. 直接连接到数据库:

   ```bash
   # 使用PostgreSQL客户端连接
   psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f scripts/database/auto_update_drawing_change.sql
   ```

### 验证触发器是否生效

执行以下SQL命令验证触发器是否已正确安装:

```sql
-- 检查触发器是否存在
SELECT tgname FROM pg_trigger WHERE tgname = 'auto_update_drawing_change_trigger';

-- 测试触发器功能
BEGIN;
-- 创建测试记录
INSERT INTO customers (register_date, customer_name, phone, address, id_card, salesman, module_count, drawing_change)
VALUES (NOW(), '测试客户', '13800138000', '测试地址', '110101199001010000', '测试业务员', 0, '未出图');

-- 获取新增记录ID
SELECT id, drawing_change FROM customers WHERE customer_name = '测试客户' ORDER BY created_at DESC LIMIT 1;

-- 更新组件数量，应该自动更新图纸变更状态
UPDATE customers SET module_count = 10 WHERE customer_name = '测试客户' AND created_at = (SELECT MAX(created_at) FROM customers WHERE customer_name = '测试客户');

-- 查看更新后的状态
SELECT id, module_count, drawing_change FROM customers WHERE customer_name = '测试客户' ORDER BY created_at DESC LIMIT 1;

-- 回滚事务，不保存测试数据
ROLLBACK;
``` 