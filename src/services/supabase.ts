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