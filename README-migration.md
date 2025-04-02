# 技术审核和建设验收字段迁移指南

本文档提供了从旧字段结构迁移到新字段结构的步骤说明。

## 字段变更概述

### 旧字段结构

技术审核相关字段:
- `technical_review`: 使用时间戳表示已审核通过，NULL表示未审核
- `technical_review_rejected`: 存储驳回信息，带时间戳

建设验收相关字段:
- `construction_acceptance`: 使用时间戳表示已验收完成，特殊格式"waiting:天数:开始日期"表示等待中，NULL表示未验收

### 新字段结构

技术审核相关字段:
- `technical_review_status`: 使用枚举值("pending", "approved", "rejected")表示审核状态
- `technical_review_date`: 审核操作时间
- `technical_review_notes`: 审核备注

建设验收相关字段:
- `construction_acceptance_status`: 使用枚举值("pending", "waiting", "completed")表示验收状态
- `construction_acceptance_date`: 验收操作时间
- `construction_acceptance_waiting_days`: 等待天数
- `construction_acceptance_waiting_start`: 等待开始时间
- `construction_acceptance_notes`: 验收备注

## 迁移步骤

### 1. 备份数据库

```bash
# 备份当前数据库
pg_dump -h $SUPABASE_DB_HOST -U $SUPABASE_DB_USER -d $SUPABASE_DB_NAME -f backup_before_migration.sql
```

### 2. 添加新字段并迁移数据

1. 执行`optimize_review_acceptance_fields.sql`脚本添加新字段并迁移数据:

```bash
node scripts/run-field-optimization.js
```

此脚本会:
- 添加新字段
- 迁移旧字段数据到新字段
- 添加约束和索引
- 创建触发器保持新旧字段同步
- 创建视图用于查询

### 3. 更新前端代码

更新了以下文件以使用新字段:
- `database/types.ts`: 更新数据库类型定义
- `src/types/index.ts`: 更新前端类型定义
- `src/pages/CustomerList.tsx`: 更新列表显示和处理逻辑

### 4. 测试新字段

在测试环境中验证以下功能:
- 技术审核:
  - 能否正常设置技术审核为"已通过"状态
  - 能否正常设置技术审核为"已驳回"状态
  - 能否正常重置技术审核状态
- 建设验收:
  - 能否正常设置建设验收为"已完成"状态
  - 能否正常设置建设验收为"等待中"状态，并正确显示等待天数
  - 能否正常重置建设验收状态

### 5. 删除旧字段

确认所有功能正常后，执行`remove_legacy_fields.sql`脚本删除旧字段:

```bash
node scripts/run-remove-legacy-fields.js
```

此脚本会:
- 验证数据已成功迁移
- 删除依赖于旧字段的触发器
- 更新触发器函数，移除对旧字段的引用
- 删除旧字段
- 更新相关视图

## 回滚计划

如果迁移过程中出现问题，可按以下步骤回滚:

1. 停止应用服务
2. 恢复数据库备份:

```bash
# 恢复数据库
psql -h $SUPABASE_DB_HOST -U $SUPABASE_DB_USER -d $SUPABASE_DB_NAME -f backup_before_migration.sql
```

3. 回滚前端代码修改
4. 重启应用服务

## 字段使用参考

### 技术审核状态使用示例

```typescript
// 检查技术审核状态
if (customer.technical_review_status === 'approved') {
  // 已通过审核
} else if (customer.technical_review_status === 'rejected') {
  // 已驳回
} else {
  // 待审核
}

// 获取审核时间
const reviewDate = customer.technical_review_date ? 
  dayjs(customer.technical_review_date).format('YYYY-MM-DD') : '无';
```

### 建设验收状态使用示例

```typescript
// 检查建设验收状态
if (customer.construction_acceptance_status === 'completed') {
  // 已完成验收
} else if (customer.construction_acceptance_status === 'waiting') {
  // 等待中
  const waitingDays = customer.construction_acceptance_waiting_days || 0;
  const startDate = customer.construction_acceptance_waiting_start ?
    dayjs(customer.construction_acceptance_waiting_start) : dayjs();
  
  // 计算已等待天数
  const daysElapsed = dayjs().diff(startDate, 'day');
  
  // 计算总等待天数
  const totalWaitDays = waitingDays + daysElapsed;
} else {
  // 待验收
}
``` 