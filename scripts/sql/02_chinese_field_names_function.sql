
-- 创建用于将字段名转换为中文的函数
CREATE OR REPLACE FUNCTION get_field_chinese_name(field_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE field_name
    WHEN 'customer_name' THEN '客户姓名'
    WHEN 'phone' THEN '电话号码'
    WHEN 'address' THEN '地址'
    WHEN 'id_card' THEN '身份证号'
    WHEN 'register_date' THEN '登记日期'
    WHEN 'filing_date' THEN '备案日期'
    WHEN 'meter_number' THEN '电表号'
    WHEN 'designer' THEN '设计师'
    WHEN 'drawing_change' THEN '图纸变更'
    WHEN 'urge_order' THEN '催单状态'
    WHEN 'capacity' THEN '容量'
    WHEN 'investment_amount' THEN '投资金额'
    WHEN 'land_area' THEN '地面面积'
    WHEN 'module_count' THEN '组件数量'
    WHEN 'inverter' THEN '逆变器'
    WHEN 'copper_wire' THEN '铜线'
    WHEN 'aluminum_wire' THEN '铝线'
    WHEN 'distribution_box' THEN '配电箱'
    WHEN 'square_steel_outbound_date' THEN '方钢出库日期'
    WHEN 'component_outbound_date' THEN '组件出库日期'
    WHEN 'dispatch_date' THEN '派工日期'
    WHEN 'construction_team' THEN '施工队'
    WHEN 'construction_team_phone' THEN '施工队电话'
    WHEN 'construction_status' THEN '施工状态'
    WHEN 'main_line' THEN '主线'
    WHEN 'technical_review' THEN '技术审核'
    WHEN 'upload_to_grid' THEN '上传电网'
    WHEN 'construction_acceptance' THEN '施工验收'
    WHEN 'meter_installation_date' THEN '装表日期'
    WHEN 'power_purchase_contract' THEN '购电合同'
    WHEN 'status' THEN '状态'
    WHEN 'price' THEN '价格'
    WHEN 'company' THEN '公司'
    WHEN 'remarks' THEN '备注'
    WHEN 'salesman' THEN '业务员'
    WHEN 'salesman_phone' THEN '业务员电话'
    WHEN 'deleted_at' THEN '删除时间'
    ELSE field_name
  END;
END;
$$;

-- 测试函数
SELECT get_field_chinese_name('customer_name'), get_field_chinese_name('address');
