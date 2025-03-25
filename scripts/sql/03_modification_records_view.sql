
-- 创建包含中文字段名和修改人信息的修改记录视图
CREATE OR REPLACE VIEW modification_records_with_names AS
SELECT 
  mr.id,
  mr.customer_id,
  c.customer_name,
  get_field_chinese_name(mr.field_name) as field_name_chinese,
  mr.field_name,
  mr.old_value,
  mr.new_value,
  mr.modified_by,
  u.email as modified_by_email,
  COALESCE(p.raw_user_meta_data->>'full_name', u.email) as modified_by_name,
  mr.modified_at
FROM 
  modification_records mr
LEFT JOIN 
  customers c ON mr.customer_id = c.id
LEFT JOIN 
  auth.users u ON mr.modified_by = u.id
LEFT JOIN 
  auth.users p ON mr.modified_by = p.id
ORDER BY 
  mr.modified_at DESC;

-- 测试视图
SELECT * FROM modification_records_with_names LIMIT 5;
