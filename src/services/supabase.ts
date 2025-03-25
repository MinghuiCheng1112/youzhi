import { createClient } from '@supabase/supabase-js';

// 简单直接地获取环境变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 日志输出配置信息，帮助调试
console.log('初始化Supabase客户端:', { 
  url: supabaseUrl,
  keyLength: supabaseAnonKey?.length || 0
});

// 使用最简单的方式创建客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 也导出一个简单的admin客户端，但使用相同的密钥
export const supabaseAdmin = supabase;

// 在初始化完成后修复user_roles表的角色约束
export const fixRoleConstraint = async () => {
  try {
    // 1. 检查user_roles表中的角色约束
    const { data: constraintData, error: constraintError } = await supabase
      .rpc('get_role_constraint_values');
    
    if (constraintError) {
      console.error('获取角色约束失败:', constraintError);
      return;
    }
    
    console.log('当前角色约束:', constraintData);
    
    // 2. 如果约束中不包含surveyor角色，修复约束
    if (constraintData && (!Array.isArray(constraintData) || !constraintData.includes('surveyor'))) {
      console.log('需要更新角色约束以包含"surveyor"');
      
      // 使用RPC调用修复约束
      const { error: fixError } = await supabase
        .rpc('update_role_constraint', { 
          new_values: ['admin', 'filing_officer', 'salesman', 'warehouse', 
                       'construction_team', 'grid_connector', 'surveyor', 
                       'dispatch', 'procurement'] 
        });
      
      if (fixError) {
        console.error('修复角色约束失败:', fixError);
      } else {
        console.log('角色约束已更新，现在包含"surveyor"角色');
      }
    } else {
      console.log('角色约束检查正常，包含所有必要角色');
    }
  } catch (error) {
    console.error('修复角色约束时出错:', error);
  }
};

// 初始化完成后自动尝试修复约束
fixRoleConstraint();

console.log('Supabase客户端初始化完成'); 