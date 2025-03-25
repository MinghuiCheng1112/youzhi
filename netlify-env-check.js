// netlify-env-check.js
import { writeFileSync } from 'fs';

// 打印环境信息
console.log('=== Netlify环境变量检查 ===');

// 获取环境变量
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// 检查环境变量状态
console.log(`VITE_SUPABASE_URL 是否存在: ${!!process.env.VITE_SUPABASE_URL}`);
console.log(`SUPABASE_URL 是否存在: ${!!process.env.SUPABASE_URL}`);
console.log(`VITE_SUPABASE_ANON_KEY 是否存在: ${!!process.env.VITE_SUPABASE_ANON_KEY}`);
console.log(`SUPABASE_ANON_KEY 是否存在: ${!!process.env.SUPABASE_ANON_KEY}`);

// 确保React应用能访问环境变量
try {
  writeFileSync('./netlify-env.js', `
// 这个文件由netlify-env-check.js生成
window.ENV = {
  VITE_SUPABASE_URL: "${supabaseUrl || ''}",
  VITE_SUPABASE_ANON_KEY: "${supabaseKey || ''}",
  VITE_DEPLOY_ENV: "production"
};
`);
  console.log('✅ 已创建netlify-env.js文件');
} catch (error) {
  console.error('❌ 创建环境变量文件失败:', error);
}

console.log('=== 环境检查完成 ==='); 