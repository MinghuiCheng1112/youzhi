import { supabase } from '../lib/supabaseClient';

// 检查数据库结构，确保必要的表存在
export const checkDatabaseStructure = async () => {
  console.log('开始检查数据库结构...');
  
  try {
    // 检查user_roles表是否存在
    const { data: tableInfo, error: tableError } = await supabase
      .from('user_roles')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    
    if (tableError) {
      console.error('检查user_roles表失败:', tableError);
      
      // 如果表不存在，尝试创建
      if (tableError.code === 'PGRST116' || tableError.code === '42P01') {
        console.log('user_roles表不存在，尝试创建...');
        await createUserRolesTable();
      }
    } else {
      console.log('user_roles表已存在');
    }
    
    // 检查admin_users表是否存在
    const { error: adminTableError } = await supabase
      .from('admin_users')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    
    if (adminTableError) {
      console.error('检查admin_users表失败:', adminTableError);
      
      // 如果表不存在，提示创建
      if (adminTableError.code === 'PGRST116' || adminTableError.code === '42P01') {
        console.log('admin_users表不存在，请创建...');
        await createAdminUsersTable();
      }
    } else {
      console.log('admin_users表已存在');
    }
    
  } catch (error) {
    console.error('检查数据库结构时出错:', error);
  }
};

// 创建user_roles表
const createUserRolesTable = async () => {
  try {
    // 注意：Supabase客户端不支持直接创建表，需要通过管理API或SQL函数调用
    // 这里我们检查表存在性，如果不存在，提醒用户创建
    
    console.error('需要在Supabase控制台创建user_roles表，表结构如下:');
    console.error(`
    -- 创建user_roles表
    CREATE TABLE IF NOT EXISTS public.user_roles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES auth.users(id),
      role TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
    
    -- 不使用行级安全策略，避免递归问题
    `);
    
    // 实际应用中，这里可以触发一个通知或发送邮件给管理员
  } catch (error) {
    console.error('创建user_roles表失败:', error);
  }
};

// 创建admin_users表
const createAdminUsersTable = async () => {
  try {
    console.error('需要在Supabase控制台创建admin_users表，表结构如下:');
    console.error(`
    -- 创建管理员用户标识表
    CREATE TABLE IF NOT EXISTS public.admin_users (
      user_id UUID PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    -- 不使用行级安全策略，避免递归问题
    `);
  } catch (error) {
    console.error('创建admin_users表失败:', error);
  }
};

// 修复特定用户的角色
export const fixUserRole = async (userId: string, role: string) => {
  try {
    console.log(`尝试修复用户 ${userId} 的角色为 ${role}...`);
    
    // 更新用户元数据
    const { error: updateError } = await supabase.auth.updateUser({
      data: { role }
    });
    
    if (updateError) {
      console.error('更新用户元数据失败:', updateError);
      return false;
    }
    
    // 保存到user_roles表
    const { error: insertError } = await supabase.from('user_roles').upsert({
      user_id: userId,
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    if (insertError) {
      console.error('保存角色到user_roles表失败:', insertError);
      return false;
    }
    
    // 如果是管理员角色，添加到admin_users表
    if (role === 'admin') {
      const { error: adminInsertError } = await supabase.from('admin_users').upsert({
        user_id: userId
      });
      
      if (adminInsertError) {
        console.error('添加到admin_users表失败:', adminInsertError);
        // 继续处理，这不是致命错误
      }
    }
    
    console.log(`成功修复用户 ${userId} 的角色`);
    return true;
  } catch (error) {
    console.error('修复用户角色失败:', error);
    return false;
  }
};

// 检查admin用户是否存在
export const checkAdminUser = async () => {
  try {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
    
    if (!adminEmail) {
      console.error('管理员邮箱未设置，请在.env文件中设置VITE_ADMIN_EMAIL');
      return false;
    }
    
    // 使用auth.getUser而不是admin.listUsers，避免权限问题
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('获取当前用户失败:', userError);
      return false;
    }
    
    // 如果当前登录用户不是管理员邮箱，提示用户登录管理员账户
    if (userData?.user?.email !== adminEmail) {
      console.log(`当前用户不是管理员，请使用${adminEmail}登录`);
      return false;
    }
    
    const adminUser = userData.user;
    
    // 检查user_roles表中是否有管理员角色
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUser.id)
      .single();
    
    if (roleError && roleError.code !== 'PGRST116') {
      console.error('检查管理员角色失败:', roleError);
    }
    
    // 同时检查admin_users表
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', adminUser.id)
      .single();
    
    if (adminError && adminError.code !== 'PGRST116') {
      console.error('检查admin_users表失败:', adminError);
    }
    
    if ((!roleData?.role || roleData.role !== 'admin') || !adminData) {
      console.log('管理员用户角色不正确，尝试修复...');
      return await fixUserRole(adminUser.id, 'admin');
    }
    
    console.log('管理员用户已存在并且角色正确');
    return true;
  } catch (error) {
    console.error('检查管理员用户失败:', error);
    return false;
  }
};

// 导出默认函数，用于在应用启动时调用
export default async function ensureDatabaseStructure() {
  await checkDatabaseStructure();
  // 不需要等待管理员检查完成
  checkAdminUser().catch(err => console.error('检查管理员用户出错:', err));
} 