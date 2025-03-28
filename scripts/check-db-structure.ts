import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase 配置缺失');
  process.exit(1);
}

console.log('使用Supabase URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  try {
    console.log('正在查询 customers 表结构...');
    
    // 使用系统视图查询表结构
    const { data, error } = await supabase.rpc('get_table_info', { table_name: 'customers' });
    
    if (error) {
      console.error('查询表结构出错:', error);
      
      // 备用方法：直接查询一条记录以确定字段
      console.log('尝试直接查询记录...');
      const { data: sampleData, error: sampleError } = await supabase
        .from('customers')
        .select('*')
        .limit(1);
        
      if (sampleError) {
        console.error('查询记录出错:', sampleError);
        return;
      }
      
      if (sampleData && sampleData.length > 0) {
        console.log('表字段:');
        const fields = Object.keys(sampleData[0]);
        fields.forEach(field => {
          console.log(`- ${field}: ${typeof sampleData[0][field]}`);
        });
      }
      
      return;
    }
    
    console.log('表结构信息:', data);
  } catch (error) {
    console.error('执行出错:', error);
  }
}

main(); 