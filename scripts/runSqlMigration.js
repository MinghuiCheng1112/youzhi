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
const dropPoliciesSQL = fs.readFileSync(path.join(__dirname, './pg_policy_drop.sql'), 'utf8');
const alterTableSQL = fs.readFileSync(path.join(__dirname, './alter_drawing_change.sql'), 'utf8');

async function runSQLMigration() {
  try {
    console.log('执行SQL迁移...');
    
    // 第一步：删除策略
    console.log('步骤1: 删除所有RLS策略');
    const { data: dropData, error: dropError } = await supabase.rpc('exec_sql', { sql_query: dropPoliciesSQL });
    
    if (dropError) {
      console.error('删除策略出错:', dropError);
      return;
    }
    
    console.log('策略删除结果:', dropData);
    
    // 第二步：修改表结构
    console.log('步骤2: 修改表结构');
    const { data: alterData, error: alterError } = await supabase.rpc('exec_sql', { sql_query: alterTableSQL });
    
    if (alterError) {
      console.error('修改表结构出错:', alterError);
      return;
    }
    
    console.log('表结构修改结果:', alterData);
    
    console.log('SQL迁移成功执行');
  } catch (error) {
    console.error('执行SQL迁移时出现异常:', error);
  }
}

// 执行迁移
runSQLMigration(); 