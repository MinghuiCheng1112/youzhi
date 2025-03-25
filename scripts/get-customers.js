import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少Supabase连接信息。请确保.env文件中包含VITE_SUPABASE_URL和VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

async function getCustomers() {
  console.log('连接到Supabase数据库并获取customers数据...');
  
  try {
    // 先获取表结构
    console.log('\n尝试获取customers表的列信息:');
    
    const { data: customerColumns, error: columnsError } = await supabase
      .from('customers')
      .select('*')
      .limit(1);
    
    if (columnsError) {
      console.error('获取customers表列信息错误:', columnsError.message);
      
      // 尝试使用特定列名查询
      console.log('\n尝试使用特定列名查询customers表:');
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .limit(10);
      
      if (error) {
        console.error('查询customers表错误:', error.message);
      } else if (data && data.length > 0) {
        console.log('customers表数据:');
        console.table(data);
      } else {
        console.log('没有找到customers数据');
      }
    } else if (customerColumns) {
      // 显示表结构
      if (customerColumns.length > 0) {
        console.log('customers表的列:');
        console.log(Object.keys(customerColumns[0]));
        
        // 使用正确的列名查询
        console.log('\n获取所有customers数据:');
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .limit(10);
        
        if (error) {
          console.error('查询customers表错误:', error.message);
        } else if (data && data.length > 0) {
          console.log('customers表数据:');
          console.table(data);
        } else {
          console.log('没有找到customers数据');
        }
      } else {
        console.log('customers表存在但没有数据');
      }
    }
  } catch (err) {
    console.error('执行错误:', err.message);
  }
  
  console.log('\n操作执行完毕');
}

getCustomers(); 