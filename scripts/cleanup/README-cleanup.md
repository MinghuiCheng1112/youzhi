# 脚本清理指南

本文档提供了项目中脚本的整理建议，帮助清理不再需要的临时脚本和功能。

## 需要保留的关键脚本

以下脚本是系统维护和核心功能的一部分，应当保留：

1. **数据库连接和查询核心脚本**：
   - `scripts/db-schema.js` - 数据库结构定义
   - `scripts/run-query.js` - 基础数据库查询工具
   - `scripts/exec_sql.js` - SQL执行工具

2. **核心功能和触发器脚本**：
   - `scripts/cleanup/ensure_dispatch_date.sql` - 确保dispatch_date字段一致性的触发器
   - `scripts/cleanup/deploy_dispatch_date_consistency_trigger.sql` - 部署dispatch_date一致性触发器
   - `scripts/cleanup/exec_ensure_dispatch_date.js` - 执行dispatch_date一致性检查
   - `scripts/cleanup/fix_trigger_final.js` - 修复触发器的最终版本

3. **重要修复和维护工具**：
   - `scripts/cleanup/fix_technical_review_direct.js` - 修复technical_review字段引用问题的最终版本
   - `scripts/check-tables.js` - 检查表结构的工具

## 可以安全删除的临时脚本

以下脚本是临时调试和修复过程中使用的，问题已经解决，可以安全删除：

1. **重复的调试脚本**：
   - `scripts/debug/debug_customer_delete.js` - 临时调试脚本，已完成调试任务
   - `scripts/cleanup/check_deleted_records_columns.js` - 临时检查脚本，已解决问题
   - `scripts/cleanup/check_customers_columns.js` - 临时检查脚本，已解决问题
   - `scripts/cleanup/check_deleted_functions.js` - 临时检查脚本，已解决问题
   - `scripts/cleanup/check_restore_function.js` - 临时检查脚本，已解决问题

2. **修复过程中的临时脚本**：
   - `scripts/cleanup/fix_issue.sql` - 空文件，未成功创建
   - `scripts/cleanup/fix_column_mismatch.sql` - 空文件，未成功创建
   - `scripts/cleanup/fix_trigger_add_empty_technical_review.sql` - 空文件，未成功创建
   - `scripts/cleanup/fix_technical_review.sql` - 临时SQL文件，功能已集成到`fix_technical_review_direct.js`
   - `scripts/cleanup/fix_technical_review_one_function.sql` - 临时SQL文件，功能已集成到最终脚本
   - `scripts/cleanup/fix_record_deleted_customer.sql` - 临时SQL文件，功能已集成到最终脚本
   - `scripts/cleanup/exec_fix_technical_review.js` - 临时执行脚本，已由`fix_technical_review_direct.js`替代
   - `scripts/cleanup/exec_fix_technical_review_simple.js` - 临时执行脚本，已由`fix_technical_review_direct.js`替代

3. **已完成的临时修复脚本**：
   - `scripts/cleanup/fix_delete_customer_functions.sql` - 临时修复脚本，功能已集成到`fix_technical_review_direct.js`
   - `scripts/cleanup/exec_fix_delete_customer_functions.js` - 临时执行脚本，功能已集成到最终脚本

## 执行清理

执行清理时，请遵循以下步骤：

1. 备份所有脚本到一个离线位置（以防万一需要参考）
2. 先删除上述"可以安全删除的临时脚本"中列出的文件
3. 测试系统功能，确保删除脚本后系统仍能正常工作
4. 定期检查并清理不再使用的脚本

## 注意事项

- 在删除任何脚本前，请确保您了解其功能和影响范围
- 对于不确定是否可以删除的脚本，可以暂时移动到一个备份目录而不是直接删除
- 保持项目目录结构清晰和有组织，有助于未来的维护工作 