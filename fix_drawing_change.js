import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 初始化Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少Supabase连接信息。请确保.env文件中包含VITE_SUPABASE_URL和VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('使用Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

// 读取SQL文件
const fixDrawingChangeSQL = fs.readFileSync(path.join(__dirname, './fix_drawing_change.sql'), 'utf8');

async function fixDrawingChange() {
  try {
    console.log('执行修复drawing_change字段...');
    console.log('SQL执行内容:', fixDrawingChangeSQL);
    
    // 执行SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: fixDrawingChangeSQL });
    
    if (error) {
      console.error('执行SQL出错:', error);
      return;
    }
    
    console.log('修复drawing_change字段成功。结果:', data);
  } catch (error) {
    console.error('执行修复时出现异常:', error);
  }
}

// 执行修复
fixDrawingChange(); 