# 客户管理系统 - 自动派工日期功能

## 功能说明

本系统实现了自动派工日期功能，当施工队字段（`construction_team`）从空值变为非空值时，会自动设置派工日期（`dispatch_date`）为当前时间。

## 实现方式

通过PostgreSQL数据库触发器实现，具体如下：

1. 创建名为`set_dispatch_date`的触发器函数，当施工队字段从NULL或空字符串变为有值时，自动设置派工日期字段为当前时间。

2. 创建名为`update_dispatch_date_trigger`的触发器，在更新客户表（`customers`）记录前触发上述函数。

## 触发器代码

```sql
-- 触发器函数
CREATE OR REPLACE FUNCTION set_dispatch_date()
RETURNS TRIGGER AS $$
BEGIN
  -- 只有当施工队从空值变为非空值时，才设置派工日期
  IF (NEW.construction_team IS NOT NULL AND
     (OLD.construction_team IS NULL OR OLD.construction_team = '')) THEN
    NEW.dispatch_date = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 触发器
CREATE TRIGGER update_dispatch_date_trigger
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION set_dispatch_date();
```

## 测试结果

测试验证了以下情况：

1. 当给一个没有施工队的客户分配施工队时，派工日期自动设置为当前时间。
2. 修改施工队字段（从一个非空值变为另一个非空值）时，不会改变派工日期。
3. 当施工队字段清空时，派工日期保持不变。

## 使用方式

在正常操作系统时，只需在客户信息中填写施工队信息，系统会自动设置派工日期。不需要任何额外的操作。

## 注意事项

1. 此功能仅在施工队从空值变为非空值时触发，修改现有的施工队不会影响派工日期。
2. 如需手动设置派工日期，可以直接编辑派工日期字段。 