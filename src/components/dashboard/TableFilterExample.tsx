import React, { useState, useEffect } from 'react';
import { Table, Card, Space, Button } from 'antd';
import TableHeaderFilter from './TableHeaderFilter';
import type { ColumnsType } from 'antd/es/table';

// 示例数据类型
interface ExampleCustomer {
  id: string;
  name: string;
  address: string;
  phone: string;
  salesman: string;
  designer: string;
  module_count: number;
}

// 示例数据
const sampleData: ExampleCustomer[] = [
  { id: '1', name: '赵小毛', address: '保和乡高掌村12号', phone: '13912345678', salesman: '李明', designer: '王设计', module_count: 30 },
  { id: '2', name: '胡广贺', address: '保和乡掌村128号', phone: '13812345678', salesman: '李明', designer: '张设计', module_count: 35 },
  { id: '3', name: '吴海成', address: '保集余杭村', phone: '13712345678', salesman: '张三', designer: '王设计', module_count: 28 },
  { id: '4', name: '王奇', address: '九街镇王庄村188号', phone: '13612345678', salesman: '李明', designer: '赵设计', module_count: 32 },
  { id: '5', name: '赵玉生', address: '保和乡掌村', phone: '13512345678', salesman: '王五', designer: '王设计', module_count: 36 },
  { id: '6', name: '魏凤合', address: '集镇余村34号', phone: '13412345678', salesman: '张三', designer: '李设计', module_count: 33 },
  { id: '7', name: '王雪勤', address: '远花镇东村11号', phone: '13312345678', salesman: '李四', designer: '王设计', module_count: 29 },
  { id: '8', name: '赵文卿', address: '保和乡高掌村221号', phone: '13212345678', salesman: '李明', designer: '赵设计', module_count: 31 },
  { id: '9', name: '周红章', address: '九街镇余村', phone: '13112345678', salesman: '王五', designer: '张设计', module_count: 34 },
  { id: '10', name: '王桂花', address: '太阳镇太阳村97号', phone: '13012345678', salesman: '赵六', designer: '李设计', module_count: 27 },
];

const TableFilterExample: React.FC = () => {
  const [data, setData] = useState<ExampleCustomer[]>(sampleData);
  const [filteredData, setFilteredData] = useState<ExampleCustomer[]>(sampleData);

  // 定义表格列
  const columns: ColumnsType<ExampleCustomer> = [
    {
      title: (
        <TableHeaderFilter
          title="客户姓名"
          dataIndex="name"
          values={Array.from(new Set(data.map(item => item.name))).sort()}
          onSort={(direction) => {
            if (direction === 'ascend') {
              setFilteredData([...filteredData].sort((a, b) => a.name.localeCompare(b.name)));
            } else if (direction === 'descend') {
              setFilteredData([...filteredData].sort((a, b) => b.name.localeCompare(a.name)));
            } else {
              setFilteredData([...data]);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              setFilteredData([...data]);
              return;
            }
            setFilteredData(data.filter(item => selectedValues.includes(item.name)));
          }}
          onClear={() => setFilteredData([...data])}
        />
      ),
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: (
        <TableHeaderFilter
          title="客户地址"
          dataIndex="address"
          values={Array.from(new Set(data.map(item => item.address))).sort()}
          onSort={(direction) => {
            if (direction === 'ascend') {
              setFilteredData([...filteredData].sort((a, b) => a.address.localeCompare(b.address)));
            } else if (direction === 'descend') {
              setFilteredData([...filteredData].sort((a, b) => b.address.localeCompare(a.address)));
            } else {
              setFilteredData([...data]);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              setFilteredData([...data]);
              return;
            }
            setFilteredData(data.filter(item => selectedValues.includes(item.address)));
          }}
          onClear={() => setFilteredData([...data])}
        />
      ),
      dataIndex: 'address',
      key: 'address',
      width: 180,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: (
        <TableHeaderFilter
          title="业务员"
          dataIndex="salesman"
          values={Array.from(new Set(data.map(item => item.salesman))).sort()}
          onSort={(direction) => {
            if (direction === 'ascend') {
              setFilteredData([...filteredData].sort((a, b) => a.salesman.localeCompare(b.salesman)));
            } else if (direction === 'descend') {
              setFilteredData([...filteredData].sort((a, b) => b.salesman.localeCompare(a.salesman)));
            } else {
              setFilteredData([...data]);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              setFilteredData([...data]);
              return;
            }
            setFilteredData(data.filter(item => selectedValues.includes(item.salesman)));
          }}
          onClear={() => setFilteredData([...data])}
        />
      ),
      dataIndex: 'salesman',
      key: 'salesman',
      width: 120,
    },
    {
      title: (
        <TableHeaderFilter
          title="设计师"
          dataIndex="designer"
          values={Array.from(new Set(data.map(item => item.designer))).sort()}
          onSort={(direction) => {
            if (direction === 'ascend') {
              setFilteredData([...filteredData].sort((a, b) => a.designer.localeCompare(b.designer)));
            } else if (direction === 'descend') {
              setFilteredData([...filteredData].sort((a, b) => b.designer.localeCompare(a.designer)));
            } else {
              setFilteredData([...data]);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              setFilteredData([...data]);
              return;
            }
            setFilteredData(data.filter(item => selectedValues.includes(item.designer)));
          }}
          onClear={() => setFilteredData([...data])}
        />
      ),
      dataIndex: 'designer',
      key: 'designer',
      width: 120,
    },
    {
      title: (
        <TableHeaderFilter
          title="组件数量"
          dataIndex="module_count"
          values={Array.from(new Set(data.map(item => item.module_count.toString()))).sort((a, b) => parseInt(a) - parseInt(b))}
          onSort={(direction) => {
            if (direction === 'ascend') {
              setFilteredData([...filteredData].sort((a, b) => a.module_count - b.module_count));
            } else if (direction === 'descend') {
              setFilteredData([...filteredData].sort((a, b) => b.module_count - a.module_count));
            } else {
              setFilteredData([...data]);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              setFilteredData([...data]);
              return;
            }
            setFilteredData(data.filter(item => 
              selectedValues.includes(item.module_count.toString())
            ));
          }}
          onClear={() => setFilteredData([...data])}
        />
      ),
      dataIndex: 'module_count',
      key: 'module_count',
      width: 120,
    },
  ];

  const resetData = () => {
    setData([...sampleData]);
    setFilteredData([...sampleData]);
  };

  return (
    <div style={{ padding: 20 }}>
      <Card 
        title="表格筛选示例" 
        extra={
          <Space>
            <Button onClick={resetData}>重置数据</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          pagination={false}
          bordered
        />
      </Card>
    </div>
  );
};

export default TableFilterExample; 