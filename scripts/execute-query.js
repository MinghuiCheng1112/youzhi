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

// 要执行的查询
const queries = [
  "SELECT current_database() as database_name",
  "SELECT current_user as current_user",
  "SELECT version() as postgresql_version",
  "SELECT schemaname FROM pg_tables WHERE tablename = 'users' GROUP BY schemaname",
  "SELECT * FROM information_schema.tables WHERE table_schema = 'public' LIMIT 10"
];

async function runQueries() {
  console.log('连接到Supabase数据库并执行查询...');
  
  for (const query of queries) {
    console.log('\n执行查询:', query);
    
    try {
      // 执行查询
      const { data, error } = await supabase.rpc('execute_sql', { sql_query: query });
      
      if (error) {
        console.error('查询错误:', error.message);
      } else if (data && data.length > 0) {
        console.log('查询结果:');
        console.table(data);
      } else {
        console.log('查询完成，无返回数据');
      }
    } catch (err) {
      console.error('执行错误:', err.message);
    }
  }
  
  console.log('\n所有查询执行完毕');
}

runQueries(); 