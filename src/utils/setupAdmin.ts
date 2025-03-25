import { supabase } from '../lib/supabaseClient'

export const setupAdmin = async () => {
  try {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
    
    // 1. 检查roles表中是否已有admin角色
    const { data: existingRole } = await supabase
      .from('roles')
      .select('*')
      .eq('name', 'admin')
      .single()
    
    // 如果没有admin角色，创建一个
    if (!existingRole) {
      const { data: _newRole, error: roleError } = await supabase
        .from('roles')
        .insert({
          name: 'admin',
          description: '系统管理员，拥有所有权限',
          permissions: [
            'customers:read', 'customers:write', 'customers:delete',
            'records:read', 'records:write',
            'warehouse:manage', 'construction:manage', 'dispatch:manage',
            'admin:manage'
          ]
        })
        .select()
        .single()
      
      if (roleError) throw roleError
    }
    
    // 2. 获取用户
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user && user.email === adminEmail) {
      // 3. 更新用户元数据
      await supabase.auth.updateUser({
        data: { role: 'admin' }
      })
      
      // 4. 检查user_roles表
      const { data: existingUserRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      // 如果没有记录，添加一个
      if (!existingUserRole) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'admin')
          .single()
        
        if (roleData) {
          await supabase
            .from('user_roles')
            .insert({
              user_id: user.id,
              role: 'admin',
              role_id: roleData.id
            })
        }
      }
    }
  } catch (error) {
    console.error('设置管理员失败:', error)
  }
} 