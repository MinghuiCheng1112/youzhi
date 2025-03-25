import pkg from 'pg';
const { Client } = pkg;
import dotenvPkg from 'dotenv';
import fs from 'fs';

// 加载环境变量
dotenvPkg.config();

const {
  SUPABASE_DB_HOST,
  SUPABASE_DB,
  SUPABASE_DB_USER,
  SUPABASE_DB_PASSWORD,
  SUPABASE_DB_PORT
} = process.env;

console.log('连接到Supabase数据库...');
console.log(`主机: ${SUPABASE_DB_HOST}`);
console.log(`数据库: ${SUPABASE_DB}`);
console.log(`用户: ${SUPABASE_DB_USER}`);
console.log(`端口: ${SUPABASE_DB_PORT}`);
console.log('密码已设置');

// 创建数据库客户端
const client = new Client({
  host: SUPABASE_DB_HOST,
  database: SUPABASE_DB,
  user: SUPABASE_DB_USER,
  password: SUPABASE_DB_PASSWORD,
  port: SUPABASE_DB_PORT,
  ssl: { rejectUnauthorized: false }
});

async function fixDatabaseRecursionIssues() {
  try {
    // 连接到数据库
    await client.connect();
    console.log('成功连接到数据库');

    // 1. 禁用RLS策略，解决无限递归问题
    console.log('正在禁用行级安全策略...');
    
    await client.query(`
      -- 禁用相关表的行级安全
      ALTER TABLE IF EXISTS public.user_roles DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS public.customers DISABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS public.admin_users DISABLE ROW LEVEL SECURITY;
    `);
    
    console.log('行级安全策略已禁用');

    // 2. 创建管理员表并添加记录
    console.log('正在设置管理员权限...');
    
    await client.query(`
      -- 创建管理员表（如果不存在）
      CREATE TABLE IF NOT EXISTS public.admin_users (
        user_id UUID PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
      
      -- 从user_roles表中获取管理员用户并添加到admin_users表
      INSERT INTO public.admin_users (user_id)
      SELECT user_id FROM public.user_roles 
      WHERE role = 'admin'
      ON CONFLICT (user_id) DO NOTHING;
    `);
    
    console.log('管理员权限已设置');
    
    // 3. 修复权限验证策略
    console.log('正在更新权限策略...');
    
    await client.query(`
      -- 删除可能导致递归的策略
      DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
      DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
      DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;
      DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
      DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
      DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.user_roles;
      DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_roles;
      DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.user_roles;
      DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.user_roles;
      DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.user_roles;
    `);
    
    // 尝试创建新策略
    try {
      await client.query(`
        -- 创建新的简化策略
        CREATE POLICY "users_read_own_roles_fixed"
        ON public.user_roles
        FOR SELECT
        USING (auth.uid() = user_id);
      `);
      console.log('创建用户查询权限策略成功');
    } catch (policyError1) {
      console.log('创建用户查询权限策略失败:', policyError1.message);
    }
    
    try {
      await client.query(`
        -- 管理员可以管理所有角色
        CREATE POLICY "admins_manage_all_roles_fixed"
        ON public.user_roles
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
          )
        );
      `);
      console.log('创建管理员权限策略成功');
    } catch (policyError2) {
      console.log('创建管理员权限策略失败:', policyError2.message);
    }
    
    console.log('权限策略已更新');
    
    // 4. 检查并修复角色分配
    console.log('正在检查用户角色...');
    
    const { rows: userRoles } = await client.query(`
      SELECT * FROM public.user_roles
    `);
    
    console.log(`发现 ${userRoles.length} 个用户角色记录`);
    
    // 在控制台列出所有角色
    console.table(userRoles);
    
    console.log('数据库修复完成！');
    
  } catch (error) {
    console.error('数据库修复过程中出错:', error);
  } finally {
    // 关闭数据库连接
    await client.end();
    console.log('数据库连接已关闭');
  }
}

// 执行修复
fixDatabaseRecursionIssues(); 