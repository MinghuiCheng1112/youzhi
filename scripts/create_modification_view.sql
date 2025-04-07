-- 创建修改记录视图，包含中文字段名和用户信息
BEGIN;

-- 创建获取字段中文名称的辅助函数
CREATE OR REPLACE FUNCTION get_field_chinese_name(field_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE field_name
    WHEN 'customer_name' THEN '客户姓名'
    WHEN 'phone' THEN '电话号码'
    WHEN 'address' THEN '地址'
    WHEN 'module_count' THEN '组件数量'
    WHEN 'capacity' THEN '容量'
    WHEN 'investment_amount' THEN '投资金额'
    WHEN 'land_area' THEN '土地面积'
    WHEN 'register_date' THEN '注册日期'
    WHEN 'salesman' THEN '业务员'
    WHEN 'salesman_phone' THEN '业务员电话'
    WHEN 'surveyor' THEN '踏勘员'
    WHEN 'surveyor_phone' THEN '踏勘员电话'
    WHEN 'designer' THEN '设计师'
    WHEN 'designer_phone' THEN '设计师电话'
    WHEN 'meter_number' THEN '电表号'
    WHEN 'construction_team' THEN '施工队'
    WHEN 'construction_team_phone' THEN '施工队电话'
    WHEN 'dispatch_date' THEN '派工日期'
    WHEN 'construction_status' THEN '施工状态'
    WHEN 'construction_acceptance_date' THEN '施工验收日期'
    WHEN 'meter_installation_date' THEN '装表日期'
    WHEN 'deleted_at' THEN '删除时间'
    ELSE field_name
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 创建修改记录视图
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
  'admin' as modified_by_name,
  mr.modified_at
FROM 
  modification_records mr
LEFT JOIN 
  customers c ON mr.customer_id = c.id
ORDER BY 
  mr.modified_at DESC;

COMMIT; 