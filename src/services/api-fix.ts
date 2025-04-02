/**
 * 修复API服务文件中的类型错误
 * 
 * 主要修复：
 * 1. 日期对象处理中的类型错误
 */

// 修复版本的updateWithCache函数
export function updateWithCacheFixed(id: string, updates: any): any {
  // 处理特殊字段类型
  const processedUpdates = { ...updates };
  
  // 处理日期字段
  const dateFields = ['register_date', 'filing_date', 'dispatch_date', 'construction_date', 'meter_installation_date'];
  dateFields.forEach(field => {
    if (field in processedUpdates && processedUpdates[field]) {
      const dateValue = processedUpdates[field];
      if (dateValue && typeof dateValue === 'object' && 'toISOString' in dateValue) {
        // 使用类型断言确保TypeScript理解这是一个具有toISOString方法的对象
        processedUpdates[field] = (dateValue as unknown as { toISOString(): string }).toISOString();
      }
    }
  });
  
  // 处理布尔字段，确保正确转换
  const boolFields = ['drawing_change', 'construction_status', 'technical_review'];
  boolFields.forEach(field => {
    if (field in processedUpdates) {
      const boolValue = processedUpdates[field];
      if (typeof boolValue === 'string') {
        // 转换字符串到布尔值
        processedUpdates[field] = boolValue.toLowerCase() === 'true';
      }
    }
  });
  
  // 返回更新后的对象
  return processedUpdates;
} 