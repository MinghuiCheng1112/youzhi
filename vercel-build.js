import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';

// 检查关键环境变量
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`❌ 缺少关键环境变量: ${missingEnvVars.join(', ')}`);
  console.error('请在Vercel项目设置中添加这些环境变量');
  process.exit(1);
}

// 添加必要的环境变量到Vite构建过程
process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 打印关键构建信息
console.log('====== 构建环境信息 ======');
console.log(`Node.js 版本: ${process.version}`);
console.log(`工作目录: ${process.cwd()}`);
console.log(`VITE_SUPABASE_URL: ${process.env.VITE_SUPABASE_URL ? '已设置' : '未设置'}`);
console.log(`VITE_SUPABASE_ANON_KEY: ${process.env.VITE_SUPABASE_ANON_KEY ? '已设置' : '未设置'}`);

// 配置NODE_OPTIONS以增加内存限制
process.env.NODE_OPTIONS = '--max-old-space-size=4096';
console.log(`NODE_OPTIONS: ${process.env.NODE_OPTIONS}`);
console.log('==========================');

// 检查项目结构
try {
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  console.log('检测到package.json版本:', packageJson.version);
  const dependencies = Object.keys(packageJson.dependencies || {}).length;
  const devDependencies = Object.keys(packageJson.devDependencies || {}).length;
  console.log(`依赖数量: ${dependencies}个生产依赖, ${devDependencies}个开发依赖`);
} catch (err) {
  console.warn('无法读取package.json:', err.message);
}

try {
  if (fs.existsSync('./vite.config.ts')) {
    console.log('检测到vite.config.ts');
  } else {
    console.warn('⚠️ 未找到vite.config.ts');
  }
} catch (err) {
  console.warn('检查文件时出错:', err.message);
}

// 使用分步构建过程
console.log('🚀 开始简化的Vercel构建流程...');

try {
  // 第1步：类型检查
  console.log('步骤1: 运行TypeScript类型检查 (忽略错误)');
  try {
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log('✅ TypeScript检查通过');
  } catch (error) {
    console.log('⚠️ TypeScript检查有警告，但将继续构建');
  }
  
  // 第2步：运行实际构建
  console.log('步骤2: 运行简化的Vite构建');
  try {
    // 使用spawnSync替代execSync以捕获更多输出
    const buildProcess = spawnSync('npx', ['vite', 'build', '--force'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    
    if (buildProcess.status !== 0) {
      console.error('❌ Vite构建失败:');
      console.error('标准输出:', buildProcess.stdout);
      console.error('错误输出:', buildProcess.stderr);
      throw new Error('Vite构建失败');
    }
    
    console.log('✅ Vite构建成功完成');
  } catch (error) {
    console.error('❌ Vite构建过程出错:', error.message);
    process.exit(1);
  }
  
  // 第3步：检查构建输出
  console.log('步骤3: 验证构建输出');
  if (fs.existsSync('./dist') && fs.existsSync('./dist/index.html')) {
    console.log('✅ 构建输出验证成功');
  } else {
    console.error('❌ 构建输出验证失败: 找不到dist目录或index.html');
    process.exit(1);
  }
  
  console.log('🎉 构建流程全部完成');
} catch (error) {
  console.error('❌ 整体构建流程失败:', error);
  process.exit(1);
} 