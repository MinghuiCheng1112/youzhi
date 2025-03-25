import { createClient } from '@supabase/supabase-js';

// 获取环境变量
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 简单检查环境变量
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL或匿名密钥缺失。请检查环境变量配置。');
}

// 创建基本客户端，不添加任何复杂配置
export const supabase = createClient(supabaseUrl, supabaseAnonKey); 