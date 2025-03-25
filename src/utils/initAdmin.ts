import { supabase } from '../services/supabase';

export const initAdmin = async () => {
  // 使用环境变量中的管理员凭据
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
  
  // 检查管理员是否已存在
  const { data } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });
  
  if (!data.user) {
    // 创建管理员账号
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: adminEmail,
      password: adminPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/verify-email`,
        data: {
          role: 'admin',
          is_admin: true
        }
      }
    });
    
    if (error) {
      console.error('创建管理员失败:', error);
      return;
    }
    
    if (signUpData.user) {
      // 确保在user_roles表中添加管理员角色
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: signUpData.user.id,
          role: 'admin'
        });
        
      if (roleError) {
        console.error('设置角色失败:', roleError);
      }
    }
    
    console.log('Admin account created');
    alert('管理员账户已创建，请检查邮箱并点击验证链接');
  }
}; 