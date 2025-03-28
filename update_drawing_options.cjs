// 修改图纸变更选项的脚本
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'CustomerList.tsx');

// 读取文件内容
let content = fs.readFileSync(filePath, 'utf8');

// 查找DRAWING_CHANGE_OPTIONS的定义
const optionsRegex = /(const\s+DRAWING_CHANGE_OPTIONS\s*=\s*\[[\s\S]*?)({\s*value:\s*['"]变更1['"],[\s\S]*?},)/;

// 添加"已出图"选项
if (optionsRegex.test(content)) {
  content = content.replace(optionsRegex, 
    `$1{ value: '已出图', label: '已出图', color: 'green' },\n    $2`);
  
  // 写回文件
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('成功添加"已出图"选项到图纸变更选项列表');
} else {
  console.error('未找到匹配的图纸变更选项定义');
} 