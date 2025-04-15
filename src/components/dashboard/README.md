# 表头筛选组件

这个组件实现了客户工作台仪表盘中表头的升序、降序、筛选和搜索功能。

## 组件结构

1. **TableHeaderFilter.tsx** - 提供表头筛选UI和交互逻辑
   - 支持升序/降序排序
   - 支持多选筛选
   - 支持关键字搜索
   - 支持全选/反选
   - 支持重复项/唯一项筛选
   - 清除筛选功能

2. **tableHeaderConfig.ts** - 统一管理表头配置
   - 提供了通用的排序和筛选逻辑
   - 预定义了常用的表头配置

3. **TableFilterExample.tsx** - 示例实现
   - 展示如何在表格中使用表头筛选组件
   - 包含测试数据和表格实现

## 使用方法

在表格列定义中，将原来的字符串标题替换为`TableHeaderFilter`组件：

```tsx
// 原来的列定义
{
  title: '客户姓名',
  dataIndex: 'customer_name',
  key: 'customer_name',
  // ...其他属性
}

// 新的列定义，添加筛选和排序功能
{
  title: (
    <TableHeaderFilter
      title="客户姓名"
      dataIndex="customer_name"
      values={Array.from(new Set(customers.map(item => item.customer_name || ''))).sort()}
      onSort={(direction) => {
        // 处理排序逻辑
        if (direction === 'ascend') {
          setFilteredCustomers([...filteredCustomers].sort((a, b) => 
            (a.customer_name || '').localeCompare(b.customer_name || '')
          ));
        } else if (direction === 'descend') {
          setFilteredCustomers([...filteredCustomers].sort((a, b) => 
            (b.customer_name || '').localeCompare(a.customer_name || '')
          ));
        } else {
          // 重置排序
          setFilteredCustomers([...customers]);
          performSearch(searchText);
        }
      }}
      onFilter={(selectedValues) => {
        // 处理筛选逻辑
        if (selectedValues.length === 0) {
          setFilteredCustomers([...customers]);
          performSearch(searchText);
          return;
        }
        
        setFilteredCustomers(
          customers.filter(customer => 
            selectedValues.includes(customer.customer_name || '')
          )
        );
      }}
      onClear={() => {
        // 清除筛选
        setFilteredCustomers([...customers]);
        performSearch(searchText);
      }}
    />
  ),
  dataIndex: 'customer_name',
  key: 'customer_name',
  // ...其他属性
}
```

## 可以使用配置简化代码

您也可以使用`tableHeaderConfig`来简化代码：

```tsx
import tableHeaderConfigs from '../components/dashboard/tableHeaderConfig';

// 使用预定义的配置
{
  title: (
    <TableHeaderFilter
      title={tableHeaderConfigs.customer_name.title}
      dataIndex={tableHeaderConfigs.customer_name.dataIndex}
      values={tableHeaderConfigs.customer_name.getValues(customers)}
      onSort={(direction) => {
        if (direction) {
          const sortedCustomers = tableHeaderConfigs.customer_name.onSort(
            direction, 
            customers, 
            filteredCustomers
          );
          setFilteredCustomers(sortedCustomers);
        } else {
          // 重置排序
          setFilteredCustomers([...customers]);
          performSearch(searchText);
        }
      }}
      onFilter={(selectedValues) => {
        const filteredData = tableHeaderConfigs.customer_name.onFilter(
          selectedValues,
          customers
        );
        setFilteredCustomers(filteredData);
      }}
      onClear={() => {
        // 清除筛选
        setFilteredCustomers([...customers]);
        performSearch(searchText);
      }}
    />
  ),
  dataIndex: 'customer_name',
  key: 'customer_name',
  // ...其他属性
}
```

## 组件属性

`TableHeaderFilter` 组件支持以下属性：

| 属性       | 类型                                      | 描述                     |
|------------|----------------------------------------|--------------------------|
| title      | string                                 | 表头标题                   |
| dataIndex  | string                                 | 数据字段名                 |
| values     | string[]                               | 该列所有可能的值           |
| onSort     | (direction: 'ascend' \| 'descend' \| null) => void | 排序回调函数 |
| onFilter   | (selectedValues: string[]) => void     | 筛选回调函数              |
| onSearch   | (searchText: string) => void           | 搜索回调函数              |
| onClear    | () => void                             | 清除筛选回调函数           | 