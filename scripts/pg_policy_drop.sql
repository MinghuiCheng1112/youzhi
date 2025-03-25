-- 尝试删除所有customers表的策略
-- 如果存在名为"Enable read access for all users"的策略，则删除
DROP POLICY IF EXISTS "Enable read access for all users" ON public.customers;

-- 如果存在名为"Enable insert for authenticated users only"的策略，则删除
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.customers;

-- 如果存在名为"Enable update for authenticated users only"的策略，则删除
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.customers;

-- 如果存在名为"Enable delete for authenticated users only"的策略，则删除
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.customers;

-- 如果存在名为"Enable all for authenticated users"的策略，则删除
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.customers; 