import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Typography, Table, Button, Input, Space, message, Spin, Empty, Statistic, Row, Col, Progress, Tag, InputNumber, Form, Tabs, Divider, Modal } from 'antd'
import { 
  ReloadOutlined, 
  SearchOutlined, 
  ShoppingCartOutlined, 
  TeamOutlined, 
  MoneyCollectOutlined, 
  ShoppingOutlined,
  InboxOutlined,
  CalculatorOutlined,
  EditOutlined,
  DollarOutlined,
  ToolOutlined,
  DownloadOutlined,
  SyncOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { customerApi } from '../../services/api'
import { procurementApi, ProcurementMaterial } from '../../services/procurementApi'
import { Customer } from '../../types'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { debounce } from 'lodash'

const { Title, Text } = Typography
const { TabPane } = Tabs

// 定义卡片样式
const CARD_STYLE = {
  height: '140px',
  display: 'flex' as const,
  flexDirection: 'column' as const,
  justifyContent: 'center' as const,
  boxShadow: '0 2px 8px rgba(0,0,0,0.09)',
  borderRadius: '8px',
  transition: 'all 0.3s',
  padding: '0 16px',
}

// 定义商品信息类型
interface Material {
  id: string;
  name: string;
  specs: string;
  perHousehold: number;
  price: number;
  warehouseInventory: number;  // 仓库余料
  editable?: boolean;
  isDirty?: boolean; // 标记是否有未保存的更改
}

// 采购计算结果类型
interface CalculationResult {
  id: string;
  name: string;
  specs: string;
  perHousehold: number;
  quantity: number;
  warehouseInventory: number;  // 仓库余料
  actualPurchase: number;      // 实际采购
  price: number;
  totalPrice: number;
}

// 为了防止初始加载时的闪烁，定义默认材料
const DEFAULT_MATERIALS: Material[] = [
  { id: '1', name: '南飞锌镁铝方矩管ZM275', specs: '100*100*2.0', perHousehold: 10, price: 180.11, warehouseInventory: 0 },
  { id: '2', name: '南飞锌镁铝方矩管ZM275', specs: '50*100*2.0', perHousehold: 10, price: 133.54, warehouseInventory: 0 },
  { id: '3', name: '南飞锌镁铝方矩管ZM275', specs: '40*60*2.0', perHousehold: 40, price: 85.62, warehouseInventory: 0 },
  { id: '4', name: '南飞锌镁铝方矩管ZM275', specs: '40*40*2.0', perHousehold: 6, price: 68.17, warehouseInventory: 0 },
  { id: '5', name: '南飞锌镁铝角钢光伏支架ZM275', specs: '40*40*2.5', perHousehold: 6, price: 46.84, warehouseInventory: 0 },
  { id: '6', name: '南飞柱底钢板Q235B', specs: '200*200*6', perHousehold: 25, price: 9.95, warehouseInventory: 0 },
  { id: '7', name: '南飞柱底加劲板Q235B', specs: '45*100*4.0', perHousehold: 40, price: 0.82, warehouseInventory: 0 },
  { id: '8', name: '南飞不锈钢膨胀螺栓SUS304', specs: 'M12*80', perHousehold: 100, price: 1.53, warehouseInventory: 0 },
  { id: '9', name: '南飞U型80防水压块组合', specs: 'U型螺栓:M8*50*105mm\n配套螺母\n上压块带刺片:80*52*2.5mm\n下垫板:70*28*2.5mm', perHousehold: 200, price: 1.43, warehouseInventory: 0 },
  { id: '10', name: '南飞阳光房四级纵向小水槽', specs: '2360mm', perHousehold: 45, price: 7.81, warehouseInventory: 0 },
  { id: '11', name: '南飞阳光房四级纵向中水槽', specs: '4000mm', perHousehold: 13, price: 31.54, warehouseInventory: 0 },
  { id: '12', name: '南飞阳光房四级主水槽', specs: '4000mm', perHousehold: 8, price: 57.05, warehouseInventory: 0 },
  { id: '13', name: '南飞阳光房阳光房四级横向小水槽', specs: '适用60*40檩条', perHousehold: 12, price: 31.84, warehouseInventory: 0 },
  { id: '14', name: '南飞阳光房四级包边水槽', specs: '适用60*40檩条', perHousehold: 15, price: 21.64, warehouseInventory: 0 },
  { id: '15', name: '南飞阳光房四级屋脊水槽', specs: '适用60*40檩条', perHousehold: 4, price: 35.82, warehouseInventory: 0 },
];

const ProcurementDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [savingData, setSavingData] = useState(false)
  const [activeTab, setActiveTab] = useState('1')
  
  // 采购计算相关状态
  const [materials, setMaterials] = useState<Material[]>([])
  const [households, setHouseholds] = useState<number>(1)
  const [calculationResults, setCalculationResults] = useState<CalculationResult[]>([])
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [tonnage, setTonnage] = useState<number>(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'perHousehold' | 'price' | 'warehouseInventory' | 'name' | 'specs' | null>(null)
  const [form] = Form.useForm()
  
  // 新增材料相关状态
  const [newMaterialModalVisible, setNewMaterialModalVisible] = useState(false)
  const [newMaterialForm] = Form.useForm()
  const [addingMaterial, setAddingMaterial] = useState(false)
  
  // 更新队列和锁
  const pendingUpdatesRef = useRef<Record<string, Partial<Material>>>({})
  const updateInProgressRef = useRef(false)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 从服务器加载材料数据
  const loadMaterials = async () => {
    setLoading(true)
    try {
      const data = await procurementApi.getMaterials()
      console.log('从API加载的材料数据:', data)
      
      // 记录材料顺序
      console.log('加载后的材料顺序:', data.map((m, i) => `${i+1}. ${m.name} - ${m.specs}`))
      
      if (data && data.length > 0) {
        // 将API返回的数据结构转换为Material类型并强制排序
        const materialData: Record<string, Material> = {};
        
        // 将数据转换为索引对象以便于查找
        data.forEach(item => {
          materialData[item.id] = {
            id: item.id,
            name: item.name,
            specs: item.specs,
            perHousehold: item.per_household,
            price: item.price,
            warehouseInventory: item.warehouse_inventory,
            isDirty: false
          };
        });
        
        // 定义特定材料的顺序映射
        const orderMapping: Record<string, number> = {};
        
        // 在这里寻找"南飞U型80防水压块组合"并标记为9号位置
        data.forEach(item => {
          if (item.name === '南飞U型80防水压块组合') {
            console.log('找到南飞U型80防水压块组合，ID:', item.id);
            orderMapping[item.id] = 9;
          } else if (item.name.includes('锌镁铝方矩管') && item.specs === '100*100*2.0') {
            orderMapping[item.id] = 1;
          } else if (item.name.includes('锌镁铝方矩管') && item.specs === '50*100*2.0') {
            orderMapping[item.id] = 2;
          } else if (item.name.includes('锌镁铝方矩管') && item.specs === '40*60*2.0') {
            orderMapping[item.id] = 3;
          } else if (item.name.includes('锌镁铝方矩管') && item.specs === '40*40*2.0') {
            orderMapping[item.id] = 4;
          } else if (item.name.includes('锌镁铝角钢')) {
            orderMapping[item.id] = 5;
          } else if (item.name.includes('柱底钢板')) {
            orderMapping[item.id] = 6;
          } else if (item.name.includes('柱底加劲板')) {
            orderMapping[item.id] = 7;
          } else if (item.name.includes('不锈钢膨胀螺栓')) {
            orderMapping[item.id] = 8;
          } else if (item.name.includes('纵向小水槽') && item.specs === '2360mm') {
            orderMapping[item.id] = 10;
          } else if (item.name.includes('纵向中水槽')) {
            orderMapping[item.id] = 11;
          } else if (item.name.includes('主水槽')) {
            orderMapping[item.id] = 12;
          } else if (item.name.includes('横向小水槽')) {
            orderMapping[item.id] = 13;
          } else if (item.name.includes('包边水槽')) {
            orderMapping[item.id] = 14;
          } else if (item.name.includes('屋脊水槽')) {
            orderMapping[item.id] = 15;
          }
        });
        
        // 按照顺序ID排序
        const sortedList = [...data].sort((a, b) => {
          const orderA = orderMapping[a.id] || 999;
          const orderB = orderMapping[b.id] || 999;
          return orderA - orderB;
        });
        
        console.log('排序后的顺序:', sortedList.map((item, index) => 
          `${index+1}. ${item.name} - ${item.specs} (顺序值: ${orderMapping[item.id] || 'undefined'})`
        ));
        
        // 转换为前端需要的格式
        const sortedMaterials = sortedList.map(item => materialData[item.id]);
        setMaterials(sortedMaterials);
      } else {
        setMaterials(DEFAULT_MATERIALS)
      }
    } catch (error) {
      console.error('加载材料失败:', error)
      setMaterials(DEFAULT_MATERIALS)
    } finally {
      setLoading(false)
    }
  }

  // 首次加载数据
  useEffect(() => {
    loadMaterials()
    
    // 组件卸载时清除所有定时器
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  // 计算用料和价格
  useEffect(() => {
    calculateMaterials()
  }, [households, materials])

  // 计算材料数量和价格
  const calculateMaterials = () => {
    console.log('开始计算材料，当前材料列表顺序:', materials.map(m => `${m.name} - ${m.specs}`));
    
    if (!households || isNaN(Number(households))) {
      message.warning('请输入有效的客户数量');
      return;
    }
    
    // 计算每种材料的数量和价格
    const results = materials.map((material, index) => {
      const quantity = households > 0 ? Math.ceil(material.perHousehold * households) : 0
      const actualPurchase = Math.max(0, quantity - material.warehouseInventory)
      const totalPrice = actualPurchase * material.price
      return {
        id: material.id,
        index: index + 1, // 添加序号
        name: material.name,
        specs: material.specs,
        perHousehold: material.perHousehold,
        quantity,
        warehouseInventory: material.warehouseInventory,
        actualPurchase,
        price: material.price,
        totalPrice
      }
    })

    // 计算总价格和吨数
    const total = results.reduce((sum, item) => sum + item.totalPrice, 0)
    const tons = total / 5055

    setCalculationResults(results)
    setTotalAmount(total)
    setTonnage(tons)
  }

  // 将更新同步到服务器
  const syncToServer = async () => {
    // 如果正在更新或没有待更新项，则返回
    if (updateInProgressRef.current || Object.keys(pendingUpdatesRef.current).length === 0) {
      return
    }
    
    // 设置更新锁
    updateInProgressRef.current = true
    setSavingData(true)
    
    try {
      console.log('向服务器同步更新')
      
      const updates = []
      
      // 遍历所有更新
      for (const id in pendingUpdatesRef.current) {
        const updateData = pendingUpdatesRef.current[id]
        
        // 创建更新请求
        const updateRequest: any = {
          id: id,
          updates: {}
        }
        
        // 转换字段名
        if ('perHousehold' in updateData) {
          updateRequest.updates.per_household = updateData.perHousehold
        }
        
        if ('price' in updateData) {
          updateRequest.updates.price = updateData.price
        }
        
        if ('warehouseInventory' in updateData) {
          updateRequest.updates.warehouse_inventory = updateData.warehouseInventory
        }
        
        if ('name' in updateData) {
          updateRequest.updates.name = updateData.name
        }
        
        if ('specs' in updateData) {
          updateRequest.updates.specs = updateData.specs
        }
        
        updates.push(updateRequest)
      }
      
      if (updates.length > 0) {
        // 逐一更新材料
        const success = await procurementApi.updateMaterialsOneByOne(updates)
        
        if (success) {
          console.log('更新成功')
          pendingUpdatesRef.current = {} // 清空待更新队列
          message.success('更新成功')
          
          // 标记材料不再为脏数据
          const updatedMaterials = materials.map(material => ({
            ...material,
            isDirty: false
          }))
          setMaterials(updatedMaterials)
        } else {
          console.error('部分材料更新失败')
          message.error('部分材料更新失败，请重试')
        }
      }
    } catch (error) {
      console.error('同步到服务器失败:', error)
      message.error('同步失败，请重试')
    } finally {
      // 释放更新锁
      updateInProgressRef.current = false
      setSavingData(false)
    }
  }

  // 使用防抖来减少频繁更新，改为1秒
  const debouncedSyncToServer = useCallback(debounce(syncToServer, 1000), [])

  // 更新材料使用信息
  const updateMaterialUsage = (id: string, field: 'perHousehold' | 'price' | 'warehouseInventory' | 'name' | 'specs', value: any) => {
    // 复制当前材料列表以进行更新
    const updatedMaterials = [...materials]
    const materialIndex = updatedMaterials.findIndex(item => item.id === id)
    
    if (materialIndex > -1) {
      // 创建材料副本
      const updatedMaterial = { ...updatedMaterials[materialIndex] }
      
      // 根据字段类型更新值
      if (field === 'name' || field === 'specs') {
        updatedMaterial[field] = value
      } else {
        updatedMaterial[field] = parseFloat(value)
      }
      
      // 标记为已修改
      updatedMaterial.isDirty = true
      
      // 更新材料列表
      updatedMaterials[materialIndex] = updatedMaterial
      setMaterials(updatedMaterials)
      
      // 将更新添加到队列
      pendingUpdatesRef.current[id] = {
        ...pendingUpdatesRef.current[id],
        [field]: field === 'name' || field === 'specs' ? value : parseFloat(value)
      }
      
      // 如果没有正在进行的同步，设置延迟同步
      if (!updateInProgressRef.current && syncTimeoutRef.current === null) {
        syncTimeoutRef.current = setTimeout(() => {
          syncToServer()
          syncTimeoutRef.current = null
        }, 2000) // 2秒后自动同步
      }
    }
  }

  // 开始编辑
  const startEditing = (id: string, field: 'perHousehold' | 'price' | 'warehouseInventory' | 'name' | 'specs') => {
    setEditingId(id)
    setEditingField(field)
    
    // 获取当前值填充到表单
    const material = materials.find(item => item.id === id)
    if (material) {
      form.setFieldsValue({
        [field]: material[field]
      })
    }
  }

  // 保存编辑
  const saveEdit = async (id: string) => {
    try {
      const values = await form.validateFields()
      const value = values[editingField!]
      
      // 更新材料使用数据
      updateMaterialUsage(id, editingField!, value)
      
      // 清除编辑状态
      setEditingId(null)
      setEditingField(null)
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setEditingField(null)
  }

  // 强制同步所有待更新数据
  const forceSyncToServer = () => {
    if (Object.keys(pendingUpdatesRef.current).length > 0) {
      syncToServer()
    } else {
      message.info('没有需要同步的数据')
    }
  }

  // 获取未保存更改的数量
  const getPendingUpdatesCount = () => {
    return Object.keys(pendingUpdatesRef.current).length
  }

  // 显示新增材料Modal
  const showNewMaterialModal = () => {
    newMaterialForm.resetFields()
    setNewMaterialModalVisible(true)
  }
  
  // 处理新增材料
  const handleAddMaterial = async () => {
    try {
      const values = await newMaterialForm.validateFields()
      setAddingMaterial(true)
      
      // 准备材料数据
      const newMaterial = {
        name: values.name,
        specs: values.specs,
        per_household: values.perHousehold,
        price: values.price,
        warehouse_inventory: values.warehouseInventory || 0,
        updated_at: new Date().toISOString()
      }
      
      // 调用API创建材料
      const result = await procurementApi.createMaterial(newMaterial)
      
      if (result) {
        // 添加到材料列表
        const createdMaterial: Material = {
          id: result.id,
          name: result.name,
          specs: result.specs,
          perHousehold: result.per_household,
          price: result.price,
          warehouseInventory: result.warehouse_inventory,
          isDirty: false
        }
        
        setMaterials([...materials, createdMaterial])
        
        message.success('新材料添加成功')
        setNewMaterialModalVisible(false)
      } else {
        message.error('添加材料失败')
      }
    } catch (error) {
      console.error('添加材料失败:', error)
      message.error('添加材料失败，请检查表单')
    } finally {
      setAddingMaterial(false)
    }
  }

  // 商品信息表格列定义
  const materialsColumns = [
    {
      title: '序号',
      key: 'index',
      width: 70,
      align: 'center' as const,
      render: (_: any, _record: Material, index: number) => (
        <div>
          <Tag color="blue">{index + 1}</Tag>
          {_record.isDirty && <SyncOutlined spin style={{ marginLeft: 5, color: '#1890ff' }} />}
        </div>
      )
    },
    {
      title: '货位名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Material) => {
        const isEditing = record.id === editingId && editingField === 'name';
        return isEditing ? (
          <Form form={form} component={false}>
            <Form.Item
              name="name"
              style={{ margin: 0 }}
              rules={[{ required: true, message: '请输入货位名称' }]}
            >
              <Input
                style={{ width: '100%' }}
                autoFocus
                onPressEnter={() => saveEdit(record.id)}
                onBlur={() => saveEdit(record.id)}
              />
            </Form.Item>
          </Form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>{text}</Text>
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => startEditing(record.id, 'name')} 
              size="small"
              style={{ marginLeft: 8 }}
            />
          </div>
        );
      }
    },
    {
      title: '规格型号',
      dataIndex: 'specs',
      key: 'specs',
      width: 200,
      render: (text: string, record: Material) => {
        const isEditing = record.id === editingId && editingField === 'specs';
        return isEditing ? (
          <Form form={form} component={false}>
            <Form.Item
              name="specs"
              style={{ margin: 0 }}
              rules={[{ required: true, message: '请输入规格型号' }]}
            >
              <Input.TextArea
                style={{ width: '100%' }}
                autoFocus
                autoSize={{ minRows: 2, maxRows: 6 }}
                onPressEnter={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveEdit(record.id);
                  }
                }}
                onBlur={() => saveEdit(record.id)}
              />
            </Form.Item>
          </Form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>{text}</Text>
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => startEditing(record.id, 'specs')} 
              size="small"
              style={{ marginLeft: 8 }}
            />
          </div>
        );
      }
    },
    {
      title: '每户用料',
      dataIndex: 'perHousehold',
      key: 'perHousehold',
      width: 120,
      align: 'center' as const,
      render: (text: number, record: Material) => {
        const isEditing = record.id === editingId && editingField === 'perHousehold'
        return isEditing ? (
          <Form form={form} component={false}>
            <Form.Item
              name="perHousehold"
              style={{ margin: 0 }}
              rules={[{ required: true, message: '请输入数量' }]}
            >
              <InputNumber 
                min={0} 
                precision={0} 
                style={{ width: '100%' }} 
                autoFocus
                onPressEnter={() => saveEdit(record.id)}
                onBlur={() => saveEdit(record.id)}
              />
            </Form.Item>
          </Form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tag color="green">{text}</Tag>
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => startEditing(record.id, 'perHousehold')} 
              size="small"
              style={{ marginLeft: 8 }}
            />
          </div>
        )
      },
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'center' as const,
      render: (text: number, record: Material) => {
        const isEditing = record.id === editingId && editingField === 'price'
        return isEditing ? (
          <Form form={form} component={false}>
            <Form.Item
              name="price"
              style={{ margin: 0 }}
              rules={[{ required: true, message: '请输入单价' }]}
            >
              <InputNumber 
                min={0} 
                precision={2} 
                style={{ width: '100%' }} 
                autoFocus
                onPressEnter={() => saveEdit(record.id)}
                onBlur={() => saveEdit(record.id)}
              />
            </Form.Item>
          </Form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="danger">{text.toFixed(2)}</Text>
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => startEditing(record.id, 'price')} 
              size="small"
              style={{ marginLeft: 8 }}
            />
          </div>
        )
      },
    }
  ]

  // 计算结果表格列定义
  const calculationColumns = [
    {
      title: '序号',
      key: 'index',
      width: 70,
      align: 'center' as const,
      render: (_: any, _record: CalculationResult, index: number) => (
        <Tag color="blue">{index + 1}</Tag>
      )
    },
    {
      title: '货位名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '规格型号',
      dataIndex: 'specs',
      key: 'specs',
      width: 200,
      render: (text: string) => (
        <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
          {text}
        </Text>
      )
    },
    {
      title: '每户用料',
      dataIndex: 'perHousehold',
      key: 'perHousehold',
      width: 100,
      align: 'center' as const,
      render: (text: number) => <Tag color="green">{text}</Tag>
    },
    {
      title: '仓库余料',
      dataIndex: 'warehouseInventory',
      key: 'warehouseInventory',
      width: 100,
      align: 'center' as const,
      render: (text: number, record: CalculationResult) => {
        const isEditing = record.id === editingId && editingField === 'warehouseInventory'
        return isEditing ? (
          <Form form={form} component={false}>
            <Form.Item
              name="warehouseInventory"
              style={{ margin: 0 }}
              rules={[{ required: true, message: '请输入余料数量' }]}
            >
              <InputNumber 
                min={0} 
                precision={0} 
                style={{ width: '100%' }} 
                autoFocus
                onPressEnter={() => saveEdit(record.id)}
                onBlur={() => saveEdit(record.id)}
              />
            </Form.Item>
          </Form>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tag color="blue">{text}</Tag>
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => startEditing(record.id, 'warehouseInventory')} 
              size="small"
              style={{ marginLeft: 8 }}
            />
          </div>
        )
      }
    },
    {
      title: '总用料',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center' as const,
      render: (text: number) => <Tag color="purple">{text}</Tag>
    },
    {
      title: '实际采购',
      dataIndex: 'actualPurchase',
      key: 'actualPurchase',
      width: 100,
      align: 'center' as const,
      render: (text: number) => <Tag color="orange">{text}</Tag>
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      align: 'right' as const,
      render: (text: number) => <Text type="secondary">{text.toFixed(2)}</Text>,
    },
    {
      title: '总价',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 120,
      align: 'right' as const,
      render: (text: number) => <Text type="danger" strong>{text.toFixed(2)}</Text>,
    }
  ]

  // 添加导出Excel功能
  const exportToExcel = () => {
    try {
      // 如果没有计算结果，则创建空的数据集
      if (calculationResults.length === 0) {
        message.info('暂无计算结果数据');
        return;
      }

      // 准备导出数据
      const exportData = calculationResults.map((item, index) => ({
        '序号': index + 1,
        '货位名称': item.name,
        '规格型号': item.specs.replace(/\n/g, ' '), // 将换行替换为空格
        '每户用料': item.perHousehold,
        '仓库余料': item.warehouseInventory,
        '总用料': item.quantity,
        '实际采购': item.actualPurchase,
        '单价': item.price,
        '总价': item.totalPrice
      }));

      // 添加总计行
      exportData.push({
        '序号': null,
        '货位名称': '总计',
        '规格型号': '',
        '每户用料': null,
        '仓库余料': null,
        '总用料': null,
        '实际采购': null,
        '单价': null,
        '总价': totalAmount
      });

      // 添加吨数行
      exportData.push({
        '序号': null,
        '货位名称': '吨数 (总价/5055)',
        '规格型号': '',
        '每户用料': null,
        '仓库余料': null,
        '总用料': null,
        '实际采购': null,
        '单价': null,
        '总价': tonnage
      });

      // 格式化数据的显示方式
      const workbookOptions = { bookType: 'xlsx', bookSST: false, type: 'binary' };
      
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // 设置列宽
      const colWidths = [
        { wch: 8 },  // 序号
        { wch: 25 }, // 货位名称
        { wch: 30 }, // 规格型号
        { wch: 10 }, // 每户用料
        { wch: 10 }, // 仓库余料
        { wch: 10 }, // 总用料
        { wch: 10 }, // 实际采购
        { wch: 10 }, // 单价
        { wch: 15 }  // 总价
      ];
      worksheet['!cols'] = colWidths;

      // 创建工作簿
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '用料计算');

      // 生成Excel文件并下载
      const excelFileName = `采购计算表_${dayjs().format('YYYY-MM-DD')}.xlsx`;
      XLSX.writeFile(workbook, excelFileName);

      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  // 材料表格操作区
  const materialsActionsRender = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
      <Space>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={loadMaterials}
          loading={loading}
        >
          刷新
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={showNewMaterialModal}
        >
          新增材料
        </Button>
      </Space>
      <Space>
        <Button 
          type="primary" 
          icon={<SyncOutlined />} 
          onClick={forceSyncToServer}
          loading={savingData}
          disabled={getPendingUpdatesCount() === 0}
        >
          保存修改 {getPendingUpdatesCount() > 0 && `(${getPendingUpdatesCount()})`}
        </Button>
      </Space>
    </div>
  )

  return (
    <div className="procurement-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={2} style={{ margin: 0 }}>
          <ShoppingCartOutlined style={{ marginRight: 12 }} />
          采购工作台
        </Title>
        
        <Space>
          {savingData ? (
            <Tag color="processing" icon={<SyncOutlined spin />}>正在保存数据...</Tag>
          ) : getPendingUpdatesCount() > 0 ? (
            <Button 
              type="primary" 
              icon={<SyncOutlined />} 
              onClick={forceSyncToServer}
            >
              立即同步 ({getPendingUpdatesCount()})
            </Button>
          ) : null}
          
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadMaterials}
            loading={loading}
          >
            刷新数据
          </Button>
        </Space>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        type="card"
        size="large"
        className="custom-tabs"
      >
        <TabPane 
          tab={<span><ToolOutlined /> 采购材料表</span>} 
          key="1"
        >
          {materialsActionsRender()}
          <Table
            columns={materialsColumns}
            dataSource={materials}
            rowKey="id"
            pagination={false}
            size="middle"
            scroll={{ y: 500 }}
            className="custom-table"
            rowClassName={() => 'material-row'}
            bordered
            onChange={() => {}}
          />
        </TabPane>

        <TabPane 
          tab={<span><CalculatorOutlined /> 用料计算</span>} 
          key="2"
        >
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <CalculatorOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                <span>用料计算工具</span>
              </div>
            }
            style={{ 
              boxShadow: '0 1px 2px -2px rgba(0, 0, 0, 0.16), 0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09)',
              borderRadius: '8px',
              marginBottom: 16
            }}
            extra={
              <Button 
                type="primary" 
                icon={<DownloadOutlined />} 
                onClick={exportToExcel}
              >
                导出Excel
              </Button>
            }
          >
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card bordered={false} className="calculator-card">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Text strong style={{ fontSize: '16px' }}>输入户数:</Text>
                    <InputNumber 
                      value={households} 
                      onChange={(value) => setHouseholds(value || 0)} 
                      min={0} 
                      step={0.1} 
                      style={{ width: '100%' }}
                      precision={1}
                      size="large"
                      addonBefore={<TeamOutlined />}
                    />
                  </div>
                </Card>
              </Col>
              
              <Col xs={24} sm={12} md={8} lg={6}>
                <Card 
                  bordered={false} 
                  className="result-card"
                  style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}
                >
                  <Statistic
                    title={<div style={{ fontSize: '16px', fontWeight: 'bold' }}><DollarOutlined /> 总价格 (元)</div>}
                    value={totalAmount}
                    precision={2}
                    valueStyle={{ color: '#cf1322', fontSize: '24px' }}
                    prefix="¥"
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <Card 
                  bordered={false} 
                  className="result-card"
                  style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}
                >
                  <Statistic
                    title={<div style={{ fontSize: '16px', fontWeight: 'bold' }}><InboxOutlined /> 吨数</div>}
                    value={tonnage}
                    precision={2}
                    valueStyle={{ color: '#3f8600', fontSize: '24px' }}
                    suffix="吨"
                  />
                </Card>
              </Col>
            </Row>

            <Divider style={{ margin: '24px 0' }} />

            <Table
              columns={calculationColumns}
              dataSource={calculationResults}
              rowKey="id"
              pagination={false}
              size="middle"
              scroll={{ y: 500 }}
              className="custom-table"
              bordered
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row className="summary-row">
                    <Table.Summary.Cell index={0} colSpan={6}>
                      <Text strong style={{ fontSize: '16px' }}>总计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: '16px', color: '#cf1322' }}>¥ {totalAmount.toFixed(2)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row className="summary-row">
                    <Table.Summary.Cell index={0} colSpan={6}>
                      <Text strong style={{ fontSize: '16px' }}>吨数 (总价/5055)</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: '16px', color: '#3f8600' }}>{tonnage.toFixed(2)} 吨</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* 新增材料Modal */}
      <Modal
        title="新增材料"
        open={newMaterialModalVisible}
        onOk={handleAddMaterial}
        onCancel={() => setNewMaterialModalVisible(false)}
        confirmLoading={addingMaterial}
        maskClosable={false}
      >
        <Form form={newMaterialForm} layout="vertical">
          <Form.Item
            name="name"
            label="货位名称"
            rules={[{ required: true, message: '请输入货位名称' }]}
          >
            <Input placeholder="请输入货位名称" />
          </Form.Item>
          <Form.Item
            name="specs"
            label="规格型号"
            rules={[{ required: true, message: '请输入规格型号' }]}
          >
            <Input.TextArea 
              placeholder="请输入规格型号" 
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          </Form.Item>
          <Form.Item
            name="perHousehold"
            label="每户用料"
            rules={[{ required: true, message: '请输入每户用料数量' }]}
          >
            <InputNumber 
              min={0} 
              precision={0} 
              style={{ width: '100%' }} 
              placeholder="请输入每户用料数量"
            />
          </Form.Item>
          <Form.Item
            name="price"
            label="单价"
            rules={[{ required: true, message: '请输入单价' }]}
          >
            <InputNumber 
              min={0} 
              precision={2} 
              style={{ width: '100%' }} 
              placeholder="请输入单价"
            />
          </Form.Item>
          <Form.Item
            name="warehouseInventory"
            label="仓库余料"
            initialValue={0}
          >
            <InputNumber 
              min={0} 
              precision={0} 
              style={{ width: '100%' }} 
              placeholder="请输入仓库余料数量（可选）"
            />
          </Form.Item>
        </Form>
      </Modal>

      <style>
        {`
         .procurement-dashboard .ant-card {
           transition: all 0.3s;
           margin-bottom: 16px;
         }
         .procurement-dashboard .calculator-card,
         .procurement-dashboard .result-card {
           height: 120px;
           display: flex;
           flex-direction: column;
           justify-content: center;
         }
         .procurement-dashboard .ant-card:hover {
           transform: translateY(-3px);
           box-shadow: 0 2px 10px rgba(0,0,0,0.12);
         }
         .ant-table-thead > tr > th {
           background: #f0f5ff;
           font-weight: 600;
         }
         .ant-tabs-tab.ant-tabs-tab-active {
           font-weight: 600;
         }
         .custom-tabs .ant-tabs-tab {
           padding: 12px 24px;
           transition: all 0.3s;
         }
         .custom-tabs .ant-tabs-tab:hover {
           color: #1890ff;
         }
         .custom-tabs .ant-tabs-tab-active {
           background: #e6f7ff;
           border-radius: 4px 4px 0 0;
         }
         .custom-table .ant-table-cell {
           padding: 12px 16px;
         }
         .material-row:hover {
           background-color: #f0f5ff;
         }
         .summary-row {
           background-color: #f6ffed;
         }
         .summary-row td {
           padding: 16px !important;
         }
         /* 修复滚动条样式 */
         .ant-table-body {
           overflow-y: auto !important;
           overflow-x: hidden !important;
           max-height: 500px !important;
         }
         .ant-table-body::-webkit-scrollbar {
           width: 8px;
           background-color: #f1f1f1;
         }
         .ant-table-body::-webkit-scrollbar-thumb {
           background-color: #bfbfbf;
           border-radius: 4px;
         }
         .ant-table-body::-webkit-scrollbar-track {
           background-color: #f1f1f1;
         }
         .ant-table-body::-webkit-scrollbar-button {
           display: block;
           height: 8px;
           background-color: #bfbfbf;
         }
         .ant-table-body::-webkit-scrollbar-button:start:decrement,
         .ant-table-body::-webkit-scrollbar-button:end:increment {
           display: block;
           height: 8px;
           background-color: #f1f1f1;
           background-repeat: no-repeat;
           background-position: center center;
         }
         .ant-table-body::-webkit-scrollbar-button:start:decrement {
           background-image: linear-gradient(to top, #bfbfbf 50%, transparent 50%);
           border-top-left-radius: 2px;
           border-top-right-radius: 2px;
         }
         .ant-table-body::-webkit-scrollbar-button:end:increment {
           background-image: linear-gradient(to bottom, #bfbfbf 50%, transparent 50%);
           border-bottom-left-radius: 2px;
           border-bottom-right-radius: 2px;
         }
        `}
      </style>
    </div>
  )
}

export default ProcurementDashboard