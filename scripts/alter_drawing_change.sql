-- 修改drawing_change字段类型
ALTER TABLE public.customers 
  ALTER COLUMN drawing_change TYPE TEXT USING 
    CASE 
      WHEN drawing_change = true THEN '变更一' 
      ELSE '无变更' 
    END;

-- 设置默认值
ALTER TABLE public.customers 
  ALTER COLUMN drawing_change SET DEFAULT '无变更';

-- 更新所有空值
UPDATE public.customers 
SET drawing_change = '无变更' 
WHERE drawing_change IS NULL;

-- 重新添加基本的RLS策略
CREATE POLICY "Enable all for authenticated users" ON public.customers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true); 