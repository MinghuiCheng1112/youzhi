import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey.substring(0, 10) + '...');

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少Supabase连接信息。请确保.env文件中包含VITE_SUPABASE_URL和VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  console.log('连接到Supabase数据库并获取数据...');
  
  // 尝试获取auth.users表数据
  try {
    console.log('\n获取用户数据:');
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('*')
      .limit(5);
    
    if (usersError) {
      console.error('获取用户数据错误:', usersError.message);
    } else if (users && users.length > 0) {
      console.log('用户数据:');
      console.table(users);
    } else {
      console.log('没有找到用户数据或无权限访问');
    }
  } catch (err) {
    console.error('执行错误:', err.message);
  }
  
  // 尝试从公共表获取数据
  try {
    console.log('\n尝试从公共模式获取表:');
    // 列出所有可用的表
    const { data: tables, error: tablesError } = await supabase
      .from('_tables')
      .select('*')
      .limit(10);
    
    if (tablesError) {
      console.error('获取表列表错误:', tablesError.message);
      console.log('尝试从其他表获取数据...');
      
      // 如果_tables不可用，尝试一些常见的表名
      const commonTables = ['users', 'profiles', 'customers', 'products', 'orders'];
      
      for (const table of commonTables) {
        console.log(`\n尝试从表 ${table} 获取数据:`);
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(5);
        
        if (error) {
          console.error(`获取 ${table} 数据错误:`, error.message);
        } else if (data && data.length > 0) {
          console.log(`${table} 数据:`);
          console.table(data);
        } else {
          console.log(`没有在 ${table} 中找到数据或表不存在`);
        }
      }
    } else if (tables && tables.length > 0) {
      console.log('可用表:');
      console.table(tables);
    } else {
      console.log('没有找到表信息或无权限访问');
    }
  } catch (err) {
    console.error('执行错误:', err.message);
  }
  
  console.log('\n所有操作执行完毕');
}

listTables(); 