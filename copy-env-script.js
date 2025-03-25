import fs from 'fs';
import path from 'path';

console.log('正在复制环境变量脚本到构建目录...');

try {
  if (fs.existsSync('./netlify-env.js')) {
    // 确保目标目录存在
    if (!fs.existsSync('./dist')) {
      console.log('创建dist目录...');
      fs.mkdirSync('./dist', { recursive: true });
    }
    
    // 复制文件
    fs.copyFileSync('./netlify-env.js', './dist/netlify-env.js');
    console.log('✅ 环境变量脚本已复制到dist目录');
  } else {
    console.log('⚠️ netlify-env.js文件不存在，跳过复制');
  }
} catch (error) {
  console.error('❌ 复制过程中出错:', error);
} 