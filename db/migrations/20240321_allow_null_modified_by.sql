-- 修改modification_records表，允许modified_by列接受NULL值
ALTER TABLE modification_records
ALTER COLUMN modified_by DROP NOT NULL;

-- 更新RLS策略，修复NULL值约束
GRANT ALL ON modification_records TO authenticated;

-- 更新行级安全策略
ALTER TABLE modification_records ENABLE ROW LEVEL SECURITY;

-- 更新或创建针对modification_records表的策略
DROP POLICY IF EXISTS "Users can view modification records" ON modification_records;
CREATE POLICY "Users can view modification records" 
ON modification_records FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can insert modification records" ON modification_records;
CREATE POLICY "Users can insert modification records" 
ON modification_records FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update modification records" ON modification_records;
CREATE POLICY "Users can update modification records" 
ON modification_records FOR UPDATE 
USING (true);

-- 重置现有违反约束的数据
-- 注意：此操作会将现有的NULL值设置为系统默认用户ID，请根据需要修改
-- UPDATE modification_records SET modified_by = '00000000-0000-0000-0000-000000000000' WHERE modified_by IS NULL; 