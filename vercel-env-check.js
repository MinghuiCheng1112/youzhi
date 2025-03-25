import { writeFileSync } from 'fs';

// 创建环境变量日志
console.log('=== Vercel环境变量检查 ===');

// 检查必要的环境变量
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log(`SUPABASE_URL 是否存在: ${!!process.env.SUPABASE_URL}`);
console.log(`VITE_SUPABASE_URL 是否存在: ${!!process.env.VITE_SUPABASE_URL}`);
console.log(`SUPABASE_ANON_KEY 是否存在: ${!!process.env.SUPABASE_ANON_KEY}`);
console.log(`VITE_SUPABASE_ANON_KEY 是否存在: ${!!process.env.VITE_SUPABASE_ANON_KEY}`);

// 使用的URL和Key
console.log(`将使用的Supabase URL: ${supabaseUrl ? '已设置' : '未设置'}`);
console.log(`将使用的Supabase Key: ${supabaseKey ? '已设置' : '未设置'}`);

// 确保Vite可以访问环境变量
if (supabaseUrl) {
  process.env.VITE_SUPABASE_URL = supabaseUrl;
}

if (supabaseKey) {
  process.env.VITE_SUPABASE_ANON_KEY = supabaseKey;
}

// 创建一个临时环境文件，确保Vite可以读取这些变量
try {
  writeFileSync('.env.vercel', `
VITE_SUPABASE_URL=${supabaseUrl || ''}
VITE_SUPABASE_ANON_KEY=${supabaseKey || ''}
VITE_API_BASE=/api/
VITE_DEPLOY_ENV=production
  `);
  console.log('✅ 已创建.env.vercel文件');
} catch (error) {
  console.error('❌ 无法创建环境文件:', error);
}

console.log('=== 环境检查完成 ==='); 