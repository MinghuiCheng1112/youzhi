# 数据库连接工具

由于Cursor IDE不能直接通过命令行工具连接到数据库，我们提供了两种脚本来解决这个问题。

## 1. Supabase API连接 (db-connect.js)

这个脚本使用Supabase JavaScript客户端通过API连接到数据库。

### 使用方法:

```bash
node scripts/db-connect.js
```

### 特点:
- 使用您现有的Supabase匿名密钥
- 不需要额外的数据库密码
- 受限于Supabase API权限
- 适合执行基本查询

### 注意事项:
- 此方式依赖于Supabase的RPC函数`execute_sql`，您需要确保此函数已在项目中设置

## 2. 直接PostgreSQL连接 (pg-connect.js)

这个脚本使用PostgreSQL客户端直接连接到Supabase的PostgreSQL数据库。

### 使用方法:

```bash
node scripts/pg-connect.js
```

执行后，脚本会要求您输入PostgreSQL数据库密码。请从Supabase项目设置中获取此密码。

### 特点:
- 直接连接到PostgreSQL数据库
- 完整的SQL权限（取决于您的数据库用户权限）
- 可以执行任何SQL命令
- 更快的查询执行速度

### 获取数据库密码:
1. 登录到Supabase控制台 (https://app.supabase.com)
2. 选择您的项目
3. 转到"设置" > "数据库"
4. 在"连接信息"部分查找数据库密码

## 其他连接选项

除了这些脚本外，您还可以使用以下工具连接到Supabase数据库:

1. **Supabase CLI**
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref 您的项目引用
   supabase db connect
   ```

2. **第三方数据库工具**
   - [DBeaver](https://dbeaver.io/)
   - [pgAdmin](https://www.pgadmin.org/)
   - [TablePlus](https://tableplus.com/)

   使用Supabase项目设置中的连接信息配置这些工具。

3. **Supabase Studio**
   - 通过Supabase控制台直接访问
   - 支持查询编辑器和表格视图 