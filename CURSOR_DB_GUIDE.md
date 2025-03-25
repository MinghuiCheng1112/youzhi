# Cursor与Supabase数据库连接指南

本指南将帮助您在Cursor IDE中连接和使用Supabase PostgreSQL数据库。

## 快速开始

我们已经创建了两个脚本来帮助您连接到Supabase PostgreSQL数据库：

1. **cursor-connect.js** - 测试数据库连接并显示基本信息
2. **cursor-query.js** - 提供交互式SQL查询界面

### 测试连接

运行以下命令测试数据库连接：

```bash
node scripts/cursor-connect.js
```

这将显示数据库连接信息和可用的表。

### 执行SQL查询

运行以下命令打开交互式SQL查询界面：

```bash
node scripts/cursor-query.js
```

在提示符后输入SQL查询，输入`exit`退出。

## 配置说明

这两个脚本已经配置为使用以下信息连接到您的Supabase数据库：

- **数据库URL**: 从`.env`文件中的`VITE_SUPABASE_URL`环境变量获取
- **数据库密码**: `CK50QOdXXutc4IO3`（在脚本中已经配置）

如果您需要更改数据库密码，请编辑`scripts/cursor-connect.js`和`scripts/cursor-query.js`文件中的`SUPABASE_PASSWORD`变量。

## 在Cursor中执行常见数据库操作

### 查询表中的数据

```sql
SELECT * FROM customers LIMIT 10;
```

### 插入数据

```sql
INSERT INTO customers (name, phone, address) 
VALUES ('测试客户', '13800138000', '测试地址');
```

### 更新数据

```sql
UPDATE customers 
SET phone = '13900139000' 
WHERE name = '测试客户';
```

### 删除数据

```sql
DELETE FROM customers 
WHERE name = '测试客户';
```

## 导出数据到CSV文件

您可以通过以下步骤将查询结果导出为CSV文件：

1. 执行您的查询并复制结果
2. 将结果粘贴到Cursor中的新文件
3. 保存为`.csv`文件

## 数据库表结构

您的Supabase数据库包含以下主要表：

- `customers` - 客户信息
- `draw_records` - 提货记录
- `modification_records` - 修改记录
- `user_roles` - 用户角色
- `salesman_relationships` - 业务员关系
- `admin_users` - 管理员用户
- `view_salesman_subordinates` - 业务员下级视图

## 故障排除

### 连接问题

如果您遇到连接问题，请检查：

1. `.env`文件中的`VITE_SUPABASE_URL`是否正确
2. 数据库密码是否正确
3. 您的网络连接是否允许外部数据库连接

### 查询错误

如果您的查询返回错误，请检查：

1. SQL语法是否正确
2. 表名和列名是否正确
3. 您是否有执行该操作的权限

## 进一步开发

您可以根据需要修改这些脚本，添加更多功能，如：

1. 保存查询历史
2. 导出查询结果到文件
3. 创建预设查询模板
4. 添加表结构可视化

## 联系支持

如果您需要进一步的帮助，请联系系统管理员或Supabase支持团队。 