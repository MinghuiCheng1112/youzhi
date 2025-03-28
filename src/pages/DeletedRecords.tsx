import React, { useEffect, useState } from 'react';
import { 
  Table, Tag, Button, Card, message, Popconfirm, 
  Space, Typography, Modal, Checkbox, Spin, Empty 
} from 'antd';
import { deletedRecordsApi } from '../services/api';
import dayjs from 'dayjs';
import { DeleteOutlined, UndoOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;

// 删除记录类型定义
interface DeletedRecord {
  id: string;
  original_id: string;
  customer_name: string;
  phone: string;
  address: string;
  deleted_at: string;
  register_date: string;
  [key: string]: any; // 其他字段
}

const DeletedRecords: React.FC = () => {
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [pagination, setPagination] = useState({
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
  
  // 恢复单个记录
  const handleRestore = async (id: string) => {
    try {
      setRestoring(true);
      const { success, error } = await deletedRecordsApi.restoreDeletedRecord(id);
      
      if (success) {
        message.success('记录恢复成功');
        // 重新获取记录列表
        fetchDeletedRecords();
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
          } else {
            // 统计成功和失败的数量
            const successCount = results.filter(r => r.success).length;
            message.error(`恢复失败: ${String(error) || '部分记录恢复失败'}`);
            if (successCount > 0) {
              message.info(`${successCount}/${selectedRowKeys.length} 条记录恢复成功`);
              // 重新获取记录列表
              fetchDeletedRecords();
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
  }, []);
  
  // 更新分页处理函数
  const handleTableChange = (newPagination: any) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };
  
  // 表格列定义
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
              onClick={fetchDeletedRecords}
              icon={<UndoOutlined />}
            >
              刷新
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default DeletedRecords; 