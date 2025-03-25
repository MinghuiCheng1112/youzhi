# 客户管理系统部署指南

本文档提供将客户管理系统部署到生产环境的详细步骤。

## 前置条件

- Node.js 18+ 和 npm 9+
- 已配置好的Supabase项目
- 用于部署的服务器或云平台（如Vercel、Netlify、阿里云等）

## 环境变量配置

在生产环境中，您需要配置以下环境变量：

```
VITE_SUPABASE_URL=您的Supabase项目URL
VITE_SUPABASE_ANON_KEY=您的Supabase匿名密钥
VITE_ADMIN_EMAIL=管理员邮箱
VITE_ADMIN_PASSWORD=管理员密码
```

## 构建步骤

1. 安装依赖：
   ```bash
   npm install
   ```

2. 构建生产版本：
   ```bash
   npm run build
   ```
   构建完成后，生产文件将位于`dist`目录中。

## 部署选项

### 选项1：使用Vercel部署（推荐）

1. 安装Vercel CLI：
   ```bash
   npm install -g vercel
   ```

2. 登录Vercel：
   ```bash
   vercel login
   ```

3. 部署项目：
   ```bash
   vercel
   ```
   按照提示操作，确保设置环境变量。

### 选项2：使用Netlify部署

1. 安装Netlify CLI：
   ```bash
   npm install -g netlify-cli
   ```

2. 登录Netlify：
   ```bash
   netlify login
   ```

3. 部署项目：
   ```bash
   netlify deploy
   ```

### 选项3：使用传统服务器部署

1. 将`dist`目录中的文件上传到您的Web服务器。

2. 配置Web服务器（如Nginx）以提供静态文件并将所有路由重定向到`index.html`：

   Nginx配置示例：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /path/to/dist;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

## Supabase配置

确保在Supabase项目中：

1. 已启用电子邮件认证
2. 已配置正确的安全规则
3. 已设置适当的数据库触发器和函数

## 部署后检查

部署完成后，请检查：

1. 登录功能是否正常
2. 数据库连接是否成功
3. 所有功能是否按预期工作

## 故障排除

- 如果遇到API连接问题，请检查环境变量是否正确配置
- 如果遇到路由问题，请确保服务器配置正确处理SPA路由
- 如果管理员账户初始化失败，请手动在Supabase中创建管理员用户

## 更新部署

当需要更新应用时，重复构建步骤并重新部署即可。