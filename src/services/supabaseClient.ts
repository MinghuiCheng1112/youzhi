import { createClient } from '@supabase/supabase-js'

// 从环境变量中获取 Supabase URL 和 API 密钥
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY

// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string) 