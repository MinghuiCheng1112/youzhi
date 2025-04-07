import React, { useEffect, useState } from 'react';
import { 
  Table, Button, Card, message, Popconfirm, 
  Space, Typography, Modal, Spin, Empty, Tooltip, Row, Col
} from 'antd';
import { deletedRecordsApi } from '../services/api';
import dayjs from 'dayjs';
import { 
  DeleteOutlined, UndoOutlined, ExclamationCircleOutlined, 
  ClockCircleOutlined, WarningOutlined 
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { confirm } = Modal;

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

// 字段名英文到中文的映射
const fieldNameMap: Record<string, string> = {
  // 基本信息
  id: 'ID',
  original_id: '原始ID',
  customer_name: '客户姓名',
  phone: '电话',
  address: '地址',
  deleted_at: '删除日期',
  register_date: '注册日期',
  id_card: '身份证号',
  
  // 人员信息
  salesman: '业务员',
  salesman_phone: '业务员电话',
  salesman_email: '业务员邮箱',
  surveyor: '测量员',
  surveyor_phone: '测量员电话',
  surveyor_email: '测量员邮箱',
  designer: '设计师',
  designer_phone: '设计师电话',
  
  // 项目信息
  capacity: '容量(kW)',
  investment_amount: '投资金额(万元)',
  land_area: '土地面积(㎡)',
  module_count: '组件数量',
  meter_number: '电表号',
  inverter: '逆变器',
  copper_wire: '铜线',
  aluminum_wire: '铝线',
  distribution_box: '配电箱',
  
  // 日期信息
  square_steel_outbound_date: '方钢出库日期',
  component_outbound_date: '组件出库日期',
  dispatch_date: '派工日期',
  construction_acceptance_date: '施工验收日期',
  meter_installation_date: '装表日期',
  upload_to_grid_date: '并网日期',
  filing_date: '备案日期',
  
  // 其他信息
  construction_team: '施工队',
  construction_team_phone: '施工队电话',
  power_purchase_contract: '购电合同',
  technical_review: '技术评审',
  technical_review_status: '技术评审状态',
  station_management: '电站管理',
  urge_order: '催单',
  drawing_change: '图纸变更',
  construction_status: '施工状态',
  created_at: '创建时间',
  updated_at: '更新时间'
};

// 获取字段的中文名称
const getFieldChineseName = (fieldName: string): string => {
  return fieldNameMap[fieldName] || fieldName.replace(/_/g, ' ');
};

const DeletedRecords: React.FC = () => {
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState<boolean>(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20, // 增加每页显示数量
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
            const successCount = results?.filter(r => r.success).length || 0;
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

  // 永久删除单个记录
  const handlePermanentlyDelete = async (id: string, customerName: string) => {
    confirm({
      title: '永久删除记录',
      icon: <WarningOutlined style={{ color: 'red' }} />,
      content: (
        <>
          <Text strong type="danger">此操作将永久删除客户 "{customerName}" 的所有数据，且无法恢复！</Text>
          <br />
          <Text>请确认是否继续？</Text>
        </>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setPermanentlyDeleting(true);
          const { success, error } = await deletedRecordsApi.permanentlyDeleteRecord(id);
          
          if (success) {
            message.success(`客户 "${customerName}" 已永久删除`);
            // 重新获取记录列表
            fetchDeletedRecords();
          } else {
            message.error(`永久删除失败: ${String(error) || '未知错误'}`);
          }
        } catch (err) {
          console.error('永久删除记录异常:', err);
          message.error('永久删除记录时发生错误');
        } finally {
          setPermanentlyDeleting(false);
        }
      }
    });
  };
  
  // 批量永久删除记录
  const handleBatchPermanentlyDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要永久删除的记录');
      return;
    }
    
    confirm({
      title: '批量永久删除记录',
      icon: <WarningOutlined style={{ color: 'red' }} />,
      content: (
        <>
          <Text strong type="danger">此操作将永久删除选中的 {selectedRowKeys.length} 条客户记录，且无法恢复！</Text>
          <br />
          <Text>请确认是否继续？</Text>
        </>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setPermanentlyDeleting(true);
          const { success, error, results } = await deletedRecordsApi.batchPermanentlyDeleteRecords(
            selectedRowKeys.map(key => key.toString())
          );
          
          if (success) {
            message.success(`已永久删除 ${selectedRowKeys.length} 条记录`);
            setSelectedRowKeys([]); // 清空选择
            // 重新获取记录列表
            fetchDeletedRecords();
          } else {
            // 统计成功和失败的数量
            const successCount = results?.filter(r => r.success).length || 0;
            message.error(`永久删除失败: ${String(error) || '部分记录删除失败'}`);
            if (successCount > 0) {
              message.info(`${successCount}/${selectedRowKeys.length} 条记录已永久删除`);
              // 重新获取记录列表
              fetchDeletedRecords();
            }
          }
        } catch (err) {
          console.error('批量永久删除记录异常:', err);
          message.error('批量永久删除记录时发生错误');
        } finally {
          setPermanentlyDeleting(false);
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
  
  // 刷新数据
  const refreshData = () => {
    fetchDeletedRecords();
  };
  
  // 表格列定义
  const columns = [
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (text: string) => <a>{text}</a>,
      width: 150,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      width: 200,
    },
    {
      title: '业务员',
      dataIndex: 'salesman',
      key: 'salesman',
      width: 120,
    },
    {
      title: '业务员电话',
      dataIndex: 'salesman_phone',
      key: 'salesman_phone',
      width: 150,
    },
    {
      title: '注册日期',
      dataIndex: 'register_date',
      key: 'register_date',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
      width: 120,
    },
    {
      title: '删除日期',
      dataIndex: 'deleted_at',
      key: 'deleted_at',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
      sorter: (a: DeletedRecord, b: DeletedRecord) => {
        if (!a.deleted_at || !b.deleted_at) return 0;
        return dayjs(a.deleted_at).unix() - dayjs(b.deleted_at).unix();
      },
      defaultSortOrder: 'descend' as 'descend',
      width: 150,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 200,
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
          
          <Button 
            type="primary" 
            danger
            icon={<DeleteOutlined />} 
            size="small"
            loading={permanentlyDeleting}
            onClick={() => handlePermanentlyDelete(record.id, record.customer_name)}
            style={{ minWidth: '100px' }} // 确保按钮宽度足以显示文字
          >
            永久删除
          </Button>
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
  
  // 将客户详细信息分组显示
  const renderDetailedInfo = (record: DeletedRecord) => {
    // 创建字段组
    const groups = {
      '基本信息': ['id_card', 'created_at', 'updated_at'],
      '人员信息': ['surveyor', 'surveyor_phone', 'surveyor_email', 'designer', 'designer_phone'],
      '项目信息': ['capacity', 'investment_amount', 'land_area', 'module_count', 'meter_number', 
                'inverter', 'copper_wire', 'aluminum_wire', 'distribution_box'],
      '日期信息': ['square_steel_outbound_date', 'component_outbound_date', 'dispatch_date', 
                'construction_acceptance_date', 'meter_installation_date', 'upload_to_grid_date', 
                'filing_date'],
      '其他信息': ['construction_team', 'construction_team_phone', 'power_purchase_contract', 
                'technical_review', 'technical_review_status', 'station_management', 
                'urge_order', 'drawing_change', 'construction_status']
    };
    
    // 已在表格中显示的基本字段
    const excludedFields = ['id', 'original_id', 'customer_name', 'phone', 'address', 
                           'register_date', 'deleted_at', 'salesman', 'salesman_phone'];
    
    return (
      <div style={{ padding: '10px 20px', backgroundColor: '#fafafa' }}>
        <Title level={5}>客户详细信息</Title>
        <Row gutter={[24, 12]}>
          {Object.entries(groups).map(([groupName, fields]) => (
            <Col span={24} key={groupName}>
              <Card 
                title={groupName} 
                size="small" 
                style={{ marginBottom: '16px' }}
                bodyStyle={{ padding: '12px' }}
              >
                <Row gutter={[16, 8]}>
                  {fields.map(field => {
                    if (excludedFields.includes(field) || record[field] === null || record[field] === undefined || record[field] === '') {
                      return null;
                    }
                    
                    // 处理不同类型的值
                    let displayValue = record[field];
                    
                    // 处理日期
                    if (typeof displayValue === 'string' && (displayValue.includes('T') || displayValue.includes('Z')) && !isNaN(Date.parse(displayValue))) {
                      displayValue = dayjs(displayValue).format('YYYY-MM-DD HH:mm:ss');
                    }
                    
                    // 处理布尔值
                    if (typeof displayValue === 'boolean') {
                      displayValue = displayValue ? '是' : '否';
                    }
                    
                    // 处理数组
                    if (Array.isArray(displayValue)) {
                      displayValue = displayValue.join(', ');
                    }
                    
                    return (
                      <Col span={8} key={field}>
                        <div style={{ display: 'flex' }}>
                          <div style={{ fontWeight: 'bold', minWidth: '120px', color: '#666' }}>
                            {getFieldChineseName(field)}:
                          </div>
                          <div>{String(displayValue)}</div>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  };
  
  return (
    <div style={{ padding: '20px', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4}>已删除记录</Title>
          <Space>
            <Button
              type="primary"
              onClick={handleBatchRestore}
              disabled={selectedRowKeys.length === 0 || restoring || permanentlyDeleting}
              loading={restoring}
              icon={<UndoOutlined />}
            >
              批量恢复 ({selectedRowKeys.length})
            </Button>
            
            <Tooltip title="此操作将永久删除选中的记录，且无法恢复">
              <Button
                type="primary"
                danger
                onClick={handleBatchPermanentlyDelete}
                disabled={selectedRowKeys.length === 0 || restoring || permanentlyDeleting}
                loading={permanentlyDeleting}
                icon={<DeleteOutlined />}
                style={{ minWidth: '150px' }} // 确保按钮宽度足以显示文字
              >
                批量永久删除 ({selectedRowKeys.length})
              </Button>
            </Tooltip>
            
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
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Table
              rowKey="id"
              rowSelection={rowSelection}
              columns={columns}
              dataSource={records}
              pagination={{
                ...pagination,
                position: ['bottomCenter'],
                style: { marginBottom: 0 }
              }}
              onChange={handleTableChange}
              expandable={{
                expandedRowRender: renderDetailedInfo,
              }}
              scroll={{ x: '100%', y: 'calc(100% - 56px)' }}
              size="middle"
              style={{ height: '100%' }}
            />
          </div>
        ) : (
          <Empty description="暂无删除记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </div>
  );
};

export default DeletedRecords; 