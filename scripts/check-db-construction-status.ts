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
    console.log('正在查询 customers 表...');
    const { data, error } = await supabase
      .from('customers')
      .select('id, construction_status')
      .limit(20);
    
    if (error) {
      console.error('查询出错:', error);
      return;
    }
    
    console.log('查询结果:');
    data.forEach(record => {
      console.log(`ID: ${record.id}, 施工状态: ${record.construction_status}, 类型: ${typeof record.construction_status}`);
    });
    
    // 检查无效日期
    console.log('\n检查无效日期:');
    data.forEach(record => {
      if (record.construction_status) {
        const date = new Date(record.construction_status);
        console.log(`ID: ${record.id}, 日期有效性: ${!isNaN(date.getTime())}, 原始值: ${record.construction_status}`);
      }
    });
  } catch (error) {
    console.error('执行出错:', error);
  }
}

main(); 