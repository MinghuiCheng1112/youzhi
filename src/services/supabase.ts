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
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (url, options) => {
      // 只处理非GET请求
      if (options.method !== 'GET') {
        try {
          // 检查是否为customers表的更新或插入请求
          if (url.includes('/customers') && options.body) {
            const bodyStr = options.body.toString();
            if (bodyStr) {
              // 尝试解析请求体
              let data = JSON.parse(bodyStr);
              let modified = false;

              // 处理module_count字段
              // 如果是数组（批量操作）
              if (Array.isArray(data)) {
                data = data.map(item => {
                  // 处理数字字段
                  const numberFields = ['module_count', 'capacity', 'investment_amount', 'land_area', 'price'];
                  for (const field of numberFields) {
                    if (field in item) {
                      const value = item[field];
                      // 检查空字符串和其他可能导致错误的值
                      if (value === '' || value === undefined || value === null || 
                          (typeof value === 'string' && value.trim() === '') || 
                          (typeof value === 'number' && isNaN(value))) {
                        item[field] = null;
                        console.log(`[拦截器] 将${field}字段的空值转换为null`);
                        modified = true;
                      }
                    }
                  }
                  return item;
                });
              } 
              // 如果是单个对象
              else if (typeof data === 'object') {
                // 处理数字字段
                const numberFields = ['module_count', 'capacity', 'investment_amount', 'land_area', 'price'];
                for (const field of numberFields) {
                  if (field in data) {
                    const value = data[field];
                    // 检查空字符串和其他可能导致错误的值
                    if (value === '' || value === undefined || value === null || 
                        (typeof value === 'string' && value.trim() === '') || 
                        (typeof value === 'number' && isNaN(value))) {
                      data[field] = null;
                      console.log(`[拦截器] 将${field}字段的空值转换为null，原值:`, value);
                      modified = true;
                    }
                  }
                }
              }

              // 如果数据被修改，更新请求体
              if (modified) {
                options.body = JSON.stringify(data);
                console.log(`[拦截器] 修改后的请求数据:`, options.body);
              }
            }
          }
        } catch (error) {
          console.error('[拦截器] 处理请求数据时出错:', error);
          // 出错时继续原始请求，避免阻塞所有操作
        }
      }
      
      // 执行原始fetch请求
      return fetch(url, options);
    }
  }
});

// 也导出一个简单的admin客户端，但使用相同的密钥
export const supabaseAdmin = supabase;

// 修复角色约束函数
export const fixRoleConstraint = async () => {
  try {
    console.log('尝试修复用户角色约束...');
    
    // 执行SQL修改user_roles表的role约束
    const { error } = await supabase.rpc('fix_role_constraint');
    
    if (error) {
      console.error('修复角色约束失败:', error);
      throw error;
    }
    
    console.log('角色约束修复成功!');
    return true;
  } catch (error) {
    console.error('修复角色约束发生异常:', error);
    throw error;
  }
};

// 创建存储过程
export const createFixRoleConstraintFunction = async () => {
  try {
    // 创建修复角色约束的存储过程
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION fix_role_constraint()
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          -- 删除旧约束
          ALTER TABLE IF EXISTS user_roles 
          DROP CONSTRAINT IF EXISTS user_roles_role_check;
          
          -- 添加新约束，包含pending角色
          ALTER TABLE IF EXISTS user_roles 
          ADD CONSTRAINT user_roles_role_check 
          CHECK (role IN ('admin', 'filing_officer', 'salesman', 'warehouse', 'construction_team', 'grid_connector', 'surveyor', 'dispatch', 'procurement', 'pending'));
          
          -- 检查email, name, phone列是否存在，如果不存在则添加
          BEGIN
            ALTER TABLE IF EXISTS user_roles ADD COLUMN IF NOT EXISTS email TEXT;
            ALTER TABLE IF EXISTS user_roles ADD COLUMN IF NOT EXISTS name TEXT;
            ALTER TABLE IF EXISTS user_roles ADD COLUMN IF NOT EXISTS phone TEXT;
          EXCEPTION WHEN duplicate_column THEN
            -- 列已存在，忽略异常
          END;
          
          RETURN true;
        END;
        $$;
      `
    });
    
    if (error) {
      console.error('创建修复角色约束函数失败:', error);
      throw error;
    }
    
    console.log('创建修复角色约束函数成功!');
    return true;
  } catch (error) {
    console.error('创建修复角色约束函数出错:', error);
    throw error;
  }
};

// 初始化完成后自动尝试修复约束
fixRoleConstraint();

console.log('Supabase客户端初始化完成'); 