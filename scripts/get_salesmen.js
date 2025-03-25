import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import pkg from '../package.json' assert { type: 'json' };

dotenv.config();

// 检查是否是ES Module
console.log('是否是ES模块:', pkg.type === 'module');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// 打印连接信息（不显示密钥）
console.log('Supabase URL:', supabaseUrl);
console.log('项目引用:', supabaseUrl ? supabaseUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/)?.[1] : '未找到');

const supabase = createClient(supabaseUrl, supabaseKey);

async function getSalesmen() {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, email, fullname, phone')
      .eq('role', 'salesman');
    
    if (error) throw error;
    console.log('业务员列表:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('获取业务员列表失败:', err);
  }
}

await getSalesmen(); 