-- 清理备案日期字段中的时间信息
BEGIN;

-- 创建一个临时函数用于提取日期部分
CREATE OR REPLACE FUNCTION extract_date_part(input_text TEXT) 
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
BEGIN
  -- 尝试提取YYYY-MM-DD格式
  IF input_text ~ '^\d{4}-\d{2}-\d{2}' THEN
    date_part := substring(input_text from 1 for 10);
    RETURN date_part;
  END IF;
  
  -- 如果不是有效格式，返回原始值
  RETURN input_text;
END;
$$ LANGUAGE plpgsql;

-- 更新备案日期字段，提取日期部分
UPDATE customers
SET filing_date = extract_date_part(filing_date)
WHERE filing_date ~ '^\d{4}-\d{2}-\d{2}.*\d{2}:\d{2}:\d{2}.*';

-- 查看更新后的结果
SELECT id, customer_name, filing_date
FROM customers 
WHERE filing_date IS NOT NULL
LIMIT 10;

-- 删除临时函数
DROP FUNCTION extract_date_part;

COMMIT; 