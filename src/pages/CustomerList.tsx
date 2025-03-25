import React, { useState, useEffect, useMemo } from 'react'
import { Table, Button, Input, Space, message, Modal, Tag, Tooltip, Typography, Upload, Drawer, Divider, Select, DatePicker, Form, Radio, InputNumber } from 'antd'
import { 
  PlusOutlined, 
  SearchOutlined, 
  ExportOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  ImportOutlined, 
  ClockCircleOutlined,
  FileExcelOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  RollbackOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { customerApi, constructionTeamApi, surveyorApi } from '../services/api'
import { Customer, ImportResult } from '../types'
import * as XLSX from 'xlsx'
import { useAuth } from '../contexts/AuthContext'
import dayjs from 'dayjs'
import type { UploadProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { calculateAllFields } from '../utils/calculationUtils'
import Draggable from 'react-draggable'
import { supabase } from '../services/supabase';

const { Title } = Typography
const { confirm } = Modal
const { Dragger } = Upload

// 更新出库状态类型定义
type OutboundStatus = 'none' | 'outbound' | 'inbound' | 'returned';

const CustomerList = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [modificationDrawerVisible, setModificationDrawerVisible] = useState(false)
  const [modificationRecords, setModificationRecords] = useState<any[]>([])
  const [editingCell, setEditingCell] = useState<{id: string, dataIndex: string} | null>(null)
  const [salesmenList, setSalesmenList] = useState<{name: string, phone: string}[]>([])
  const [editForm] = Form.useForm()
  const navigate = useNavigate()
  const { userRole } = useAuth()
  const STATION_MANAGEMENT_OPTIONS = [
    { value: '房产证', label: '房产证', color: 'blue' },
    { value: '授权书', label: '授权书', color: 'purple' },
    { value: '银行卡', label: '银行卡', color: 'cyan' },
    { value: '航拍', label: '航拍', color: 'green' },
    { value: '结构照', label: '结构照', color: 'magenta' },
    { value: '门头照', label: '门头照', color: 'orange' },
    { value: '合同', label: '合同', color: 'red' }
  ];

  // 定义图纸变更选项
  const DRAWING_CHANGE_OPTIONS = [
    { value: '无变更', label: '无变更', color: 'default' },
    { value: '变更1', label: '变更1', color: 'blue' },
    { value: '变更2', label: '变更2', color: 'purple' },
    { value: '变更3', label: '变更3', color: 'orange' },
    { value: '变更4', label: '变更4', color: 'red' },
    { value: '变更5', label: '变更5', color: 'volcano' },
  ];

  const [constructionTeams, setConstructionTeams] = useState<{name: string, phone: string}[]>([]);
  const [surveyors, setSurveyors] = useState<{ name: string; phone: string }[]>([])

  useEffect(() => {
    fetchCustomers()
    fetchConstructionTeams()
    fetchSurveyors()
  }, [])

  // 获取所有客户数据
  const fetchCustomers = async () => {
      setLoading(true)
    try {
      // 获取所有客户
      const data = await customerApi.getAll()
      
      // 应用计算字段
      const processedData = data.map(customer => {
        if (customer.module_count && customer.module_count > 0) {
          const calculatedFields = calculateAllFields(customer.module_count)
          return {
            ...customer,
            ...calculatedFields
          }
        }
        return customer
      })
      
      setCustomers(processedData)
      setFilteredCustomers(processedData)
      
      // 先从已有客户中提取业务员信息
      const salesmen = new Map<string, string>()
      processedData.forEach(customer => {
        if (customer.salesman && customer.salesman.trim() !== '') {
          salesmen.set(customer.salesman, customer.salesman_phone || '')
        }
      })
      
      // 再从user_roles表获取所有业务员信息
      try {
        const { data: salesmenData, error } = await supabase
          .from('user_roles')
          .select('name, phone, email, user_id')
          .eq('role', 'salesman');
        
        if (error) throw error;
        
        // 将从user_roles表获取的业务员信息合并到映射中
        if (salesmenData) {
          // 根据业务员表进行一次初始检查，将邮箱格式的业务员字段转换为姓名
          const salesmenEmailMap = new Map<string, {name: string, phone: string}>();
          
          salesmenData.forEach(salesman => {
            if (salesman.name && salesman.name.trim() !== '') {
              // 只有当salesmen中不存在此业务员或电话为空时才更新
              if (!salesmen.has(salesman.name) || !salesmen.get(salesman.name)) {
                salesmen.set(salesman.name, salesman.phone || '');
              }
              
              // 如果有邮箱，记录邮箱到姓名的映射
              if (salesman.email) {
                salesmenEmailMap.set(salesman.email, {
                  name: salesman.name,
                  phone: salesman.phone || ''
                });
              }
              
              // 如果有用户ID，也尝试获取关联邮箱
              if (salesman.user_id) {
                // 这里需要异步，但为了简单，我们会在后面单独更新包含邮箱的客户
                console.log('记录业务员ID关联:', salesman.user_id, salesman.name);
              }
            }
          });
          
          // 检查客户列表，更新所有使用邮箱作为业务员的记录
          let needUpdateCustomers = false;
          const updatedCustomers = processedData.map(customer => {
            if (customer.salesman && typeof customer.salesman === 'string' && customer.salesman.includes('@')) {
              const matchedSalesman = salesmenEmailMap.get(customer.salesman);
              if (matchedSalesman) {
                needUpdateCustomers = true;
                console.log(`发现业务员邮箱 ${customer.salesman}，自动转换为 ${matchedSalesman.name}`);
                
                // 立即更新业务员信息
                setTimeout(() => {
                  handleUpdateSalesmanName(customer.id as string, customer.salesman as string, matchedSalesman.name, matchedSalesman.phone || '');
                }, 0);
                
                // 返回更新后的客户对象
                return {
                  ...customer,
                  salesman: matchedSalesman.name,
                  salesman_phone: matchedSalesman.phone || customer.salesman_phone
                };
              }
            }
            return customer;
          });
          
          // 如果有更新，刷新客户列表
          if (needUpdateCustomers) {
            setCustomers(updatedCustomers);
            setFilteredCustomers(updatedCustomers);
          }
        }
      } catch (error) {
        console.error('获取业务员信息失败:', error);
      }
      
      const salesmenArray = Array.from(salesmen).map(([name, phone]) => ({
        name,
        phone
      }))
      
      setSalesmenList(salesmenArray)
    } catch (error) {
      message.error('获取客户数据失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // 获取施工队列表
  const fetchConstructionTeams = async () => {
    try {
      console.log('开始获取施工队数据...');
      
      // 从user_roles表获取施工队数据
      const teams = await constructionTeamApi.getFromUserRoles();
      console.log('从user_roles获取到的施工队数据:', teams);
      
      // 如果从user_roles获取的数据不为空，直接使用
      if (teams && teams.length > 0) {
        console.log('成功从user_roles获取施工队数据，使用该数据');
        setConstructionTeams(teams);
        return;
      }
      
      console.log('从user_roles获取的数据为空，从客户记录中提取');
      // 从客户数据中提取施工队信息
      const uniqueTeams = new Map<string, string>();
      
      customers.forEach(customer => {
        if (customer.construction_team && customer.construction_team.trim() !== '') {
          uniqueTeams.set(
            customer.construction_team,
            customer.construction_team_phone || ''
          );
        }
      });
      
      const extractedTeams = Array.from(uniqueTeams.entries()).map(([name, phone]) => ({
        name,
        phone
      }));
      
      console.log('从客户记录中提取的施工队:', extractedTeams);
      
      if (extractedTeams.length > 0) {
        setConstructionTeams(extractedTeams);
        return;
      }
      
      // 如果所有渠道都没有数据，使用默认值
      console.log('所有渠道都没有数据，使用默认施工队数据');
      setConstructionTeams([
        { name: '北城施工队', phone: '13800138001' },
        { name: '西城施工队', phone: '13800138002' }
      ]);
    } catch (error) {
      console.error('获取施工队列表失败:', error);
      message.error('获取施工队列表失败');
      
      // 发生错误时使用默认值
      setConstructionTeams([
        { name: '北城施工队', phone: '13800138001' },
        { name: '西城施工队', phone: '13800138002' }
      ]);
    }
  };

  // 获取踏勘员列表
  const fetchSurveyors = async () => {
    try {
      console.log('开始获取踏勘员数据...');
      
      // 从user_roles表获取踏勘员数据
      const surveyorList = await surveyorApi.getFromUserRoles();
      console.log('从user_roles获取到的踏勘员数据:', surveyorList);
      
      // 如果从user_roles获取的数据不为空，直接使用
      if (surveyorList && surveyorList.length > 0) {
        console.log('成功从user_roles获取踏勘员数据，使用该数据');
        setSurveyors(surveyorList);
        return;
      }
      
      console.log('从user_roles获取的数据为空，从客户记录中提取');
      // 从客户数据中提取踏勘员信息
      const uniqueSurveyors = new Map<string, string>();
      
      customers.forEach(customer => {
        if (customer.surveyor && customer.surveyor.trim() !== '') {
          uniqueSurveyors.set(
            customer.surveyor,
            customer.surveyor_phone || ''
          );
        }
      });
      
      const extractedSurveyors = Array.from(uniqueSurveyors.entries()).map(([name, phone]) => ({
        name,
        phone
      }));
      
      console.log('从客户记录中提取的踏勘员:', extractedSurveyors);
      
      if (extractedSurveyors.length > 0) {
        setSurveyors(extractedSurveyors);
        return;
      }
      
      // 如果所有渠道都没有数据，使用默认值
      console.log('所有渠道都没有数据，使用默认踏勘员数据');
      setSurveyors([
        { name: '李踏勘', phone: '13900139001' },
        { name: '王踏勘', phone: '13900139002' }
      ]);
    } catch (error) {
      console.error('获取踏勘员列表失败:', error);
      message.error('获取踏勘员列表失败');
      
      // 发生错误时使用默认值
      setSurveyors([
        { name: '李踏勘', phone: '13900139001' },
        { name: '王踏勘', phone: '13900139002' }
      ]);
    }
  };

  // 搜索功能
  const handleSearch = (value: string) => {
    setSearchText(value)
    if (!value.trim()) {
      setFilteredCustomers(customers)
      return
    }

    // 将搜索文本按空格或逗号分割成多个关键词
    const keywords = value.toLowerCase().split(/[\s,，]+/).filter(keyword => keyword.trim() !== '')
    
    // 如果没有有效关键词，显示所有客户
    if (keywords.length === 0) {
      setFilteredCustomers(customers)
      return
    }
    
    console.log('搜索关键词:', keywords, '客户总数:', customers.length)

    // 模糊搜索 - 匹配任意一个关键词
    const filtered = customers.filter(customer => {
      // 安全地检查字段是否包含关键词
      const safeIncludes = (fieldValue: any, keyword: string): boolean => {
        if (fieldValue === null || fieldValue === undefined) return false
        return String(fieldValue).toLowerCase().includes(keyword)
      }
      
      // 对每个关键词进行检查，任一关键词匹配即返回true
      return keywords.some(keyword => {
        if (!keyword) return false
        
        // 尝试搜索客户中的所有可能字段
        for (const key in customer) {
          // 跳过id和创建时间等非搜索字段
          if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;
          
          const value = (customer as any)[key];
          if (safeIncludes(value, keyword)) {
            console.log(`匹配到字段 ${key}:`, value);
            return true;
          }
        }
        
        return false;
      })
    })
    
    console.log(`搜索结果: ${filtered.length}条记录`)
    setFilteredCustomers(filtered)
    
    // 如果没有搜索结果，显示提示
    if (filtered.length === 0) {
      message.info(`未找到匹配"${value}"的客户记录`)
    }
  }

  // 判断单元格是否处于编辑状态
  const isEditing = (record: Customer, dataIndex: string) => {
    return record.id === editingCell?.id && dataIndex === editingCell?.dataIndex;
  };

  // 开始编辑单元格
  const edit = (record: Customer, dataIndex: string) => {
    try {
      if (!record.id) {
        console.error("编辑错误: 无效的记录ID");
        message.error("编辑失败: 无效的客户记录");
        return;
      }
      
      // 特殊处理日期字段
      if (dataIndex === 'register_date' || dataIndex === 'filing_date') {
        const dateValue = record[dataIndex as keyof Customer];
        let formattedDate = null;
        
        try {
          if (dateValue && typeof dateValue === 'string') {
            const date = dayjs(dateValue);
            if (date.isValid()) {
              formattedDate = date;
            }
          }
        } catch (err) {
          console.error(`日期解析错误: ${err}`);
        }
        
        editForm.setFieldsValue({
          [dataIndex]: formattedDate
        });
      } else {
        // 处理其他字段
        editForm.setFieldsValue({
          [dataIndex]: record[dataIndex as keyof Customer] || ''
        });
      }
      
      setEditingCell({id: record.id, dataIndex});
    } catch (error) {
      console.error("编辑字段错误:", error);
      message.error("编辑失败，请刷新页面重试");
    }
  };

  // 取消编辑
  const cancel = () => {
    setEditingCell(null);
  };

  // 保存编辑
  const save = async (id: string) => {
    try {
      if (!id) {
        console.error('保存错误: 无效的记录ID');
        message.error('保存失败: 记录标识无效');
        return;
      }

      const values = await editForm.validateFields();
      setLoading(true);

      if (editingCell) {
        let dataToUpdate: any = {};
        
        // 特殊处理补充资料字段
        if (editingCell.dataIndex === 'station_management') {
          // 处理补充资料选项
          if (values.station_management && values.station_management.length > 0) {
            // 用户选择了一个或多个选项，将其作为数组保存
            dataToUpdate.station_management = values.station_management;
          } else {
            // 如果没有选择任何选项，则生成当前时间戳
            dataToUpdate.station_management = [new Date().toISOString()];
          }
        }
        // 处理日期类型字段
        else if (editingCell.dataIndex === 'register_date' || editingCell.dataIndex === 'filing_date') {
          try {
            // 确保日期值有效且可以被转换
            if (values[editingCell.dataIndex]) {
              const dateValue = values[editingCell.dataIndex];
              console.log('保存日期字段:', editingCell.dataIndex, '原始值:', dateValue);
              
              if (dateValue.isValid && dateValue.isValid()) {
                // 直接使用YYYY-MM-DD格式存储日期字符串
                const dateStr = dateValue.format('YYYY-MM-DD');
                console.log('使用简单日期字符串:', dateStr);
                dataToUpdate[editingCell.dataIndex] = dateStr;
              } else {
                // 如果是无效日期格式，设置为当前日期
                const currentDate = dayjs().format('YYYY-MM-DD');
                console.log('日期无效，使用当前日期:', currentDate);
                dataToUpdate[editingCell.dataIndex] = currentDate;
                message.warning(`${editingCell.dataIndex === 'register_date' ? '登记日期' : '备案日期'}格式无效，已设置为当前日期`);
              }
            } else {
              console.log('日期值为空，设置为null');
              dataToUpdate[editingCell.dataIndex] = null;
            }
          } catch (error) {
            console.error("处理日期数据错误:", error);
            // 发生错误时设置为当前日期
            const errorDate = dayjs().format('YYYY-MM-DD');
            console.log('处理日期出错，使用当前日期:', errorDate);
            dataToUpdate[editingCell.dataIndex] = errorDate;
            message.warning(`${editingCell.dataIndex === 'register_date' ? '登记日期' : '备案日期'}处理出错，已设为当前日期`);
          }
        }
        // 处理价格字段
        else if (editingCell.dataIndex === 'price') {
          // 如果价格为空字符串，将其转换为null
          const priceValue = values.price?.trim ? values.price.trim() : values.price;
          if (priceValue === '' || priceValue === undefined) {
            dataToUpdate.price = null;
          } else {
            // 尝试转换为数字
            const numValue = Number(priceValue);
            if (isNaN(numValue)) {
              message.error('价格必须是有效的数字');
              return;
            }
            dataToUpdate.price = numValue;
          }
        }
        // 处理图纸变更字段
        else if (editingCell.dataIndex === 'drawing_change') {
          // 强制将图纸变更值转换为字符串类型
          let changeValue = '';
          
          if (values.drawing_change === null || values.drawing_change === undefined) {
            changeValue = '无变更';
          } else if (typeof values.drawing_change === 'boolean') {
            changeValue = values.drawing_change ? '变更1' : '无变更';
          } else {
            // 确保是字符串
            changeValue = String(values.drawing_change);
            // 如果是空字符串，设为默认值
            if (!changeValue.trim()) {
              changeValue = '无变更';
            }
          }
          
          console.log('保存图纸变更值类型:', typeof changeValue, '值:', changeValue);
          // 确保传递的是字符串
          dataToUpdate.drawing_change = changeValue;
        }
        // 如果修改的是业务员，同步更新业务员电话
        else if (editingCell.dataIndex === 'salesman') {
          const salesmanValue = values.salesman;
          
          // 处理空值情况
          if (salesmanValue === '' || salesmanValue === undefined || salesmanValue === null) {
            console.log('清空业务员信息');
            dataToUpdate = {
              salesman: null, // 明确设置为null，确保数据库能识别为空值
              salesman_phone: null // 同时清空业务员电话
            };
          } else {
            // 查找业务员电话
            const salesmanPhone = salesmenList.find(s => s.name === salesmanValue)?.phone || '';
            
            dataToUpdate = {
              salesman: salesmanValue,
              salesman_phone: salesmanPhone
            };
            
            console.log(`匹配到业务员 ${salesmanValue} 的电话: ${salesmanPhone || '无'}`);
          }
          
          console.log('更新业务员:', dataToUpdate.salesman, '电话:', dataToUpdate.salesman_phone);
        }
        // 如果修改的是施工队，根据需要设置或清空派工日期
        else if (editingCell.dataIndex === 'construction_team') {
          const constructionTeam = values.construction_team;
          
          // 处理空值情况
          if (constructionTeam === '' || constructionTeam === undefined || constructionTeam === null) {
            console.log('清空施工队信息');
            dataToUpdate = {
              construction_team: null, // 明确设置为null，确保数据库能识别为空值
              construction_team_phone: null // 同时清空施工队电话
            };
          } else {
            // 查找施工队电话
            const teamPhone = constructionTeams.find(team => team.name === constructionTeam)?.phone || '';
            
            // 手动处理施工队电话，不再依赖数据库触发器
            dataToUpdate = {
              construction_team: constructionTeam,
              construction_team_phone: teamPhone
            };
            
            console.log(`匹配到施工队 ${constructionTeam} 的电话: ${teamPhone || '无'}`);
          }
          
          console.log('更新施工队:', dataToUpdate.construction_team, '电话:', dataToUpdate.construction_team_phone);
        }
        // 如果修改的是踏勘员，同步更新踏勘员电话
        else if (editingCell.dataIndex === 'surveyor') {
          const surveyor = values.surveyor;
          
          // 处理空值情况
          if (surveyor === '' || surveyor === undefined || surveyor === null) {
            console.log('清空踏勘员信息');
            dataToUpdate = {
              surveyor: null, // 明确设置为null，确保数据库能识别为空值
              surveyor_phone: null // 同时清空踏勘员电话
            };
          } else {
            // 查找踏勘员电话
            const surveyorPhone = surveyors.find(s => s.name === surveyor)?.phone || '';
            
            dataToUpdate = {
              surveyor: surveyor,
              surveyor_phone: surveyorPhone
            };
            
            console.log(`匹配到踏勘员 ${surveyor} 的电话: ${surveyorPhone || '无'}`);
          }
          
          console.log('更新踏勘员:', dataToUpdate.surveyor, '电话:', dataToUpdate.surveyor_phone);
        }
        // 如果修改的是公司字段
        else if (editingCell.dataIndex === 'company') {
          // 确保公司字段值符合数据库约束
          let companyValue = values.company;
          if (companyValue !== '昊尘' && companyValue !== '祐之') {
            companyValue = '昊尘'; // 默认值
          }
          
          dataToUpdate = {
            company: companyValue
          };
          
          console.log('更新公司:', companyValue);
        }
        // 常规字段处理
        else {
          dataToUpdate = {
            [editingCell.dataIndex]: values[editingCell.dataIndex]
          };
        }
        
        // 特殊处理组件数量字段，自动计算相关字段
        if (editingCell.dataIndex === 'module_count' && values.module_count) {
          const moduleCount = Number(values.module_count);
          if (!isNaN(moduleCount) && moduleCount > 0) {
            const calculatedFields = calculateAllFields(moduleCount);
            dataToUpdate = {
              ...dataToUpdate,
              ...calculatedFields
            };
          }
        }
        
        console.log('发送到API的更新数据:', JSON.stringify(dataToUpdate));
        try {
          await customerApi.update(id, dataToUpdate)
          fetchCustomers()
          message.success('更新成功')
        } catch (error) {
          console.error('更新失败:', error)
          message.error('更新失败')
        }
        
        // 退出编辑状态
        setEditingCell(null)
      }
    } catch (error) {
      console.error('保存错误:', error)
      message.error('保存失败')
    } finally {
      setLoading(false)
    }
  };

  // 删除客户
  const handleDelete = (id: string, customerName: string) => {
    confirm({
      title: '确认删除',
      content: `确定要删除客户 "${customerName}" 吗？此操作不可恢复！`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await customerApi.delete(id)
          message.success('客户删除成功')
          fetchCustomers()
        } catch (error) {
          message.error('删除客户失败')
          console.error(error)
        }
      }
    })
  }

  // 导出客户数据
  const handleExport = () => {
    try {
      // 准备要导出的数据
      const exportData = filteredCustomers.map(customer => ({
        '登记日期': customer.register_date ? dayjs(customer.register_date).format('YYYY-MM-DD') : '',
        '客户姓名': customer.customer_name,
        '客户电话': customer.phone,
        '地址': customer.address,
        '身份证号': customer.id_card,
        '业务员': customer.salesman,
        '业务员电话': customer.salesman_phone,
        '补充资料': typeof customer.station_management === 'string' ? customer.station_management : '',
        '备案日期': customer.filing_date ? dayjs(customer.filing_date).format('YYYY-MM-DD') : '',
        '电表号码': customer.meter_number,
        '设计师': customer.designer,
        '图纸变更': customer.drawing_change || '无变更',
        '催单': customer.urge_order ? dayjs(customer.urge_order).format('YYYY-MM-DD HH:mm') : '',
        '容量(KW)': customer.capacity,
        '投资金额': customer.investment_amount,
        '用地面积(m²)': customer.land_area,
        '组件数量': customer.module_count,
        '逆变器': customer.inverter,
        '铜线': customer.copper_wire,
        '铝线': customer.aluminum_wire,
        '配电箱': customer.distribution_box,
        '方钢出库日期': customer.square_steel_outbound_date ? 
          (customer.square_steel_outbound_date === 'RETURNED' ? '退单' : dayjs(customer.square_steel_outbound_date).format('YYYY-MM-DD')) : '',
        '组件出库日期': customer.component_outbound_date ? 
          (customer.component_outbound_date === 'RETURNED' ? '退单' : dayjs(customer.component_outbound_date).format('YYYY-MM-DD')) : '',
        '派工日期': customer.dispatch_date ? dayjs(customer.dispatch_date).format('YYYY-MM-DD') : '',
        '施工队': customer.construction_team,
        '施工状态': customer.construction_status ? dayjs(customer.construction_status).format('YYYY-MM-DD') : '',
        '大线': customer.main_line,
        '技术审核': customer.technical_review ? dayjs(customer.technical_review).format('YYYY-MM-DD HH:mm') : '',
        '上传国网': customer.upload_to_grid ? dayjs(customer.upload_to_grid).format('YYYY-MM-DD HH:mm') : '',
        '建设验收': customer.construction_acceptance ? dayjs(customer.construction_acceptance).format('YYYY-MM-DD HH:mm') : '',
        '挂表日期': customer.meter_installation_date ? dayjs(customer.meter_installation_date).format('YYYY-MM-DD HH:mm') : '',
        '购售电合同': customer.power_purchase_contract ? dayjs(customer.power_purchase_contract).format('YYYY-MM-DD HH:mm') : '',
        '状态': customer.status,
        '价格': customer.price,
        '公司': customer.company,
        '备注': customer.remarks
      }))

      // 创建工作簿和工作表
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // 将工作表添加到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '客户数据')

      // 保存文件
      XLSX.writeFile(wb, `客户数据_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`)
      message.success('导出成功')
    } catch (error) {
      message.error('导出失败')
      console.error(error)
    }
  }

  // 处理导入配置
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv,.xlsx,.xls',
    showUploadList: false,
    beforeUpload: (file) => {
      // 验证文件类型
      const isValidFileType = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                             file.type === 'application/vnd.ms-excel' || 
                             file.name.endsWith('.csv')
      if (!isValidFileType) {
        message.error('请上传Excel或CSV文件！')
        return Upload.LIST_IGNORE
      }
      
      // 处理文件上传
      setImportLoading(true)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)
          
          // 导入数据
          handleImportData(jsonData)
        } catch (error) {
          message.error('解析文件失败')
          console.error(error)
          setImportLoading(false)
        }
      }
      reader.readAsArrayBuffer(file)
      return false // 阻止默认上传行为
    }
  }

  // 处理导入数据
  const handleImportData = async (data: any[]) => {
    try {
      // 准备导入结果
      const result: ImportResult = {
        total: data.length,
        success: 0,
        duplicate: 0,
        failed: 0,
        failedItems: []
      }

      // 处理每条数据
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        
        // 验证必填字段
        const missingFields = []
        if (!row['客户姓名']) missingFields.push('客户姓名')
        if (!row['客户电话']) missingFields.push('客户电话')
        if (!row['地址']) missingFields.push('地址')
        if (!row['身份证号']) missingFields.push('身份证号')
        if (!row['业务员']) missingFields.push('业务员')
        
        if (missingFields.length > 0) {
          result.failed++
          result.failedItems?.push({
            row: i + 2, // Excel从1开始，标题行占1行
            reason: `缺少必填字段（${missingFields.join('、')}）`
          })
          continue
        }

        // 准备客户数据
        const customerData: Partial<Customer> = {
          register_date: row['登记日期'] ? dayjs(row['登记日期']).format() : new Date().toISOString(),
          customer_name: row['客户姓名'],
          phone: row['客户电话'] || '',
          address: row['地址'] || '',
          id_card: row['身份证号'] || '',
          salesman: row['业务员'] || '',
          salesman_phone: row['业务员电话'] || '',
          filing_date: row['备案日期'] ? dayjs(row['备案日期']).format() : null,
          meter_number: row['电表号码'] || '',
          designer: row['设计师'] || '',
          module_count: parseInt(row['组件数量']) || 1, // 默认为1，避免0值导致计算错误
          status: row['状态'] || '待处理',
          company: row['公司'] === '昊尘' ? 'haoChen' : (row['公司'] === '祐之' ? 'youZhi' : 'haoChen') // 默认为昊尘
        }
        
        // 计算相关字段
        if (customerData.module_count && customerData.module_count > 0) {
          const calculatedFields = calculateAllFields(customerData.module_count)
          Object.assign(customerData, calculatedFields)
        }
        
        try {
          // 尝试创建客户
          await customerApi.create(customerData as any)
          result.success++
        } catch (error: any) {
          // 处理重复客户
          if (error.code === '23505') {
            result.duplicate++
          } else {
            result.failed++
            let errorMessage = '未知错误'
            
            // 提取更详细的错误信息
            if (error.message) {
              if (error.message.includes('duplicate key')) {
                errorMessage = '客户数据重复'
              } else if (error.message.includes('violates not-null')) {
                // 提取具体的字段名称
                const fieldMatch = error.message.match(/column "([^"]+)"/) 
                const fieldName = fieldMatch ? fieldMatch[1] : '未知字段'
                errorMessage = `缺少必填字段 (${fieldName})` 
              } else if (error.message.includes('invalid input syntax')) {
                errorMessage = '数据格式错误'
              } else {
                errorMessage = error.message
              }
            }
            
            console.error('导入失败详情:', error)
            
            result.failedItems?.push({
              row: i + 2,
              reason: `导入失败: ${errorMessage}`
            })
          }
        }
      }
      
      // 更新导入结果
      setImportResult(result)
      
      // 刷新客户列表
      if (result.success > 0) {
        fetchCustomers()
      }
    } catch (error) {
      message.error('导入失败')
      console.error(error)
    } finally {
      setImportLoading(false)
    }
  }

  // 获取修改记录
  const fetchModificationRecords = async () => {
    try {
      const records = await customerApi.getModificationRecords()
      setModificationRecords(records)
    } catch (error) {
      console.error('获取修改记录失败:', error)
      message.error('获取修改记录失败')
    }
  }

  // 显示修改记录抽屉
  const showModificationDrawer = () => {
    fetchModificationRecords()
    setModificationDrawerVisible(true)
  }

  // 可编辑单元格组件
  const EditableCell = ({ value, record, dataIndex, title, required = true }: { value: any; record: Customer; dataIndex: string; title: string; required?: boolean }) => {
    const editable = isEditing(record, dataIndex);
    const [hover, setHover] = useState(false);
    
    return editable ? (
      <Form.Item
        name={dataIndex}
        style={{ margin: 0 }}
        rules={required ? [{ required: true, message: `请输入${title}` }] : []}
      >
        <Input 
          onPressEnter={() => record.id && save(record.id)} 
          placeholder={required ? `请输入${title}` : `${title}(可选)`}
          autoFocus
          onBlur={() => record.id && save(record.id)}
          allowClear={!required}
        />
      </Form.Item>
    ) : (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: '4px 0',
          borderRadius: 4,
          cursor: editingCell === null ? 'pointer' : 'default',
          background: hover ? '#f0f5ff' : 'transparent'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => editingCell === null && edit(record, dataIndex)}
      >
        <div style={{ flex: 1 }}>
          {value ? (
            <span>{value}</span>
          ) : (
            <span style={{ color: '#999' }}>-</span>
          )}
        </div>
        {hover && editingCell === null && (
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => edit(record, dataIndex)}
            style={{ padding: '0 4px' }}
            title={`编辑${title}`}
          />
        )}
      </div>
    );
  };

  // 添加可编辑下拉单元格组件
  const EditableSelectCell = ({ value, record, dataIndex, title, options }: { 
    value: any; 
    record: Customer; 
    dataIndex: string; 
    title: string; 
    options: {value: string, label: string, phone?: string}[] 
  }) => {
    const editable = isEditing(record, dataIndex);
    const [hover, setHover] = useState(false);
    
    return editable ? (
      <Form.Item
        name={dataIndex}
        style={{ margin: 0 }}
        rules={[{ 
          required: dataIndex !== 'salesman', 
          message: `请选择或输入${title}` 
        }]}
      >
        <Select
          placeholder={`请选择或输入${title}`}
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={options}
          onBlur={() => record.id && save(record.id)}
          onSelect={(value) => {
            if (dataIndex === 'salesman') {
              const phone = options.find(o => o.value === value)?.phone || '';
              editForm.setFieldsValue({ salesman_phone: phone });
            }
            
            // 针对图纸变更字段，确保始终是字符串
            if (dataIndex === 'drawing_change') {
              console.log('选择图纸变更值:', value, '类型:', typeof value);
              // 如果为空，设置为默认值
              if (value === null || value === undefined || value === '') {
                editForm.setFieldsValue({ drawing_change: '无变更' });
              }
            }
          }}
        />
      </Form.Item>
    ) : (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: '4px 0',
          borderRadius: 4,
          cursor: editingCell === null ? 'pointer' : 'default',
          background: hover ? '#f0f5ff' : 'transparent'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => editingCell === null && edit(record, dataIndex)}
      >
        <div style={{ flex: 1 }}>
          {value ? (
            <span>{value}</span>
          ) : (
            <span style={{ color: '#999' }}>-</span>
          )}
        </div>
        {hover && editingCell === null && (
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => edit(record, dataIndex)}
            style={{ padding: '0 4px' }}
            title={`编辑${title}`}
          />
        )}
      </div>
    );
  };

  // 添加可编辑多选下拉单元格组件
  const EditableMultipleSelectCell = ({ value, record, dataIndex, title, options }: { 
    value: any; 
    record: Customer; 
    dataIndex: string; 
    title: string; 
    options: {value: string, label: string, color?: string}[] 
  }) => {
    const editable = isEditing(record, dataIndex);
    const [hover, setHover] = useState(false);
    
    // 解析当前值，可能是数组、逗号分隔的字符串或时间戳
    const parseValue = (val: any) => {
      if (!val) return [];
      
      // 如果已经是数组格式
      if (Array.isArray(val)) {
        // 检查数组中是否有时间戳（单个元素且是时间格式）
        if (val.length === 1 && dayjs(val[0]).isValid()) {
          return []; // 是时间戳，返回空数组表示没有选择项
        }
        return val; // 返回数组选项
      }
      
      // 处理字符串格式（兼容旧数据）
      if (typeof val === 'string') {
        // 检查是否是逗号分隔的字符串（选项列表）
        if (val.includes(',')) {
          return val.split(',');
        }
        // 如果是时间戳，返回空数组
        if (dayjs(val).isValid()) {
          return [];
        }
        // 单个选项
        return [val];
      }
      
      return [];
    };
    
    // 判断是否是时间戳
    const isTimestamp = (val: any) => {
      if (!val) return false;
      
      // 数组格式：如果是数组且只有一个元素，检查元素是否是时间戳
      if (Array.isArray(val) && val.length === 1) {
        return dayjs(val[0]).isValid();
      }
      
      // 字符串格式：检查是否是时间戳
      if (typeof val === 'string' && !val.includes(',')) {
        return dayjs(val).isValid();
      }
      
      return false;
    };

    // 解析当前值，获取选项数组（如果是选项列表）或空数组（如果是时间戳）
    const parsedValue = parseValue(value);
    
    return editable ? (
      <Form.Item
        name={dataIndex}
        style={{ margin: 0 }}
        initialValue={parsedValue}
      >
        <Select
          mode="multiple"
          placeholder={`请选择${title}，若不选择将显示时间戳`}
          autoFocus
          allowClear
          style={{ width: '100%' }}
          options={options}
          onBlur={() => record.id && save(record.id)}
        />
      </Form.Item>
    ) : (
      <div 
        style={{ 
          display: 'flex', 
          flexWrap: 'nowrap',
          alignItems: 'center',
          padding: '4px 0',
          borderRadius: 4,
          cursor: editingCell === null ? 'pointer' : 'default',
          background: hover ? '#f0f5ff' : 'transparent'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => editingCell === null && edit(record, dataIndex)}
      >
        <div style={{ flex: 1, display: 'flex', flexWrap: 'nowrap', gap: '1px', overflow: 'hidden' }}>
          {parsedValue.length > 0 ? (
            // 如果有选择项，显示带颜色的标签
            parsedValue.map((item: string) => {
              const option = options.find(o => o.value === item);
              return (
                <Tag key={item} color={option?.color || 'default'} style={{ margin: '0 1px 0 0', padding: '0 4px' }}>
                  {item}
                </Tag>
              );
            })
          ) : isTimestamp(value) ? (
            // 如果是时间戳（没有选择任何选项），显示时间戳
            <Tag color="green">
              <ClockCircleOutlined /> 
              {Array.isArray(value) && value.length === 1 
                ? dayjs(value[0]).format('YYYY-MM-DD HH:mm')
                : typeof value === 'string' ? dayjs(value).format('YYYY-MM-DD HH:mm') : ''}
            </Tag>
          ) : (
            // 如果没有值，显示未设置
            <span style={{ color: '#999', fontStyle: 'italic' }}>未设置</span>
          )}
        </div>
        {hover && editingCell === null && (
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => edit(record, dataIndex)}
            style={{ padding: '0 4px' }}
            title={`编辑${title}`}
          />
        )}
      </div>
    );
  };

  // 添加可编辑日期选择单元格组件 - 重写版本
  const EditableDateCell = ({ value, record, dataIndex, title }: { 
    value: any; 
    record: Customer; 
    dataIndex: string; 
    title: string; 
  }) => {
    const editable = isEditing(record, dataIndex);
    const [hover, setHover] = useState(false);
    
    // 安全地转换日期值，避免无效日期导致错误
    const safeDate = useMemo(() => {
      try {
        // 确保值存在且可以被dayjs解析
        if (value && dayjs(value).isValid()) {
          return dayjs(value);
        }
        return null;
      } catch (e) {
        console.error("日期解析错误:", e);
        return null;
      }
    }, [value]);
    
    const handleEdit = () => {
      try {
        if (editingCell === null) {
          edit(record, dataIndex);
        }
      } catch (e) {
        console.error("编辑日期字段错误:", e);
        message.error("编辑日期失败，请刷新页面重试");
      }
    };
    
    // 完全改写的保存方法
    const handleDateChange = async (date: any) => {
      if (!date) return;
      
      console.log(`修改${title}:`, date);
      try {
        setLoading(true);
        
        // 直接构建更新对象
        const updateObj = {
          [dataIndex]: date.toISOString()
        };
        
        console.log('发送更新请求:', updateObj);
        
        // 直接调用API
        if (record.id) {
          const result = await customerApi.update(record.id, updateObj);
          console.log('更新结果:', result);
          
          message.success(`${title}更新成功`);
          setEditingCell(null); // 退出编辑状态
          
          // 更新本地数据
          fetchCustomers();
        } else {
          console.error('记录ID无效，无法更新');
          message.error('保存失败: 无效的记录');
        }
      } catch (error) {
        console.error('保存日期失败:', error);
        message.error(`保存${title}失败`);
      } finally {
        setLoading(false);
      }
    };
    
    return editable ? (
      <DatePicker 
        style={{ width: '100%' }} 
        format="YYYY-MM-DD"
        defaultValue={safeDate}
        open={true} // 自动打开日期选择器
        onChange={handleDateChange} // 选择日期时就保存
        onBlur={() => setEditingCell(null)} // 失焦时退出编辑
      />
    ) : (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: '4px 0',
          borderRadius: 4,
          cursor: editingCell === null ? 'pointer' : 'default',
          background: hover ? '#f0f5ff' : 'transparent'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={handleEdit}
      >
        <div style={{ flex: 1 }}>
          {safeDate ? (
            <span>{safeDate.format('YYYY-MM-DD')}</span>
          ) : (
            <span style={{ color: '#999', fontStyle: 'italic' }}>未设置</span>
          )}
        </div>
        {hover && editingCell === null && (
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />}
            onClick={handleEdit}
            style={{ padding: '0 4px' }}
            title={`编辑${title}`}
          />
        )}
      </div>
    );
  };

  // 表格列定义
  const columns: ColumnsType<Customer> = [
    {
      title: '登记日期',
      dataIndex: 'register_date',
      key: 'register_date',
      width: 120,
      sorter: (a, b) => {
        if (!a.register_date && !b.register_date) return 0
        if (!a.register_date) return -1
        if (!b.register_date) return 1
        return new Date(a.register_date).getTime() - new Date(b.register_date).getTime()
      },
      render: (value, record) => (
        <EditableDateCell 
          value={value} 
          record={record} 
          dataIndex="register_date" 
          title="登记日期" 
        />
      ),
      ellipsis: true,
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      fixed: 'left',
      width: 120,
      sorter: (a, b) => a.customer_name.localeCompare(b.customer_name),
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="customer_name" title="客户姓名" />
    },
    {
      title: '客户电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      sorter: (a, b) => (a.phone || '').localeCompare(b.phone || ''),
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="phone" title="客户电话" required={false} />
    },
    {
      title: '客户地址',
      dataIndex: 'address',
      key: 'address',
      width: 200,
      sorter: (a, b) => (a.address || '').localeCompare(b.address || ''),
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="address" title="客户地址" required={false} />
    },
    {
      title: '身份证号',
      dataIndex: 'id_card',
      key: 'id_card',
      width: 180,
      sorter: (a, b) => (a.id_card || '').localeCompare(b.id_card || ''),
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="id_card" title="身份证号" required={false} />
    },
    {
      title: '业务员',
      dataIndex: 'salesman',
      key: 'salesman',
      width: 120,
      sorter: (a, b) => (a.salesman || '').localeCompare(b.salesman || ''),
      ellipsis: true,
      render: (value, record) => {
        // 检查是否是邮箱格式
        const isEmail = value && typeof value === 'string' && value.includes('@');
        
        if (isEmail) {
          // 获取邮箱对应的业务员姓名
          // 从业务员列表中查找电子邮件（使用字符串匹配）
          const matchedSalesman = salesmenList.find(s => value === s.name);
          if (matchedSalesman) {
            // 找到对应的业务员，同时更新数据
            setTimeout(() => {
              handleUpdateSalesmanName(record.id as string, value, matchedSalesman.name, matchedSalesman.phone || '');
            }, 0);
            
            // 立即显示真实姓名
            return (
              <EditableSelectCell 
                value={matchedSalesman.name} 
                record={{...record, salesman: matchedSalesman.name}} 
                dataIndex="salesman" 
                title="业务员" 
                options={salesmenList.map(s => ({ value: s.name, label: s.name, phone: s.phone }))}
              />
            );
          }
        }
        
        // 默认渲染
        return (
          <EditableSelectCell 
            value={value} 
            record={record} 
            dataIndex="salesman" 
            title="业务员" 
            options={salesmenList.map(s => ({ value: s.name, label: s.name, phone: s.phone }))}
          />
        );
      }
    },
    {
      title: '业务员电话',
      dataIndex: 'salesman_phone',
      key: 'salesman_phone',
      width: 150,
      sorter: (a, b) => (a.salesman_phone || '').localeCompare(b.salesman_phone || ''),
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="salesman_phone" title="业务员电话" required={false} />
    },
    {
      title: '踏勘员',
      dataIndex: 'surveyor',
      key: 'surveyor',
      width: 120,
      sorter: (a, b) => (a.surveyor || '').localeCompare(b.surveyor || ''),
      ellipsis: true,
      render: (value, record) => <SurveyorCell value={value} record={record} />
    },
    {
      title: '踏勘员电话',
      dataIndex: 'surveyor_phone',
      key: 'surveyor_phone',
      width: 150,
      sorter: (a, b) => (a.surveyor_phone || '').localeCompare(b.surveyor_phone || ''),
      ellipsis: true,
      render: (value, record) => <SurveyorPhoneCell value={value} record={record} />
    },
    {
      title: '补充资料',
      dataIndex: 'station_management',
      key: 'station_management',
      width: 200,
      render: (text, record) => (
        <EditableMultipleSelectCell 
          value={text} 
          record={record} 
          dataIndex="station_management" 
          title="补充资料" 
          options={STATION_MANAGEMENT_OPTIONS}
        />
      ),
      ellipsis: true,
    },
    {
      title: '备案日期',
      dataIndex: 'filing_date',
      key: 'filing_date',
      width: 130,
      sorter: (a, b) => {
        if (!a.filing_date && !b.filing_date) return 0
        if (!a.filing_date) return -1
        if (!b.filing_date) return 1
        return new Date(a.filing_date).getTime() - new Date(b.filing_date).getTime()
      },
      render: (value, record) => (
        <EditableDateCell 
          value={value} 
          record={record} 
          dataIndex="filing_date" 
          title="备案日期" 
        />
      ),
      ellipsis: true,
    },
    {
      title: '电表号码',
      dataIndex: 'meter_number',
      key: 'meter_number',
      width: 140,
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="meter_number" title="电表号码" required={false} />
    },
    {
      title: '设计师',
      dataIndex: 'designer',
      key: 'designer',
      width: 120,
      sorter: (a, b) => (a.designer || '').localeCompare(b.designer || ''),
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="designer" title="设计师" required={false} />
    },
    {
      title: '图纸变更',
      dataIndex: 'drawing_change',
      key: 'drawing_change',
      width: 120,
      align: 'center' as const,
      render: (value, record) => {
        // 在编辑状态下使用EditableSelectCell
        if (isEditing(record, 'drawing_change')) {
          return (
            <EditableSelectCell 
              value={value || '无变更'} 
              record={record} 
              dataIndex="drawing_change" 
              title="图纸变更" 
              options={DRAWING_CHANGE_OPTIONS}
            />
          );
        }
        
        // 获取当前选项，默认为"无变更"
        const option = DRAWING_CHANGE_OPTIONS.find(o => o.value === value) || DRAWING_CHANGE_OPTIONS[0];
        
        // 定义按钮颜色映射
        const btnTypeMap: Record<string, any> = {
          'default': 'default',
          'blue': 'primary',
          'purple': 'primary',
          'orange': 'warning',
          'red': 'danger',
          'volcano': 'danger'
        };
        
        // 定义按钮风格映射
        const btnStyleMap: Record<string, React.CSSProperties> = {
          'default': { borderColor: '#d9d9d9', color: 'rgba(0, 0, 0, 0.88)' },
          'blue': { borderColor: '#1677ff', color: '#1677ff' },
          'purple': { borderColor: '#722ed1', color: '#722ed1' },
          'orange': { borderColor: '#fa8c16', color: '#fa8c16' },
          'red': { borderColor: '#f5222d', color: '#f5222d' },
          'volcano': { borderColor: '#fa541c', color: '#fa541c' }
        };
        
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button 
              ghost
              type={btnTypeMap[option.color] || 'default'}
              style={btnStyleMap[option.color] || {}}
                size="small"
              onClick={() => edit(record, 'drawing_change')}
            >
              {option.label}
            </Button>
          </div>
        );
      },
      sorter: (a, b) => {
        const valA = typeof a.drawing_change === 'string' ? a.drawing_change : '无变更';
        const valB = typeof b.drawing_change === 'string' ? b.drawing_change : '无变更';
        return valA.localeCompare(valB);
      },
      ellipsis: true,
    },
    {
      title: '催单',
      dataIndex: 'urge_order',
      key: 'urge_order',
      width: 120,
      sorter: (a, b) => {
        // 如果两者都为null，排序相等
        if (!a.urge_order && !b.urge_order) return 0;
        // 如果a为null，b排在前面
        if (!a.urge_order) return 1;
        // 如果b为null，a排在前面
        if (!b.urge_order) return -1;
        // 都不为null时，进行时间比较
        return new Date(b.urge_order).getTime() - new Date(a.urge_order).getTime();
      },
      render: (text: string | null, record: Customer) => {
        // 检查station_management是否包含时间戳
        const hasTimestamp = Array.isArray(record.station_management) && 
          record.station_management.some(item => {
            // 尝试将字符串解析为日期，检查是否为有效日期
            const date = new Date(item);
            return !isNaN(date.getTime());
          });
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* 显示催单日期或占位符 */}
            {text ? (
              <Tag color="orange"><ClockCircleOutlined /> {dayjs(text).format('MM-DD HH:mm')}</Tag>
            ) : (
              <span style={{ marginRight: '8px' }}>-</span>
            )}
            
            {/* 催单按钮 */}
            <Button 
              type="text"
              size="small"
              icon={text ? <DeleteOutlined /> : <ClockCircleOutlined />} 
              disabled={!hasTimestamp}
              onClick={() => record.id && handleUrgeOrder(record.id)}
            />
          </div>
        );
      },
    },
    {
      title: '组件数量',
      dataIndex: 'module_count',
      key: 'module_count',
      width: 120,
      sorter: (a, b) => (a.module_count || 0) - (b.module_count || 0),
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="module_count" title="组件数量" required={false} />
    },
    {
      title: '容量',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (text) => text ? `${text} KW` : '-',
      sorter: (a, b) => (a.capacity || 0) - (b.capacity || 0),
      ellipsis: true,
    },
    {
      title: '投资金额',
      dataIndex: 'investment_amount',
      key: 'investment_amount',
      render: (text) => text ? `¥ ${text}` : '-',
      sorter: (a, b) => (a.investment_amount || 0) - (b.investment_amount || 0),
      ellipsis: true,
    },
    {
      title: '用地面积',
      dataIndex: 'land_area',
      key: 'land_area',
      render: (text) => text ? `${text} m²` : '-',
      sorter: (a, b) => (a.land_area || 0) - (b.land_area || 0),
      ellipsis: true,
    },
    {
      title: '逆变器',
      dataIndex: 'inverter',
      key: 'inverter',
      width: 120,
      sorter: (a, b) => (a.inverter || '').localeCompare(b.inverter || ''),
      ellipsis: true,
      render: (text, record) => {
        // 如果组件数量过少，无法确定逆变器型号
        if (!record.module_count || record.module_count < 10) {
          return <span style={{ color: '#999', fontStyle: 'italic' }}>无法确定型号</span>;
        }

        // 检查是否有出库日期（时间戳）
        const outboundDate = record.inverter_outbound_date ? 
          dayjs(record.inverter_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={record.inverter_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundToggle(record.id, 'inverter', record.inverter_outbound_date)}
            >
              {text || 'SN60PT'}
            </Tag>
          </Tooltip>
        );
      }
    },
    {
      title: '铜线',
      dataIndex: 'copper_wire',
      key: 'copper_wire',
      ellipsis: true,
      render: (text, record) => {
        // 检查是否有出库日期（时间戳）
        const outboundDate = record.copper_wire_outbound_date ? 
          dayjs(record.copper_wire_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={record.copper_wire_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundToggle(record.id, 'copper_wire', record.copper_wire_outbound_date)}
            >
              {text || '3*35mm²'}
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a, b) => (a.copper_wire || '').localeCompare(b.copper_wire || ''),
    },
    {
      title: '铝线',
      dataIndex: 'aluminum_wire',
      key: 'aluminum_wire',
      ellipsis: true,
      render: (text, record) => {
        // 检查是否有出库日期（时间戳）
        const outboundDate = record.aluminum_wire_outbound_date ? 
          dayjs(record.aluminum_wire_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={record.aluminum_wire_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundToggle(record.id, 'aluminum_wire', record.aluminum_wire_outbound_date)}
            >
              {text || '3*50mm²'}
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a, b) => (a.aluminum_wire || '').localeCompare(b.aluminum_wire || ''),
    },
    {
      title: '配电箱',
      dataIndex: 'distribution_box',
      key: 'distribution_box',
      ellipsis: true,
      render: (text, record) => {
        // 检查是否有出库日期（时间戳）
        const outboundDate = record.distribution_box_outbound_date ? 
          dayjs(record.distribution_box_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={record.distribution_box_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundToggle(record.id, 'distribution_box', record.distribution_box_outbound_date)}
            >
              {text || '80kWp'}
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a, b) => (a.distribution_box || '').localeCompare(b.distribution_box || ''),
    },
    {
      title: '方钢出库',
      dataIndex: 'square_steel_status',
      key: 'square_steel_status',
      width: 100,
      align: 'center' as const,
      render: (_, record: Customer) => {
        const status = record.square_steel_status || 'none';
        
        if (status === 'outbound') {
          // 出库状态 - 显示出库时间戳
          const outboundDate = record.square_steel_outbound_date 
            ? dayjs(record.square_steel_outbound_date).format('YYYY-MM-DD')
            : '';
          
          return (
            <Tag 
              color="green" 
              style={{ cursor: 'pointer' }}
              onClick={() => handleOutboundStatusChange(record.id, 'square_steel', 'inbound')}
            >
              {outboundDate}
            </Tag>
          );
        } else if (status === 'inbound') {
          // 回库状态 - 显示回库标签和时间戳
          const inboundDate = record.square_steel_inbound_date 
            ? dayjs(record.square_steel_inbound_date).format('YYYY-MM-DD')
            : '';
          
          return (
            <Tag 
              color="orange" 
              style={{ cursor: 'pointer' }} 
              onClick={() => handleOutboundStatusChange(record.id, 'square_steel', 'outbound')}
            >
              <RollbackOutlined /> {inboundDate}
            </Tag>
          );
        } else if (status === 'returned') {
          // 退单状态
          return (
            <Tag color="red">
              <CloseCircleOutlined /> 退单
            </Tag>
          );
        } else {
          // 未出库状态 - 显示出库按钮
          return (
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleOutboundStatusChange(record.id, 'square_steel', 'outbound')}
            >
              出库
            </Button>
          );
        }
      }
    },
    {
      title: '组件出库',
      dataIndex: 'component_status',
      key: 'component_status',
      width: 100,
      align: 'center' as const,
      render: (_, record: Customer) => {
        const status = record.component_status || 'none';
        
        if (status === 'outbound') {
          // 出库状态 - 显示出库时间戳
          const outboundDate = record.component_outbound_date 
            ? dayjs(record.component_outbound_date).format('YYYY-MM-DD')
            : '';
          
          return (
            <Tag 
              color="green" 
              style={{ cursor: 'pointer' }}
              onClick={() => handleOutboundStatusChange(record.id, 'component', 'inbound')}
            >
              {outboundDate}
            </Tag>
          );
        } else if (status === 'inbound') {
          // 回库状态 - 显示回库标签和时间戳
          const inboundDate = record.component_inbound_date 
            ? dayjs(record.component_inbound_date).format('YYYY-MM-DD')
            : '';
          
          return (
            <Tag 
              color="orange" 
              style={{ cursor: 'pointer' }} 
              onClick={() => handleOutboundStatusChange(record.id, 'component', 'outbound')}
            >
              <RollbackOutlined /> {inboundDate}
            </Tag>
          );
        } else if (status === 'returned') {
          // 退单状态
          return (
            <Tag color="red">
              <CloseCircleOutlined /> 退单
            </Tag>
          );
        } else {
          // 未出库状态 - 显示出库按钮
          return (
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleOutboundStatusChange(record.id, 'component', 'outbound')}
            >
              出库
            </Button>
          );
        }
      }
    },
    {
      title: '派工日期',
      dataIndex: 'dispatch_date',
      key: 'dispatch_date',
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
      sorter: (a, b) => {
        if (!a.dispatch_date && !b.dispatch_date) return 0
        if (!a.dispatch_date) return -1
        if (!b.dispatch_date) return 1
        return new Date(a.dispatch_date).getTime() - new Date(b.dispatch_date).getTime()
      },
      ellipsis: true,
    },
    {
      title: '施工队',
      dataIndex: 'construction_team',
      key: 'construction_team',
      sorter: (a, b) => (a.construction_team || '').localeCompare(b.construction_team || ''),
      ellipsis: true,
      render: (value, record) => <ConstructionTeamCell value={value} record={record} />
    },
    {
      title: '施工队电话',
      dataIndex: 'construction_team_phone',
      key: 'construction_team_phone',
      sorter: (a, b) => (a.construction_team_phone || '').localeCompare(b.construction_team_phone || ''),
      ellipsis: true,
      render: (value, record) => <ConstructionTeamPhoneCell value={value} record={record} />
    },
    {
      title: '施工状态',
      dataIndex: 'construction_status',
      key: 'construction_status',
      width: 130,
      align: 'center' as const,
      render: (text, record) => {
        // 如果有施工状态（已完工）
        if (text) {
          // 只有管理员可以将已完工恢复为未完工
          const canReset = userRole === 'admin';
          
          return (
            <Tag 
              color="green" 
              style={{ cursor: canReset ? 'pointer' : 'default' }}
              onClick={() => canReset && record.id && handleConstructionStatusChange(record.id, text)}
            >
              <ClockCircleOutlined /> {dayjs(text).format('YYYY-MM-DD HH:mm')}
            </Tag>
          );
        } else {
          // 未完工状态，显示按钮
          return (
            <Button 
              type="primary" 
              size="small"
              onClick={() => record.id && handleConstructionStatusChange(record.id, null)}
            >
              未完工
            </Button>
          );
        }
      },
      sorter: (a, b) => {
        if (!a.construction_status && !b.construction_status) return 0
        if (!a.construction_status) return -1
        if (!b.construction_status) return 1
        return new Date(a.construction_status).getTime() - new Date(b.construction_status).getTime()
      },
      ellipsis: true,
    },
    {
      title: '大线',
      dataIndex: 'main_line',
      key: 'main_line',
      width: 120,
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="main_line" title="大线" required={false} />
    },
    {
      title: '技术审核',
      dataIndex: 'technical_review',
      key: 'technical_review',
      width: 120,
      align: 'center' as const,
      render: (text, record) => {
        // 如果已审核通过
        if (text) {
          const reviewTime = dayjs(text).format('YYYY-MM-DD HH:mm');
          const canReset = userRole === 'admin';
          
          return (
            <Tooltip title={canReset ? '点击重置为待审核状态' : `审核通过时间: ${reviewTime}`}>
              <Tag 
                color="green"
                style={{ cursor: canReset ? 'pointer' : 'default' }}
                onClick={() => canReset && record.id && handleTechnicalReviewChange(record.id, 'reset')}
              >
                <CheckCircleOutlined /> {reviewTime} 已通过
              </Tag>
            </Tooltip>
          );
        } else if (record.technical_review_rejected) {
          // 如果被驳回，从technical_review_rejected字段提取时间信息
          let rejectionTime = '无记录';
          
          // 尝试从状态中提取时间
          const match = record.technical_review_rejected.match(/技术驳回 \(([0-9- :]+)\)/);
          if (match && match[1]) {
            rejectionTime = match[1];
          }
          
          return (
            <Tooltip title={`驳回时间: ${rejectionTime}`}>
              <Button 
                danger
                size="small"
                onClick={() => record.id && showTechnicalReviewOptions(record.id)}
              >
                技术驳回
              </Button>
            </Tooltip>
          );
        } else {
          // 待审核状态
          return (
            <Button 
              type="primary"
              size="small"
              ghost
              onClick={() => record.id && showTechnicalReviewOptions(record.id)}
            >
              待审核
            </Button>
          );
        }
      },
      sorter: (a, b) => {
        if (!a.technical_review && !b.technical_review) return 0
        if (!a.technical_review) return -1
        if (!b.technical_review) return 1
        return new Date(a.technical_review).getTime() - new Date(b.technical_review).getTime()
      },
      ellipsis: true,
    },
    {
      title: '上传国网',
      dataIndex: 'upload_to_grid',
      key: 'upload_to_grid',
      width: 130,
      align: 'center' as const,
      render: (text, record) => {
        // 如果已上传
        if (text) {
          // 只有管理员可以将已上传恢复为未上传
          const canReset = userRole === 'admin';
          
          return (
            <Tooltip title={canReset ? '点击恢复为未上传状态' : '上传时间'}>
              <Tag 
                color="green" 
                style={{ cursor: canReset ? 'pointer' : 'default' }}
                onClick={() => canReset && record.id && handleUploadToGridChange(record.id, text)}
              >
                <ClockCircleOutlined /> {dayjs(text).format('YYYY-MM-DD HH:mm')}
              </Tag>
            </Tooltip>
          );
        } else {
          // 未上传状态，显示按钮
          return (
            <Button 
              type="primary" 
              size="small"
              ghost
              onClick={() => record.id && handleUploadToGridChange(record.id, null)}
            >
              上传
            </Button>
          );
        }
      },
      sorter: (a, b) => {
        if (!a.upload_to_grid && !b.upload_to_grid) return 0
        if (!a.upload_to_grid) return -1
        if (!b.upload_to_grid) return 1
        return new Date(a.upload_to_grid).getTime() - new Date(b.upload_to_grid).getTime()
      },
      ellipsis: true,
    },
    {
      title: '建设验收',
      dataIndex: 'construction_acceptance',
      key: 'construction_acceptance',
      width: 130,
      align: 'center' as const,
      render: (text, record) => {
        // 如果已推到
        if (text) {
          // 只有管理员可以将已推到恢复为未推到
          const canReset = userRole === 'admin';
          
          // 检查是否是等待状态
          let isWaiting = false;
          let displayText = '';
          
          // 检查text是否为等待格式："waiting:天数:开始日期"
          if (typeof text === 'string' && text.startsWith('waiting:')) {
            isWaiting = true;
            const parts = text.split(':');
            if (parts.length === 3) {
              const initialDays = parseInt(parts[1], 10);
              const startDate = parts[2];
              
              // 计算从开始日期至今已等待天数
              const elapsedDays = dayjs().diff(dayjs(startDate), 'day');
              // 计算当前累计等待天数
              const totalWaitDays = initialDays + elapsedDays;
              
              displayText = `已等待 ${totalWaitDays} 天`;
            } else {
              displayText = '等待中';
            }
          } else {
            // 普通日期显示
            displayText = dayjs(text).format('YYYY-MM-DD HH:mm');
          }
          
          return (
            <Tooltip title={canReset ? '点击恢复为未推到状态' : '推到时间/等待状态'}>
              <Tag 
                color={isWaiting ? 'orange' : 'green'} 
                style={{ cursor: canReset ? 'pointer' : 'default' }}
                onClick={() => canReset && record.id && handleConstructionAcceptanceChange(record.id, text)}
              >
                <ClockCircleOutlined /> {displayText}
              </Tag>
            </Tooltip>
          );
        } else {
          // 未推到状态，显示按钮
          return (
            <Button 
              type="primary" 
              size="small"
              danger
              ghost
              onClick={() => record.id && showConstructionAcceptanceOptions(record.id)}
            >
              未推到
            </Button>
          );
        }
      },
      sorter: (a, b) => {
        if (!a.construction_acceptance && !b.construction_acceptance) return 0
        if (!a.construction_acceptance) return -1
        if (!b.construction_acceptance) return 1
        return new Date(a.construction_acceptance).getTime() - new Date(b.construction_acceptance).getTime()
      },
      ellipsis: true,
    },
    {
      title: '挂表日期',
      dataIndex: 'meter_installation_date',
      key: 'meter_installation_date',
      width: 130,
      align: 'center' as const,
      render: (text, record) => {
        // 如果已挂表
        if (text) {
          // 只有管理员可以将已挂表恢复为未挂表
          const canReset = userRole === 'admin';
          
          return (
            <Tooltip title={canReset ? '点击恢复为未挂表状态' : '挂表时间'}>
              <Tag 
                color="green" 
                style={{ cursor: canReset ? 'pointer' : 'default' }}
                onClick={() => canReset && record.id && handleMeterInstallationDateChange(record.id, text)}
              >
                <ClockCircleOutlined /> {dayjs(text).format('YYYY-MM-DD HH:mm')}
              </Tag>
            </Tooltip>
          );
        } else {
          // 未挂表状态，显示按钮
          return (
            <Button 
              type="primary" 
              size="small"
              ghost
              onClick={() => record.id && handleMeterInstallationDateChange(record.id, null)}
            >
              挂表
            </Button>
          );
        }
      },
      sorter: (a, b) => {
        if (!a.meter_installation_date && !b.meter_installation_date) return 0
        if (!a.meter_installation_date) return -1
        if (!b.meter_installation_date) return 1
        return new Date(a.meter_installation_date).getTime() - new Date(b.meter_installation_date).getTime()
      },
      ellipsis: true,
    },
    {
      title: '购售电合同',
      dataIndex: 'power_purchase_contract',
      key: 'power_purchase_contract',
      width: 130,
      align: 'center' as const,
      render: (text, record) => {
        // 如果已出合同
        if (text) {
          // 只有管理员可以将已出合同恢复为待出状态
          const canReset = userRole === 'admin';
          
          return (
            <Tooltip title={canReset ? '点击恢复为待出状态' : '合同出具时间'}>
              <Tag 
                color="green" 
                style={{ cursor: canReset ? 'pointer' : 'default' }}
                onClick={() => canReset && record.id && handlePowerPurchaseContractChange(record.id, text)}
              >
                <ClockCircleOutlined /> {dayjs(text).format('YYYY-MM-DD HH:mm')}
              </Tag>
            </Tooltip>
          );
        } else {
          // 待出状态，显示按钮
          return (
            <Button 
              type="primary" 
              size="small"
              ghost
              onClick={() => record.id && handlePowerPurchaseContractChange(record.id, null)}
            >
              待出
            </Button>
          );
        }
      },
      sorter: (a, b) => {
        if (!a.power_purchase_contract && !b.power_purchase_contract) return 0
        if (!a.power_purchase_contract) return -1
        if (!b.power_purchase_contract) return 1
        return new Date(a.power_purchase_contract).getTime() - new Date(b.power_purchase_contract).getTime()
      },
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (text, record) => {
        // 检查购售电合同是否为"待出"状态
        const isPowerPurchaseContractPending = !record.power_purchase_contract;
        
        // 如果购售电合同为"待出"状态，显示灰色禁用按钮
        if (isPowerPurchaseContractPending) {
          return (
            <Tooltip title="需要先完成购售电合同">
              <Button
                size="small"
                disabled
                style={{ color: 'rgba(0, 0, 0, 0.25)', background: '#f5f5f5', borderColor: '#d9d9d9' }}
              >
                待处理
              </Button>
            </Tooltip>
          );
        }
        
        // 如果购售电合同已完成，显示当前状态或可点击的蓝色按钮
        if (text) {
          // 映射状态到颜色
          const statusColorMap: Record<string, string> = {
            '待处理': 'blue',
          '提交资料': 'blue',
          '技术驳回': 'red',
          '商务驳回': 'orange',
          '已完成': 'green'
          };
          
          const color = statusColorMap[text] || 'blue';
          
          // 如果是蓝色状态，显示为可点击的按钮
          if (color === 'blue') {
            return (
              <Button
                type="primary"
                size="small"
                onClick={() => record.id && showStatusOptions(record.id, text || '待处理')}
              >
                {text}
              </Button>
            );
          }
          
          // 其他状态显示为对应颜色的标签
          return (
            <Tag 
              color={color}
              style={{ cursor: 'pointer' }}
              onClick={() => record.id && showStatusOptions(record.id, text)}
            >
              {text}
            </Tag>
          );
        } else {
          // 如果没有状态，显示为蓝色"待处理"按钮
          return (
            <Button
              type="primary"
              size="small"
              onClick={() => record.id && showStatusOptions(record.id, '待处理')}
            >
              待处理
            </Button>
          );
        }
      },
      filters: [
        { text: '待处理', value: '待处理' },
        { text: '提交资料', value: '提交资料' },
        { text: '技术驳回', value: '技术驳回' },
        { text: '商务驳回', value: '商务驳回' },
        { text: '已完成', value: '已完成' }
      ],
      onFilter: (value, record) => {
        // 对于状态为空的记录，默认认为是"待处理"
        const status = record.status || '待处理';
        return status === value;
      },
      sorter: (a, b) => {
        // 处理可能为空的状态值
        const statusA = a.status || '待处理';
        const statusB = b.status || '待处理';
        return statusA.localeCompare(statusB);
      },
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="price" title="价格" required={false} />,
      sorter: (a, b) => (a.price || 0) - (b.price || 0)
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      render: (value, record) => {
        // 使用可编辑单元格，公司字段直接使用数据库中的值（昊尘或祐之）
        return <EditableSelectCell 
          value={value} 
          record={record} 
          dataIndex="company" 
          title="公司" 
          options={[
            {value: '昊尘', label: '昊尘'},
            {value: '祐之', label: '祐之'}
          ]}
        />;
      },
      sorter: (a, b) => (a.company || '').localeCompare(b.company || ''),
      ellipsis: true,
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="remarks" title="备注" required={false} />,
      sorter: (a, b) => (a.remarks || '').localeCompare(b.remarks || '')
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_, record) => {
        return (
          <Space size="small">
            <Tooltip title="编辑详情">
              <Button 
                icon={<EditOutlined />} 
                onClick={() => navigate(`/customers/${record.id}`)} 
                size="small"
                type="primary"
                ghost
              />
            </Tooltip>
            {(userRole === 'admin') && (
              <Tooltip title="删除">
                <Button 
                  icon={<DeleteOutlined />} 
                  onClick={() => record.id && record.customer_name && handleDelete(record.id, record.customer_name)} 
                  size="small" 
                  danger
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ]

  // 添加一个生成模板下载功能
  const handleDownloadTemplate = () => {
    try {
      // 创建模板表头
      const templateHeaders = {
        '登记日期': dayjs().format('YYYY-MM-DD'),
        '客户姓名': '',
        '客户电话': '',
        '地址': '',
        '身份证号': '',
        '业务员': '',
        '业务员电话': '',
        '备案日期': '',
        '电表号码': '',
        '设计师': '',
        '组件数量': '',
        '备注': ''
      };
      
      // 创建工作簿和工作表
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([templateHeaders]);
      
      // 将工作表添加到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '客户导入模板');
      
      // 保存文件
      XLSX.writeFile(wb, `客户导入模板.xlsx`);
      message.success('模板下载成功');
    } catch (error) {
      message.error('模板下载失败');
      console.error(error);
    }
  };

  // 更新出库状态变更处理函数
  const handleOutboundStatusChange = async (id: string | undefined, type: 'square_steel' | 'component', status: OutboundStatus) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      console.log(`更新出库状态: ID=${id}, 类型=${type}, 状态=${status}`);
      
      // 立即更新本地UI状态显示
      const updatedCustomers = filteredCustomers.map(customer => {
        if (customer.id === id) {
          const updatedCustomer = { ...customer };
          
          if (type === 'square_steel') {
            // 更新方钢状态
            updatedCustomer.square_steel_status = status;
            if (status === 'outbound') {
              updatedCustomer.square_steel_outbound_date = new Date().toISOString();
            } else if (status === 'inbound') {
              updatedCustomer.square_steel_inbound_date = new Date().toISOString();
            }
          } else if (type === 'component') {
            // 更新组件状态
            updatedCustomer.component_status = status;
            if (status === 'outbound') {
              updatedCustomer.component_outbound_date = new Date().toISOString();
            } else if (status === 'inbound') {
              updatedCustomer.component_inbound_date = new Date().toISOString();
            }
          }
          
          return updatedCustomer;
        }
        return customer;
      });
      
      // 更新本地状态
      setFilteredCustomers(updatedCustomers);
      setCustomers(customers.map(customer => 
        customer.id === id ? updatedCustomers.find(c => c.id === id) || customer : customer
      ));
      
      // 调用API更新后端
      await customerApi.updateOutboundStatus(id, type, true);
      
      if (status === 'outbound') {
        message.success('已标记为出库');
      } else if (status === 'inbound') {
        message.success('已标记为回库');
      } else if (status === 'none') {
        message.success('状态已重置');
      } else if (status === 'returned') {
          message.success('已标记为退单');
      }
      
      // 在后台刷新数据确保同步，但不会影响用户体验
      setTimeout(() => {
      fetchCustomers();
      }, 1000);
    } catch (error) {
      console.error('更新状态失败:', error);
      message.error(`更新状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 出错时恢复数据
      fetchCustomers();
    }
  };

  // 显示退单或出库选择对话框
  const showOutboundOptions = (id: string | undefined, type: 'square_steel' | 'component') => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    Modal.confirm({
      title: '选择操作',
      content: '请选择要执行的操作:',
      okText: '出库',
      okType: 'primary',
      cancelText: '退单',
      onOk() {
        handleOutboundStatusChange(id, type, 'outbound');
      },
      onCancel() {
        handleOutboundStatusChange(id, type, 'returned');
      },
      okButtonProps: {
        style: { backgroundColor: '#52c41a' }
      },
      cancelButtonProps: {
        style: { backgroundColor: '#ff4d4f', color: 'white' }
      }
    });
  };

  // 处理催单
  const handleUrgeOrder = async (id: string | undefined) => {
    if (!id) return
    
    try {
      setLoading(true)
      const targetCustomer = customers.find(c => c.id === id)
      
      if (!targetCustomer) {
        message.error('找不到指定客户')
        return
      }
      
      // 如果当前有催单记录，则取消催单
      if (targetCustomer.urge_order) {
        await customerApi.update(id, { urge_order: null })
        message.success('取消催单成功')
      } else {
        // 否则添加催单
        await customerApi.update(id, { urge_order: new Date().toISOString() })
        message.success('添加催单成功')
      }
      
      fetchCustomers()
    } catch (error) {
      console.error('催单操作失败:', error)
      message.error('催单操作失败')
    } finally {
      setLoading(false)
    }
  }
  
  // 处理物品出库状态切换
  const handleItemOutboundToggle = async (id: string | undefined, itemType: string, currentDate: string | null | undefined) => {
    if (!id) {
      message.error('无效的客户ID');
      return;
    }

    try {
      setLoading(true);
      
      // 如果已有日期，则清除日期（取消出库状态）
      // 如果没有日期，则设置为当前日期（标记为已出库）
      const updateObj: Record<string, any> = {
        [`${itemType}_outbound_date`]: currentDate ? null : dayjs().format('YYYY-MM-DD')
      };
      
      await customerApi.update(id, updateObj);
      
      // 刷新客户列表
      await fetchCustomers();
      
      message.success(currentDate ? `${itemType}已取消出库` : `${itemType}已标记为出库`);
    } catch (error) {
      console.error('更新出库状态失败:', error);
      message.error('更新出库状态失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加一个专门用于施工队的可编辑单元格
  const ConstructionTeamCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'construction_team');
    const [hover, setHover] = useState(false);
    
    // 将施工队数据转换为Select选项格式
    const teamOptions = constructionTeams.map(team => ({
      value: team.name,
      label: team.name,
      phone: team.phone || ''
    }));
    
    // 添加一个清空选项
    teamOptions.unshift({
      value: '',
      label: '清空施工队',
      phone: ''
    });
    
    return editable ? (
      <Form.Item
        name="construction_team"
        style={{ margin: 0 }}
      >
        <Select
          placeholder="请选择或输入施工队"
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={teamOptions}
          onBlur={() => record.id ? save(record.id) : undefined}
          onChange={(value, option) => {
            // 如果选择了已有施工队，自动填充电话
            if (value && typeof option === 'object' && 'phone' in option) {
              // 设置电话号码字段
              editForm.setFieldsValue({ construction_team_phone: option.phone });
              
              // 如果有ID，立即保存施工队名称
              if (record.id) {
                // 先保存施工队名称
                save(record.id).then(() => {
                  // 然后自动编辑电话字段
                  setTimeout(() => {
                    // 只有当电话字段还没被编辑时才自动保存电话
                    if (editingCell?.dataIndex === 'construction_team' && record.construction_team_phone !== option.phone) {
                      // 更新电话号码
                      customerApi.update(record.id as string, { construction_team_phone: option.phone || '' })
                        .then(() => {
                          // 成功后刷新数据
                          fetchCustomers();
                          message.success('已自动更新施工队电话');
                        })
                        .catch(error => {
                          console.error('自动更新施工队电话失败:', error);
                        });
                    }
                  }, 500);
                });
              }
            } else if (value === '') {
              // 如果清空施工队，同时清空电话和派工日期
              editForm.setFieldsValue({ construction_team_phone: '' });
              
              // 如果有ID，在保存后清除派工日期
              if (record.id) {
                // 先保存施工队为空
                save(record.id).then(() => {
                  // 然后清除派工日期
                  customerApi.update(record.id as string, { 
                    construction_team_phone: '',
                    dispatch_date: null 
                  })
                    .then(() => {
                      // 成功后刷新数据
                      fetchCustomers();
                      message.success('已清除施工队信息和派工日期');
                    })
                    .catch(error => {
                      console.error('清除派工日期失败:', error);
                      message.error('清除派工日期失败');
                    });
                });
              }
            }
          }}
        />
      </Form.Item>
    ) : (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: '4px 0',
          borderRadius: 4,
          cursor: editingCell === null ? 'pointer' : 'default',
          background: hover ? '#f0f5ff' : 'transparent'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => editingCell === null && edit(record, 'construction_team')}
      >
        <div style={{ flex: 1 }}>
          {value ? (
            <span>{value}</span>
          ) : (
            <span style={{ color: '#999' }}>-</span>
          )}
        </div>
        {hover && editingCell === null && (
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => edit(record, 'construction_team')}
            style={{ padding: '0 4px' }}
            title="编辑施工队"
          />
        )}
      </div>
    );
  };
  
  // 施工队电话可编辑单元格
  const ConstructionTeamPhoneCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'construction_team_phone');
    const [hover, setHover] = useState(false);
    
    return editable ? (
      <Form.Item
        name="construction_team_phone"
        style={{ margin: 0 }}
      >
        <Input 
          placeholder="施工队电话" 
          onPressEnter={() => record.id ? save(record.id) : undefined} 
          onBlur={() => record.id ? save(record.id) : undefined}
          allowClear
        />
      </Form.Item>
    ) : (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: '4px 0',
          borderRadius: 4,
          cursor: editingCell === null ? 'pointer' : 'default',
          background: hover ? '#f0f5ff' : 'transparent'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => editingCell === null && edit(record, 'construction_team_phone')}
      >
        <div style={{ flex: 1 }}>
          {value ? (
            <span>{value}</span>
          ) : (
            <span style={{ color: '#999' }}>-</span>
          )}
        </div>
        {hover && editingCell === null && (
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => edit(record, 'construction_team_phone')}
            style={{ padding: '0 4px' }}
            title="编辑施工队电话"
          />
        )}
      </div>
    );
  };

  // 处理施工状态变更
  const handleConstructionStatusChange = async (id: string | undefined, currentStatus: string | null) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      setLoading(true);
      
      // 如果当前有状态（已完工），则恢复为未完工
      // 如果当前没有状态（未完工），则标记为已完工
      const updateObj = {
        construction_status: currentStatus ? null : new Date().toISOString()
      };
      
      await customerApi.update(id, updateObj);
      
      message.success(currentStatus ? '已恢复为未完工状态' : '已标记为完工状态');
      fetchCustomers(); // 刷新数据
    } catch (error) {
      console.error('更新施工状态失败:', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理技术审核状态变更
  const handleTechnicalReviewChange = async (id: string | undefined, status: 'approved' | 'rejected' | 'reset') => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      setLoading(true);

      // 查找当前客户记录
      const customer = filteredCustomers.find(c => c.id === id);
      if (!customer) {
        throw new Error('找不到客户记录');
      }

      const now = new Date().toISOString();
      const updateObj: Record<string, any> = {
        technical_review: status === 'approved' ? now : null
      };
      
      // 不再更新status字段，只在驳回时记录在状态文本中
      if (status === 'rejected') {
        // 如果审核被驳回，设置状态为技术驳回
        updateObj.technical_review_rejected = `技术驳回 (${dayjs(now).format('YYYY-MM-DD HH:mm')})`;
      } else {
        // 如果审核通过或重置，清除驳回记录
        updateObj.technical_review_rejected = null;
      }
      
      await customerApi.update(id, updateObj);
      
      let successMessage = '';
      if (status === 'approved') {
        successMessage = '审核已通过';
      } else if (status === 'rejected') {
        successMessage = '已驳回审核';
      } else if (status === 'reset') {
        successMessage = '已重置为待审核状态';
      }
      
      message.success(successMessage);
      fetchCustomers(); // 刷新数据
    } catch (error) {
      console.error('更新技术审核状态失败:', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 显示技术审核选项
  const showTechnicalReviewOptions = (id: string | undefined) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    Modal.confirm({
      title: '选择技术审核结果',
      content: '请选择技术审核结果:',
      okText: '审核通过',
      okType: 'primary',
      cancelText: '技术驳回',
      onOk() {
        handleTechnicalReviewChange(id, 'approved');
      },
      onCancel() {
        handleTechnicalReviewChange(id, 'rejected');
      },
      okButtonProps: {
        style: { backgroundColor: '#52c41a' }
      },
      cancelButtonProps: {
        style: { backgroundColor: '#ff4d4f', color: 'white' }
      }
    });
  };

  // 处理上传国网状态变更
  const handleUploadToGridChange = async (id: string | undefined, currentStatus: string | null) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      setLoading(true);
      
      // 如果当前有状态（已上传），则恢复为未上传
      // 如果当前没有状态（未上传），则标记为已上传
      const updateObj = {
        upload_to_grid: currentStatus ? null : new Date().toISOString()
      };
      
      await customerApi.update(id, updateObj);
      
      message.success(currentStatus ? '已恢复为未上传状态' : '已标记为已上传状态');
      fetchCustomers(); // 刷新数据
    } catch (error) {
      console.error('更新上传国网状态失败:', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理建设验收状态变更
  const handleConstructionAcceptanceChange = async (id: string | undefined, currentStatus: string | null, days?: number) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      setLoading(true);
      
      let updateObj: Record<string, any> = {};
      
      if (!currentStatus) {
        if (days !== undefined) {
          // 设置等待状态
          // 将等待天数和开始日期保存在状态值中，格式为: "waiting:天数:开始日期"
          const startDate = dayjs().format('YYYY-MM-DD');
          updateObj.construction_acceptance = `waiting:${days}:${startDate}`;
        } else {
          // 直接设置为已推到状态
          updateObj.construction_acceptance = new Date().toISOString();
        }
      } else {
        // 恢复为未推到状态
        updateObj.construction_acceptance = null;
      }
      
      await customerApi.update(id, updateObj);
      
      if (currentStatus) {
        message.success('已恢复为未推到状态');
      } else if (days !== undefined) {
        message.success(`已设置为等待天数: ${days}`);
      } else {
        message.success('已标记为已推到状态');
      }
      
      fetchCustomers(); // 刷新数据
    } catch (error) {
      console.error('更新建设验收状态失败:', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 显示建设验收选项对话框
  const showConstructionAcceptanceOptions = (id: string | undefined) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }

    let radioValue = 'now';
    let waitDays = 7;
    
    Modal.confirm({
      title: '设置建设验收状态',
      width: 400,
      icon: null,
      content: (
        <div>
          <Radio.Group 
            defaultValue="now" 
            onChange={(e) => {
              radioValue = e.target.value;
              // 通过DOM更新输入框的显示/隐藏状态
              const element = document.getElementById('waitDaysInputContainer');
              if (element) {
                element.style.display = radioValue === 'wait' ? 'block' : 'none';
              }
            }}
          >
            <Space direction="vertical">
              <Radio value="now">立即标记为已推到</Radio>
              <Radio value="wait">等待天数</Radio>
            </Space>
          </Radio.Group>
          <div id="waitDaysInputContainer" style={{ marginLeft: 24, marginTop: 10, display: 'none' }}>
            <InputNumber 
              min={1} 
              max={999} 
              defaultValue={7}
              onChange={(value: number | null) => { 
                waitDays = value ?? 7;
              }}
            /> 天
          </div>
        </div>
      ),
      async onOk() {
        try {
          if (radioValue === 'wait') {
            await handleConstructionAcceptanceChange(id, null, waitDays);
          } else {
            await handleConstructionAcceptanceChange(id, null);
          }
          return Promise.resolve();
        } catch (error) {
          return Promise.reject();
        }
      }
    });
  };

  // 处理挂表日期状态变更
  const handleMeterInstallationDateChange = async (id: string | undefined, currentStatus: string | null) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      setLoading(true);
      
      // 如果当前有状态（已挂表），则恢复为未挂表
      // 如果当前没有状态（未挂表），则标记为已挂表
      const updateObj = {
        meter_installation_date: currentStatus ? null : new Date().toISOString()
      };
      
      await customerApi.update(id, updateObj);
      
      message.success(currentStatus ? '已恢复为未挂表状态' : '已标记为已挂表状态');
      fetchCustomers(); // 刷新数据
    } catch (error) {
      console.error('更新挂表日期状态失败:', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理购售电合同状态变更
  const handlePowerPurchaseContractChange = async (id: string | undefined, currentStatus: string | null) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      setLoading(true);
      
      // 如果当前有状态（已出合同），则恢复为待出状态
      // 如果当前没有状态（待出），则标记为已出合同
      const updateObj = {
        power_purchase_contract: currentStatus ? null : new Date().toISOString()
      };
      
      await customerApi.update(id, updateObj);
      
      message.success(currentStatus ? '已恢复为待出状态' : '已标记为已出合同');
      fetchCustomers(); // 刷新数据
    } catch (error) {
      console.error('更新购售电合同状态失败:', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理状态变更
  const handleStatusChange = async (id: string | undefined, newStatus: string) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      setLoading(true);
      
      const updateObj = {
        status: newStatus
      };
      
      await customerApi.update(id, updateObj);
      
      message.success(`状态已更新为: ${newStatus}`);
      fetchCustomers(); // 刷新数据
    } catch (error) {
      console.error('更新状态失败:', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 显示状态选项对话框
  const showStatusOptions = (id: string | undefined, currentStatus: string) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    // 定义状态选项
    const statusOptions = [
      { label: '提交资料', value: '提交资料', color: 'blue' },
      { label: '技术驳回', value: '技术驳回', color: 'red' },
      { label: '商务驳回', value: '商务驳回', color: 'orange' },
      { label: '已完成', value: '已完成', color: 'green' }
    ];
    
    // 使用状态变量跟踪选择
    let selectedStatus = currentStatus;
    
    Modal.confirm({
      title: '选择新状态',
      icon: null,
      content: (
        <div>
          <Radio.Group 
            defaultValue={currentStatus}
            onChange={(e) => {
              selectedStatus = e.target.value;
            }}
          >
            {statusOptions.map(option => (
              <div key={option.value} style={{ marginBottom: 8 }}>
                <Radio value={option.value}>
                  <Tag color={option.color}>{option.label}</Tag>
                </Radio>
              </div>
            ))}
          </Radio.Group>
        </div>
      ),
      onOk: () => {
        // 使用保存的selectedStatus变量
        return handleStatusChange(id, selectedStatus);
      }
    });
  };

  // 渲染标题栏操作按钮
  const renderTitleBar = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <Title level={4} style={{ margin: 0 }}>客户列表</Title>
      <Space>
        <Input
          placeholder="搜索客户名称/电话/地址 (多关键词用空格或逗号分隔)"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onPressEnter={() => handleSearch(searchText)}
          style={{ width: 320 }}
          prefix={<SearchOutlined />}
          allowClear
        />
        <Button 
          type="primary" 
          icon={<SearchOutlined />} 
          onClick={() => handleSearch(searchText)}
        >
          搜索
        </Button>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => navigate('/customers/new')}
        >
          新增客户
        </Button>
        <Button 
          type="default" 
            icon={<ImportOutlined />} 
          onClick={() => navigate('/customers/import')}
          >
            导入客户
          </Button>
          <Button 
            icon={<ExportOutlined />} 
            onClick={handleExport}
          >
          导出数据
          </Button>
        </Space>
      </div>
  )

  // 添加一个专门用于踏勘员的可编辑单元格
  const SurveyorCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'surveyor');
    const [hover, setHover] = useState(false);
    
    // 将踏勘员数据转换为Select选项格式
    const surveyorOptions = surveyors.map(surveyor => ({
      value: surveyor.name,
      label: surveyor.name,
      phone: surveyor.phone || ''
    }));
    
    // 添加一个清空选项
    surveyorOptions.unshift({
      value: '',
      label: '清空踏勘员',
      phone: ''
    });
    
    return editable ? (
      <Form.Item
        name="surveyor"
        style={{ margin: 0 }}
      >
        <Select
          placeholder="请选择踏勘员"
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={surveyorOptions}
          onBlur={() => record.id ? save(record.id) : undefined}
          onChange={(value, option) => {
            // 如果选择了踏勘员，自动填充电话
            if (value && typeof option === 'object' && 'phone' in option) {
              editForm.setFieldsValue({ surveyor_phone: option.phone });
            }
          }}
        />
      </Form.Item>
    ) : (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: '4px 0',
          borderRadius: 4,
          cursor: editingCell === null ? 'pointer' : 'default',
          background: hover ? '#f0f5ff' : 'transparent'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => editingCell === null && edit(record, 'surveyor')}
      >
        <div style={{ flex: 1 }}>
          {value ? (
            <span>{value}</span>
          ) : (
            <span style={{ color: '#999' }}>-</span>
          )}
        </div>
        {hover && editingCell === null && (
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => edit(record, 'surveyor')}
            style={{ padding: '0 4px' }}
            title="编辑踏勘员"
          />
        )}
      </div>
    );
  };
  
  // 踏勘员电话可编辑单元格
  const SurveyorPhoneCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'surveyor_phone');
    const [hover, setHover] = useState(false);
    
    return editable ? (
      <Form.Item
        name="surveyor_phone"
        style={{ margin: 0 }}
      >
        <Input 
          placeholder="请输入踏勘员电话"
          onPressEnter={() => record.id ? save(record.id) : undefined}
          onBlur={() => record.id ? save(record.id) : undefined}
        />
      </Form.Item>
    ) : (
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center',
          padding: '4px 0',
          borderRadius: 4,
          cursor: editingCell === null ? 'pointer' : 'default',
          background: hover ? '#f0f5ff' : 'transparent'
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => editingCell === null && edit(record, 'surveyor_phone')}
      >
        <div style={{ flex: 1 }}>
          {value ? (
            <span>{value}</span>
          ) : (
            <span style={{ color: '#999' }}>-</span>
          )}
        </div>
        {hover && editingCell === null && (
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => edit(record, 'surveyor_phone')}
            style={{ padding: '0 4px' }}
            title="编辑踏勘员电话"
          />
        )}
      </div>
    );
  };

  // 添加处理业务员名称更新的函数
  const handleUpdateSalesmanName = async (id: string, email: string, name: string, phone: string) => {
    try {
      console.log(`自动更新业务员数据: ID ${id}, 邮箱 ${email} -> 姓名 ${name}, 电话 ${phone}`);
      
      // 更新客户数据
      await customerApi.update(id, {
        salesman: name,
        salesman_phone: phone,
        salesman_email: email // 保留邮箱作为关联字段
      });
      
      // 更新本地数据，避免重复处理
      const updatedCustomers = customers.map(c => {
        if (c.id === id) {
          return { ...c, salesman: name, salesman_phone: phone };
        }
        return c;
      });
      
      setCustomers(updatedCustomers);
      // 如果有筛选，更新筛选后的数据
      if (filteredCustomers.length > 0) {
        const updatedFiltered = filteredCustomers.map(c => {
          if (c.id === id) {
            return { ...c, salesman: name, salesman_phone: phone };
          }
          return c;
        });
        setFilteredCustomers(updatedFiltered);
      }
    } catch (error) {
      console.error('自动更新业务员数据失败:', error);
    }
  };

  return (
    <div className="customer-list-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderTitleBar()}
      
      <Form form={editForm} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Table 
            dataSource={filteredCustomers} 
            columns={columns} 
            rowKey="id"
            loading={loading}
            scroll={{ x: 'max-content', y: 'calc(100vh - 160px)' }}
            pagination={false}
            sticky={{ offsetHeader: 0 }}
            className="customer-table"
            tableLayout="fixed"
            size="middle"
            bordered
          />
        </div>
        
        <style>
          {`
            .customer-table .ant-table-header {
              background-color: #f0f5ff;
              z-index: 9;
              position: sticky;
              top: 0;
            }
            .customer-table .ant-table-cell {
              white-space: nowrap;
              min-width: 110px;
              padding: 12px 16px;
              text-align: center;
            }
            .customer-table .ant-table-thead > tr > th {
              padding: 12px 16px;
              font-weight: bold;
              white-space: nowrap;
              background-color: #f0f5ff;
              text-align: center;
            }
            .customer-table .ant-table-sticky-holder {
              z-index: 9;
            }
            .customer-table .ant-table-sticky-scroll {
              z-index: 9;
              bottom: 0;
            }
            .customer-table .ant-table-cell-fix-right {
              background: #fff !important;
              z-index: 8;
            }
            .customer-table .ant-table-thead .ant-table-cell-fix-right {
              background: #f0f5ff !important;
              z-index: 8;
            }
            .customer-table .ant-table-cell-fix-left {
              background: #fff !important;
              z-index: 8;
            }
            .customer-table .ant-table-thead .ant-table-cell-fix-left {
              background: #f0f5ff !important;
              z-index: 8;
            }
            
            .customer-list-container {
              overflow: auto;
              height: 100%;
              display: flex;
              flex-direction: column;
              margin-bottom: 0;
              padding-bottom: 0;
            }
            
            .customer-table {
              flex: 1;
              overflow: auto;
            }
            
            .ant-table-wrapper, .ant-spin-nested-loading, .ant-spin-container {
              height: 100%;
            }
            
            .ant-table {
              height: 100%;
            }
            
            .ant-table-container {
              height: 100%;
              display: flex;
              flex-direction: column;
            }
            
            .ant-table-body {
              flex: 1;
              overflow-y: auto !important;
              height: auto !important;
              max-height: none !important;
            }
          `}
        </style>
      </Form>
      
      {/* 导入模态框 */}
      <Modal 
        title="导入客户数据" 
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false)
          setImportResult(null)
        }}
        footer={[
          <Button 
            key="close" 
            onClick={() => {
              setImportModalVisible(false)
              setImportResult(null)
            }}
          >
            关闭
          </Button>
        ]}
        width={600}
        modalRender={(modal) => (
          <Draggable handle=".ant-modal-header">
            {modal}
          </Draggable>
        )}
      >
        {importResult ? (
          <div>
            <Title level={4}>导入结果</Title>
            <div style={{ marginBottom: 16 }}>
              <p>📊 总数据量: {importResult.total}</p>
              <p>✅ 成功导入: {importResult.success}</p>
              <p>⚠️ 跳过重复: {importResult.duplicate}</p>
              <p>❌ 导入失败: {importResult.failed}</p>
            </div>
            
            {importResult.failedItems && importResult.failedItems.length > 0 && (
              <div>
                <Divider />
                <Title level={5}>失败详情</Title>
                <Table
                  dataSource={importResult.failedItems}
                  rowKey={(_record, index) => (index ?? 0).toString()}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: '行号',
                      dataIndex: 'row',
                      key: 'row',
                      width: 80
                    },
                    {
                      title: '失败原因',
                      dataIndex: 'reason',
                      key: 'reason',
                      ellipsis: true
                    }
                  ]}
                />
              </div>
            )}
            
            <div style={{ marginTop: 16 }}>
              <Button 
                type="primary"
                onClick={() => setImportResult(null)}
              >
                继续导入
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p>请上传包含以下字段的Excel文件（CSV、XLS、XLSX）:</p>
            <p><b>必填字段</b>: 客户姓名, 客户电话, 地址, 身份证号, 业务员</p>
            <p><b>推荐填写</b>: 组件数量 (用于自动计算其他字段)</p>
            <p><b>可选字段</b>: 登记日期, 业务员电话, 备案日期, 电表号码, 设计师, 公司(昊尘/祐之), 状态</p>
            <p><b>常见导入失败原因</b>: 缺少必填字段、数据格式错误、客户数据重复</p>
            
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button 
                type="link" 
                icon={<FileExcelOutlined />} 
                onClick={handleDownloadTemplate}
              >
                下载导入模板
              </Button>
            </div>
            
            <Dragger {...uploadProps} disabled={importLoading}>
              <p className="ant-upload-drag-icon">
                <FileExcelOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">支持 .xlsx, .xls, .csv 格式</p>
            </Dragger>
            
            {importLoading && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <p>正在导入数据，请稍候...</p>
              </div>
            )}
          </div>
        )}
      </Modal>
      
      {/* 修改记录抽屉 */}
      <Drawer
        title="修改记录"
        placement="right"
        onClose={() => setModificationDrawerVisible(false)}
        open={modificationDrawerVisible}
        width={600}
      >
        {modificationRecords.length > 0 ? (
          <Table
            dataSource={modificationRecords}
            rowKey="id"
            columns={[
              {
                title: '客户',
                dataIndex: 'customer_name',
                key: 'customer_name',
              },
              {
                title: '修改字段',
                dataIndex: 'field_name',
                key: 'field_name',
              },
              {
                title: '原值',
                dataIndex: 'old_value',
                key: 'old_value',
                ellipsis: true,
              },
              {
                title: '新值',
                dataIndex: 'new_value',
                key: 'new_value',
                ellipsis: true,
              },
              {
                title: '修改人',
                dataIndex: 'modified_by',
                key: 'modified_by',
              },
              {
                title: '修改时间',
                dataIndex: 'modified_at',
                key: 'modified_at',
                render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
              },
            ]}
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p>暂无修改记录</p>
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default CustomerList