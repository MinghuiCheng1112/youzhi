# 数据库修复SQL脚本

本目录包含用于修复客户管理系统数据库的SQL脚本。
请按照以下顺序执行这些脚本：

1. `01_deleted_records_function.sql` - 创建获取已删除记录的函数
2. `02_chinese_field_names_function.sql` - 创建字段名中文显示的函数
3. `03_modification_records_view.sql` - 创建带中文字段名的修改记录视图
4. `04_test_deleted_record.sql` - (可选) 创建测试用的删除记录

## 使用方法

您可以通过以下方式执行这些脚本：

1. 在Supabase控制台的SQL编辑器中执行
2. 使用psql命令行工具连接到数据库执行
3. 使用任何PostgreSQL客户端工具(如pgAdmin, DBeaver等)执行

## 注意事项

- 执行脚本前，请确保已备份数据库
- 建议先在测试环境中测试这些脚本
- 如果遇到权限错误，请以数据库管理员身份执行
