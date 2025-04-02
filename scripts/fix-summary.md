# 客户删除记录功能修复总结

## 问题描述

在客户管理系统中，当删除客户时，删除记录未正确保存到`deleted_records`表中，导致无法在"删除记录"页面查看和恢复已删除的客户。

## 问题根源

1. 在`customerApi.delete`方法中使用了物理删除操作（`supabase.from('customers').delete()`），而不是软删除（设置`deleted_at`字段）。
2. 字段优化后，触发器中的字段名称未同步更新，导致触发器执行失败。
3. 存在类型转换问题，一些字段的数据类型与表结构不匹配。

## 修复步骤

### 1. 修复API删除方法

修改`src/services/api.ts`中的`customerApi.delete`方法：

```typescript
delete: async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
  
  // 从缓存中移除
  dataCacheService.removeCustomer(id);
}
```

### 2. 更新删除记录表结构

创建并执行`scripts/fix-deleted-records-table.sql`脚本：

- 添加`technical_review_status`字段
- 添加`construction_acceptance_status`字段
- 添加`construction_acceptance_waiting_days`字段
- 添加`construction_acceptance_waiting_start`字段
- 添加`restored_at`和`restored_by`字段
- 更新`get_deleted_records`函数，只返回未恢复的记录
- 创建`get_restored_records`函数，返回已恢复的记录

### 3. 修复触发器

创建并执行`scripts/fix-deleted-record-triggers.sql`脚本：

- 更新`capture_soft_deleted_customer`函数，使用正确的字段名称
- 更新`record_deleted_customer`函数，处理类型转换
- 更新`restore_deleted_record`函数，添加恢复日期记录
- 确保所有字段类型与表结构匹配

### 4. 验证修复效果

使用`scripts/check-delete-records.js`脚本验证：

- 所有软删除的客户都有对应的删除记录
- 删除触发器正常工作
- 恢复功能正常工作
- 可以查询已恢复和未恢复的记录

## 验证结果

- √ 触发器已正确更新
- √ 函数已正确创建/更新
- √ API删除方法已修改为软删除
- √ 软删除触发器工作正常，生成了删除记录
- √ 恢复功能工作正常，客户已恢复
- √ 恢复记录已正确标记

## 结论

现在当删除客户时：

1. 客户会被软删除（设置`deleted_at`字段）
2. 触发器会捕获这个变化，将客户信息保存到`deleted_records`表
3. "删除记录"页面可以显示所有被删除但未恢复的记录
4. 可以恢复已删除的客户
5. 支持记录和查询已恢复的客户记录 