# 客户管理系统

基于React、TypeScript、Ant Design和Supabase的客户管理系统。

## 功能特性

- 客户信息管理（添加、编辑、删除）
- 出库管理（方钢出库和组件出库）
- 用户认证和角色权限控制
- 响应式界面设计

## 客户工作台自动计算字段同步

系统已实现自动计算并同步以下客户字段:

- 容量: 组件数量 * 0.71KW
- 投资金额: 组件数量 * 0.71 * 0.25
- 用地面积: 组件数量 * 3.106m²
- 逆变器: 根据组件数量自动选择型号
- 配电箱: 根据逆变器型号自动选择规格
- 铜线: 根据逆变器型号自动选择规格
- 铝线: 根据逆变器型号自动选择规格

### 自动同步机制

系统通过两种方式实现自动同步:

1. **数据库触发器**: 当`module_count`(组件数量)字段更新时，数据库会自动计算并更新相关字段
2. **脚本同步**: 可以使用以下命令手动同步缺失的计算字段
   ```
   node scripts/sync-calculated-fields.js --sync    # 同步已有记录的计算字段
   node scripts/sync-calculated-fields.js --trigger # 创建/更新数据库触发器
   ```

## 安装步骤

1. 克隆代码库

```bash
git clone <repository_url>
cd customer-management-system
```

2. 安装依赖

```bash
npm install
```

3. 设置环境变量

在项目根目录创建`.env`文件，并填入以下内容：

```
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
VITE_ADMIN_EMAIL=管理员邮箱
VITE_ADMIN_PASSWORD=管理员密码
```

4. Supabase设置

- 创建Supabase账号并创建新项目
- 在SQL编辑器中运行`supabase/migrations`目录下的SQL脚本
- 启用Supabase身份验证服务

5. 启动开发服务器

```bash
npm run dev
```

## 使用方法

1. 访问系统（默认为 http://localhost:5173）
2. 使用管理员账号登录
3. 添加客户信息
4. 管理出库状态
5. 查看客户列表

## 部署方法

构建生产版本：

```bash
npm run build
```

生成的文件将位于`dist`目录中，可以部署到任何静态服务器。

## 技术栈

- React 18
- TypeScript
- Vite
- Ant Design 5
- Supabase（身份验证、数据库）
- dayjs（日期处理）

## 问题排查

如果遇到连接数据库问题：

1. 确认环境变量设置正确
2. 确认Supabase项目活跃且未暂停
3. 确认SQL迁移脚本已执行
4. 检查控制台错误信息#   y o u z h i 
 
 #   y o u z h i 
 
 #   y o u z h i 
 
 #   y o u z h i 
 
 #   y o u z h i 
 
 #   y o u z h i 
 
 #   y o u z h i 
 
 #   y o u z h i 
 
 #   y o u z h i 
 
 

## 数据库连接

系统使用Supabase作为后端数据库服务。有两种方式连接和管理数据库：

### 1. 通过Supabase API (推荐用于应用开发)

系统使用Supabase JavaScript客户端通过API连接数据库。这种方法遵循行级安全策略(RLS)并使用Supabase的身份验证系统。

相关配置文件：
- `src/services/supabase.ts` - 主要Supabase客户端配置
- `src/services/supabaseClient.ts` - 简化的客户端配置

### 2. 通过直接PostgreSQL连接 (用于调试和数据库管理)

为了便于开发和调试，系统提供了几个直接连接PostgreSQL数据库的实用工具脚本：

- `scripts/supabase-cursor-connect.js` - 测试数据库连接
- `scripts/run-query.js` - 交互式SQL查询
- `scripts/view-db-structure.mjs` - 查看数据库详细结构

使用说明请参阅：`scripts/database/README.md`

### 环境变量配置

数据库连接需要在`.env`文件中配置以下环境变量：

```
# Supabase API连接
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 直接PostgreSQL连接
SUPABASE_DB_HOST=db.your-project-ref.supabase.co
SUPABASE_DB=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-database-password
SUPABASE_DB_PORT=5432
```

注意：PostgreSQL密码可以在Supabase项目设置的数据库部分找到。

## 建设验收功能更新

建设验收功能已经进行了重构和简化：

1. 移除了复杂的状态管理，现在只使用 `construction_acceptance_date` 字段来表示建设验收状态
2. 删除了废弃的字段：
   - `construction_acceptance_status`
   - `construction_acceptance_notes`
   - `construction_acceptance_waiting_days`
   - `construction_acceptance_waiting_start`
   - `construction_acceptance`（旧字段）

### 数据迁移

如果需要迁移数据库，请运行以下命令：

```bash
# 在PostgreSQL命令行中执行
\i scripts/remove_deprecated_construction_acceptance_fields.sql
```

此脚本将：
1. 删除所有废弃的建设验收相关字段
2. 保留 `construction_acceptance_date` 字段用于存储时间戳
3. 同步更新 `deleted_records` 表