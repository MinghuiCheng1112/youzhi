# 客户管理系统

基于React、TypeScript、Ant Design和Supabase的客户管理系统。

## 功能特性

- 客户信息管理（添加、编辑、删除）
- 出库管理（方钢出库和组件出库）
- 用户认证和角色权限控制
- 响应式界面设计

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
 #   y o u z h i  
 #   y o u z h i  
 #   y o u z h i  
 #   y o u z h i  
 #   y o u z h i  
 #   y o u z h i  
 #   y o u z h i  
 #   y o u z h i  
 