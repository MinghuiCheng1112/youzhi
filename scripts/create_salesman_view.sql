-- 创建业务员下级关系视图
CREATE OR REPLACE VIEW public.view_salesman_subordinates AS
SELECT 
  sr.parent_id,
  sr.child_id AS id,
  ur.email,
  ur.name,
  ur.phone
FROM 
  public.salesman_relationships sr
JOIN 
  public.user_roles ur ON sr.child_id = ur.user_id;

-- 为视图添加权限
GRANT SELECT ON public.view_salesman_subordinates TO authenticated;
GRANT SELECT ON public.view_salesman_subordinates TO service_role;

-- 如果salesman_relationships表不存在，则创建
CREATE TABLE IF NOT EXISTS public.salesman_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES public.user_roles(user_id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.user_roles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(parent_id, child_id)
);

-- 为salesman_relationships表添加权限
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salesman_relationships TO service_role; 