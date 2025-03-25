import { useState, useEffect } from 'react'
import { Card, Table, Button, Form, Select, message, Modal } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { supabase } from '../../services/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import Draggable from 'react-draggable'

// 定义类型
interface Salesman {
  user_id: string;
  user: { email: string }[];
  role: string;
}

interface Relationship {
  id: string;
  child_id: string;
  child: { email: string }[];
}

const SalesmanRelationships = () => {
  const { user } = useAuth()
  const [salesmen, setSalesmen] = useState<Salesman[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()
  
  // 获取所有业务员
  const fetchSalesmen = async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        user:user_id(email),
        role
      `)
      .eq('role', 'salesman')
    
    if (error) throw error
    setSalesmen(data || [])
  }
  
  // 获取关系
  const fetchRelationships = async () => {
    if (!user) return
    
    const { data, error } = await supabase
      .from('salesman_relationships')
      .select(`
        id,
        child_id,
        child:child_id(email)
      `)
      .eq('parent_id', user.id)
    
    if (error) throw error
    setRelationships(data || [])
  }
  
  // 处理添加下级
  const handleAddSubSalesman = async (values: { salesman: string }) => {
    try {
      if (!user) {
        message.error('未登录')
        return
      }
      
      const { error } = await supabase
        .from('salesman_relationships')
        .insert({
          parent_id: user.id,
          child_id: values.salesman
        })
      
      if (error) throw error
      
      message.success('添加下级业务员成功')
      setIsModalVisible(false)
      form.resetFields()
      fetchRelationships()
    } catch (error) {
      console.error('添加下级业务员失败:', error)
      message.error('添加下级业务员失败')
    }
  }
  
  // 列定义和组件其余部分
  useEffect(() => {
    fetchSalesmen()
    fetchRelationships()
  }, [user])
  
  // 处理删除下级业务员
  const handleDeleteSubSalesman = async (id: string) => {
    try {
      const { error } = await supabase
        .from('salesman_relationships')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      message.success('删除下级业务员成功')
      fetchRelationships()
    } catch (error) {
      console.error('删除下级业务员失败:', error)
      message.error('删除下级业务员失败')
    }
  }
  
  // 表格列定义
  const columns = [
    {
      title: '业务员邮箱',
      dataIndex: ['child', '0', 'email'],
      key: 'email',
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Relationship) => (
        <Button 
          danger 
          onClick={() => handleDeleteSubSalesman(record.id)}
          size="small"
        >
          删除
        </Button>
      ),
    },
  ]
  
  return (
    <div>
      <Card title="下级业务员管理" extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setIsModalVisible(true)}
        >
          添加下级业务员
        </Button>
      }>
        <Table 
          columns={columns}
          dataSource={relationships}
          rowKey="id"
          pagination={false}
        />
      </Card>
      
      <Modal
        title="添加下级业务员"
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setIsModalVisible(false)}
        okText="确定"
        cancelText="取消"
        modalRender={(modal) => (
          <Draggable handle=".ant-modal-header">
            {modal}
          </Draggable>
        )}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddSubSalesman}
        >
          <Form.Item
            name="salesman"
            label="选择业务员"
            rules={[{ required: true, message: '请选择业务员' }]}
          >
            <Select placeholder="请选择业务员">
              {salesmen.map((item: Salesman) => (
                <Select.Option key={item.user_id} value={item.user_id}>
                  {item.user[0]?.email}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SalesmanRelationships