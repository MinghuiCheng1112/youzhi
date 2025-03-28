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