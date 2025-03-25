-- 删除客户表上的自动填充施工队电话触发器
DROP TRIGGER IF EXISTS auto_fill_team_phone_trigger ON customers;

-- 删除触发器函数
DROP FUNCTION IF EXISTS auto_fill_team_phone(); 