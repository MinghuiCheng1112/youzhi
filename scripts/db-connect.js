import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

// 加载环境变量
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少Supabase连接信息。请确保.env文件中包含VITE_SUPABASE_URL和VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('已连接到Supabase数据库');
console.log('输入SQL查询或命令，输入"exit"退出');

// 简单的REPL循环
const promptUser = () => {
  rl.question('SQL> ', async (query) => {
    if (query.toLowerCase() === 'exit') {
      console.log('正在断开连接...');
      rl.close();
      return;
    }

    try {
      // 执行查询
      const { data, error } = await supabase.rpc('execute_sql', { sql_query: query });
      
      if (error) {
        console.error('查询错误:', error.message);
      } else {
        console.log('查询结果:');
        console.table(data);
      }
    } catch (err) {
      console.error('执行错误:', err.message);
    }

    promptUser();
  });
};

promptUser(); 