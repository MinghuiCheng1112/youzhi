import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// 添加必要的环境变量
process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 配置NODE_OPTIONS以增加内存限制
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// 运行构建
console.log('🚀 开始Vercel构建...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ 构建成功完成');
} catch (error) {
  console.error('❌ 构建失败:', error);
  process.exit(1);
} 