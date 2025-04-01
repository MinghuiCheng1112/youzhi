import React, { useEffect, useState } from 'react';
import { 
  Table, Tag, Button, Card, message, Popconfirm, 
  Space, Typography, Modal, Checkbox, Spin, Empty, Tabs 
} from 'antd';
import { deletedRecordsApi } from '../services/api';
import dayjs from 'dayjs';
import { DeleteOutlined, UndoOutlined, ExclamationCircleOutlined, ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { TabPane } = Tabs;

// 删除记录类型定义
interface DeletedRecord {
  id: string;
  original_id: string;
  customer_name: string;
  phone: string;
  address: string;
  deleted_at: string;
  register_date: string;
  restored_at?: string; // 添加恢复日期字段
  [key: string]: any; // 其他字段
}

const DeletedRecords: React.FC = () => {
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [restoredRecords, setRestoredRecords] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [restoredLoading, setRestoredLoading] = useState<boolean>(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('deleted');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [restoredPagination, setRestoredPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  
  // 获取所有删除记录
  const fetchDeletedRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await deletedRecordsApi.getDeletedRecords();
      
      if (error) {
        message.error(`获取删除记录失败: ${String(error) || '未知错误'}`);
        setRecords([]);
        setPagination({ ...pagination, total: 0 });
      } else if (data) {
        setRecords(data);
        setPagination({ ...pagination, total: data.length });
      } else {
        setRecords([]);
        setPagination({ ...pagination, total: 0 });
      }
    } catch (err: any) {
      console.error('获取删除记录异常:', err);
      message.error(`获取删除记录时发生错误: ${err?.message || '未知错误'}`);
      setRecords([]);
      setPagination({ ...pagination, total: 0 });
    } finally {
      setLoading(false);
    }
  };
  
  // 获取所有已恢复记录
  const fetchRestoredRecords = async () => {
    setRestoredLoading(true);
    try {
      const { data, error } = await deletedRecordsApi.getRestoredRecords();
      
      if (error) {
        message.error(`获取已恢复记录失败: ${String(error) || '未知错误'}`);
        setRestoredRecords([]);
        setRestoredPagination({ ...restoredPagination, total: 0 });
      } else if (data) {
        setRestoredRecords(data);
        setRestoredPagination({ ...restoredPagination, total: data.length });
      } else {
        setRestoredRecords([]);
        setRestoredPagination({ ...restoredPagination, total: 0 });
      }
    } catch (err: any) {
      console.error('获取已恢复记录异常:', err);
      message.error(`获取已恢复记录时发生错误: ${err?.message || '未知错误'}`);
      setRestoredRecords([]);
      setRestoredPagination({ ...restoredPagination, total: 0 });
    } finally {
      setRestoredLoading(false);
    }
  };
  
  // 恢复单个记录
  const handleRestore = async (id: string) => {
    try {
      setRestoring(true);
      const { success, error } = await deletedRecordsApi.restoreDeletedRecord(id);
      
      if (success) {
        message.success('记录恢复成功');
        // 重新获取记录列表
        fetchDeletedRecords();
        fetchRestoredRecords();
      } else {
        message.error(`恢复失败: ${String(error) || '未知错误'}`);
      }
    } catch (err) {
      console.error('恢复记录异常:', err);
      message.error('恢复记录时发生错误');
    } finally {
      setRestoring(false);
    }
  };
  
  // 批量恢复记录
  const handleBatchRestore = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要恢复的记录');
      return;
    }
    
    Modal.confirm({
      title: '批量恢复记录',
      icon: <ExclamationCircleOutlined />,
      content: `确定要恢复选中的 ${selectedRowKeys.length} 条记录吗？`,
      onOk: async () => {
        try {
          setRestoring(true);
          const { success, error, results } = await deletedRecordsApi.batchRestoreDeletedRecords(
            selectedRowKeys.map(key => key.toString())
          );
          
          if (success) {
            message.success(`成功恢复 ${selectedRowKeys.length} 条记录`);
            setSelectedRowKeys([]); // 清空选择
            // 重新获取记录列表
            fetchDeletedRecords();
            fetchRestoredRecords();
          } else {
            // 统计成功和失败的数量
            const successCount = results.filter(r => r.success).length;
            message.error(`恢复失败: ${String(error) || '部分记录恢复失败'}`);
            if (successCount > 0) {
              message.info(`${successCount}/${selectedRowKeys.length} 条记录恢复成功`);
              // 重新获取记录列表
              fetchDeletedRecords();
              fetchRestoredRecords();
            }
          }
        } catch (err) {
          console.error('批量恢复记录异常:', err);
          message.error('批量恢复记录时发生错误');
        } finally {
          setRestoring(false);
        }
      }
    });
  };
  
  // 初始加载时获取记录
  useEffect(() => {
    fetchDeletedRecords();
    fetchRestoredRecords();
  }, []);
  
  // 切换标签页
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'deleted' && records.length === 0) {
      fetchDeletedRecords();
    } else if (key === 'restored' && restoredRecords.length === 0) {
      fetchRestoredRecords();
    }
  };
  
  // 更新分页处理函数 - 删除记录
  const handleTableChange = (newPagination: any) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };
  
  // 更新分页处理函数 - 已恢复记录  
  const handleRestoredTableChange = (newPagination: any) => {
    setRestoredPagination({
      ...restoredPagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };
  
  // 刷新数据
  const refreshData = () => {
    if (activeTab === 'deleted') {
      fetchDeletedRecords();
    } else {
      fetchRestoredRecords();
    }
  };
  
  // 表格列定义 - 删除记录
  const columns = [
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (text: string) => <a>{text}</a>,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: '注册日期',
      dataIndex: 'register_date',
      key: 'register_date',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '删除日期',
      dataIndex: 'deleted_at',
      key: 'deleted_at',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
      sorter: (a: DeletedRecord, b: DeletedRecord) => {
        if (!a.deleted_at || !b.deleted_at) return 0;
        return dayjs(a.deleted_at).unix() - dayjs(b.deleted_at).unix();
      },
      defaultSortOrder: 'descend' as 'descend',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: DeletedRecord) => (
        <Space size="middle">
          <Popconfirm
            title="恢复记录"
            description="确定要恢复这条记录吗？"
            onConfirm={() => handleRestore(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="primary" 
              icon={<UndoOutlined />} 
              size="small"
              loading={restoring}
            >
              恢复
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  
  // 表格列定义 - 已恢复记录
  const restoredColumns = [
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (text: string) => <a>{text}</a>,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: '注册日期',
      dataIndex: 'register_date',
      key: 'register_date',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '删除日期',
      dataIndex: 'deleted_at',
      key: 'deleted_at',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '恢复日期',
      dataIndex: 'restored_at',
      key: 'restored_at',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
      sorter: (a: DeletedRecord, b: DeletedRecord) => {
        if (!a.restored_at || !b.restored_at) return 0;
        return dayjs(a.restored_at).unix() - dayjs(b.restored_at).unix();
      },
      defaultSortOrder: 'descend' as 'descend',
    }
  ];
  
  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys);
    },
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <Card>
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane 
            tab={
              <span>
                <DeleteOutlined />
                已删除记录
              </span>
            } 
            key="deleted"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Title level={4}>已删除记录</Title>
              <Space>
                <Button
                  type="primary"
                  onClick={handleBatchRestore}
                  disabled={selectedRowKeys.length === 0 || restoring}
                  loading={restoring}
                  icon={<UndoOutlined />}
                >
                  批量恢复 ({selectedRowKeys.length})
                </Button>
                <Button
                  type="default"
                  onClick={refreshData}
                  icon={<ClockCircleOutlined />}
                >
                  刷新
                </Button>
              </Space>
            </div>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <Spin size="large" />
              </div>
            ) : records.length > 0 ? (
              <Table
                rowKey="id"
                rowSelection={rowSelection}
                columns={columns}
                dataSource={records}
                pagination={pagination}
                onChange={handleTableChange}
              />
            ) : (
              <Empty description="暂无删除记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <CheckCircleOutlined />
                已恢复记录
              </span>
            } 
            key="restored"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Title level={4}>已恢复记录</Title>
              <Button
                type="default"
                onClick={refreshData}
                icon={<ClockCircleOutlined />}
              >
                刷新
              </Button>
            </div>
            
            {restoredLoading ? (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <Spin size="large" />
              </div>
            ) : restoredRecords.length > 0 ? (
              <Table
                rowKey="id"
                columns={restoredColumns}
                dataSource={restoredRecords}
                pagination={restoredPagination}
                onChange={handleRestoredTableChange}
              />
            ) : (
              <Empty description="暂无已恢复记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default DeletedRecords; 