import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Table, Button, Input, Space, message, Modal, Tag, Tooltip, Typography, Upload, Drawer, Divider, Select, DatePicker, Form, Radio, InputNumber, Dropdown, Menu } from 'antd'
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
  RollbackOutlined,
  DownOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { customerApi, constructionTeamApi, surveyorApi, dataCacheService } from '../services/api'
import { Customer, ImportResult } from '../types'
import * as XLSX from 'xlsx'
import { useAuth } from '../contexts/AuthContext'
import dayjs from 'dayjs'
import type { UploadProps } from 'antd'
import type { ColumnsType, ColumnType } from 'antd/es/table'
import { calculateAllFields } from '../utils/calculationUtils'
import Draggable from 'react-draggable'
import { supabase } from '../services/supabase';

const { Title } = Typography
const { confirm } = Modal
const { Dragger } = Upload

// 手动定义OutboundStatus类型
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
  // 添加分页相关状态
  const [pageSize, setPageSize] = useState<number>(100)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  
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
    { value: '已出图', label: '已出图', color: 'green' },
    { value: '变更1', label: '变更1', color: 'blue' },
    { value: '变更2', label: '变更2', color: 'purple' },
    { value: '变更3', label: '变更3', color: 'orange' },
    { value: '变更4', label: '变更4', color: 'red' },
    { value: '变更5', label: '变更5', color: 'volcano' },
  ];

  const [constructionTeams, setConstructionTeams] = useState<{name: string, phone: string}[]>([]);
  const [surveyors, setSurveyors] = useState<{ name: string; phone: string }[]>([])

  // 设计师选项
  const [designers, setDesigners] = useState<{name: string, phone: string}[]>([]);

  useEffect(() => {
    fetchCustomers()
    fetchConstructionTeams()
    fetchSurveyors()
    fetchDesigners()
  }, [])

  // 获取所有客户数据
  const fetchCustomers = async () => {
      setLoading(true)
    try {
      // 获取所有客户
      const data = await customerApi.getAll()
      
      // 应用计算字段并确保waiting格式的建设验收数据正确处理
      const processedData = data.map(customer => {
        // 处理计算字段
        let processedCustomer = { ...customer };
        if (customer.module_count && customer.module_count > 0) {
          const calculatedFields = calculateAllFields(customer.module_count);
          processedCustomer = {
            ...processedCustomer,
            ...calculatedFields
          };
        }
        
        // 特殊处理construction_acceptance字段，确保waiting格式在刷新后保留
        if (typeof customer.construction_acceptance === 'string') {
          // 如果以前是waiting格式但被后端误处理为日期字符串，尝试恢复
          if (customer.construction_acceptance_notes && 
              customer.construction_acceptance_notes.includes('等待中')) {
            // 从notes中提取等待天数
            const waitingMatch = customer.construction_acceptance_notes.match(/等待\s*(\d+)\s*天/);
            const waitDays = waitingMatch ? parseInt(waitingMatch[1], 10) : 7;
            
            // 使用setDate提取原始日期或使用当前日期
            let startDate = dayjs();
            try {
              if (dayjs(customer.construction_acceptance_date).isValid()) {
                startDate = dayjs(customer.construction_acceptance_date);
              }
            } catch (error) {
              console.warn('无法解析验收日期，使用当前日期');
            }
            
            // 重新构造waiting格式
            processedCustomer.construction_acceptance = `waiting:${waitDays}:${startDate.format('YYYY-MM-DD')}`;
            console.log(`恢复客户(${customer.id})的等待状态: ${processedCustomer.construction_acceptance}`);
          }
        }
        
        return processedCustomer;
      });
      
      setCustomers(processedData)
      setFilteredCustomers(processedData)
      setTotalPages(Math.ceil(processedData.length / pageSize)) // 更新总页数
      setCurrentPage(1) // 重置到第一页
      
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

  // 获取设计师信息
  const fetchDesigners = async () => {
    try {
      // 从客户表中提取唯一的设计师及其电话
      const { data, error } = await supabase
        .from('customers')
        .select('designer, designer_phone')
        .not('designer', 'is', null)
        .not('designer', 'eq', '')
        .order('designer', { ascending: true });

      if (error) {
        console.error('获取设计师数据失败:', error);
        return;
      }

      // 去重合并设计师信息
      const uniqueDesigners = new Map();
      data.forEach(item => {
        if (item.designer && !uniqueDesigners.has(item.designer)) {
          uniqueDesigners.set(item.designer, {
            name: item.designer,
            phone: item.designer_phone || ''
          });
        }
      });

      setDesigners(Array.from(uniqueDesigners.values()));
    } catch (err) {
      console.error('获取设计师数据时出错:', err);
    }
  };

  // 优化的搜索函数
  const performSearch = (value: string) => {
    // 如果搜索为空，直接返回所有数据
    if (!value.trim()) {
      setFilteredCustomers(customers);
      setTotalPages(Math.ceil(customers.length / pageSize));
      return;
    }

    // 支持空格或逗号分隔的多关键词搜索
    const keywords = value.toLowerCase()
      .split(/[\s,，]+/) // 按空格或中英文逗号分隔
      .filter(keyword => keyword.trim() !== ''); // 过滤掉空字符串
    
    // 使用高效的单次遍历过滤
    const filtered = customers.filter(customer => {
      // 只检查最重要的几个字段，减少遍历次数
      const name = (customer.customer_name || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      const address = (customer.address || '').toLowerCase();
      const salesman = (customer.salesman || '').toLowerCase();
      const idCard = (customer.id_card || '').toLowerCase();
      const meterNumber = (customer.meter_number || '').toLowerCase();
      
      // 对每个关键词进行检查，只要有一个关键词匹配任何字段就返回true
      return keywords.some(keyword => 
        name.includes(keyword) || 
        phone.includes(keyword) || 
        address.includes(keyword) || 
        salesman.includes(keyword) ||
        idCard.includes(keyword) ||
        meterNumber.includes(keyword)
      );
    });
    
    setFilteredCustomers(filtered);
    setTotalPages(Math.ceil(filtered.length / pageSize));
    
    // 只在真正需要时显示消息，且仅在用户显式触发搜索时（通过handleSearch函数）
    if (filtered.length === 0 && customers.length > 0 && value.length > 0) {
      // 消息显示逻辑移至handleSearch函数
    }
  };
  
  // 使用立即处理的方式代替防抖，避免延迟
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    
    // 只有在输入长度大于1或为空时才触发搜索，避免单个字符时的频繁搜索
    // 但不显示未找到的提示，只在用户主动搜索时才显示
    if (value.length > 1 || !value) {
      performSearch(value);
    }
  };

  // 判断单元格是否处于编辑状态
  const isEditing = (record: Customer, dataIndex: string) => {
    return record.id === editingCell?.id && dataIndex === editingCell?.dataIndex;
  };

  // 开始编辑单元格
  const edit = (record: Customer, dataIndex: string) => {
    console.log('开始编辑字段:', dataIndex, '客户ID:', record.id, '当前值:', record[dataIndex as keyof Customer]);
    setEditingCell({ id: record.id, dataIndex });
    
    // 如果是编辑施工队，预先设置施工队电话到表单
    if (dataIndex === 'construction_team') {
      const currentTeam = record.construction_team;
      const currentPhone = record.construction_team_phone;
      console.log('编辑施工队:', currentTeam, '当前电话:', currentPhone);
      
      // 用于防止电话覆盖
      editForm.setFieldsValue({
        construction_team: currentTeam,
        construction_team_phone: currentPhone
      });
    }
    
    // 设置当前编辑字段的值到表单
    editForm.setFieldsValue({
      [dataIndex]: record[dataIndex as keyof Customer]
    });
    
    // 针对特定字段的处理
    if (dataIndex === 'salesman') {
      // 同时设置业务员电话
      editForm.setFieldsValue({
        salesman_phone: record.salesman_phone
      });
    }
  };

  // 取消编辑
  const cancel = () => {
    setEditingCell(null);
  };

  /**
   * 保存编辑的单元格数据
   * @param {string} id - 客户ID
   */
  const saveEditedCell = async (id: string) => {
    if (!editingCell) return;
    
    try {
      // 验证表单字段
      const values = await editForm.validateFields();
      console.log('验证通过的编辑数据:', values);
      console.log('当前编辑单元格:', editingCell);
      
      // 创建更新对象
      const updateData: any = {};
      
      // 添加被编辑的字段
      const dataIndex = editingCell.dataIndex;
      updateData[dataIndex] = values[dataIndex];
      
      // 如果编辑施工队字段，同时保存施工队电话
      if (dataIndex === 'construction_team') {
        console.log('正在保存施工队字段:', values[dataIndex]);
        // 获取施工队电话并添加到更新数据中
        if (values.construction_team_phone !== undefined) {
          updateData.construction_team_phone = values.construction_team_phone;
          console.log('同时更新施工队电话:', values.construction_team_phone);
        } else if (values.construction_team) {
          // 如果没有明确设置电话但选择了施工队，尝试从施工队列表找到对应电话
          const teamInfo = constructionTeams.find(team => team.name === values.construction_team);
          if (teamInfo && teamInfo.phone) {
            updateData.construction_team_phone = teamInfo.phone;
            console.log('根据施工队名称自动设置电话:', teamInfo.phone);
          }
        } else {
          // 如果施工队被清空，也清空施工队电话
          updateData.construction_team_phone = null;
          console.log('施工队被清空，同时清空施工队电话');
        }
      }
      
      // 如果编辑的是施工队电话字段，将新电话更新到具有相同施工队名称的所有记录
      if (dataIndex === 'construction_team_phone') {
        console.log('正在更新施工队电话:', values.construction_team_phone);
      }
      
      // 如果编辑设计师字段，同时保存设计师电话
      if (dataIndex === 'designer') {
        console.log('正在保存设计师字段:', values[dataIndex]);
        // 获取设计师电话并添加到更新数据中
        if (values.designer_phone !== undefined) {
          updateData.designer_phone = values.designer_phone;
          console.log('同时更新设计师电话:', values.designer_phone);
        } else if (values.designer) {
          // 如果没有明确设置电话但选择了设计师，尝试从设计师列表找到对应电话
          const designerInfo = designers.find(designer => designer.name === values.designer);
          if (designerInfo && designerInfo.phone) {
            updateData.designer_phone = designerInfo.phone;
            console.log('根据设计师名称自动设置电话:', designerInfo.phone);
          }
        }
      }
      
      // 如果编辑踏勘员字段，同时保存踏勘员电话
      if (dataIndex === 'surveyor') {
        console.log('正在保存踏勘员字段:', values[dataIndex]);
        // 获取踏勘员电话并添加到更新数据中
        if (values.surveyor_phone !== undefined) {
          updateData.surveyor_phone = values.surveyor_phone;
          console.log('同时更新踏勘员电话:', values.surveyor_phone);
        } else if (values.surveyor) {
          // 如果没有明确设置电话但选择了踏勘员，尝试从踏勘员列表找到对应电话
          const surveyorInfo = surveyors.find(surveyor => surveyor.name === values.surveyor);
          if (surveyorInfo && surveyorInfo.phone) {
            updateData.surveyor_phone = surveyorInfo.phone;
            console.log('根据踏勘员名称自动设置电话:', surveyorInfo.phone);
          }
        }
      }
      
      // 如果编辑业务员字段，同时保存业务员电话
      if (dataIndex === 'salesman') {
        console.log('正在保存业务员字段:', values[dataIndex]);
        // 获取业务员电话并添加到更新数据中
        if (values.salesman_phone !== undefined) {
          updateData.salesman_phone = values.salesman_phone;
          console.log('同时更新业务员电话:', values.salesman_phone);
        } else if (values.salesman) {
          // 如果没有明确设置电话但选择了业务员，尝试从业务员列表找到对应电话
          const salesmanInfo = salesmenList.find(salesman => salesman.name === values.salesman);
          if (salesmanInfo && salesmanInfo.phone) {
            updateData.salesman_phone = salesmanInfo.phone;
            console.log('根据业务员名称自动设置电话:', salesmanInfo.phone);
          }
        }
      }
      
      // 特别处理module_count字段
      if (dataIndex === 'module_count') {
        const moduleCountValue = values.module_count;
        console.log('处理module_count值:', moduleCountValue, '类型:', typeof moduleCountValue);
        
        // 如果为空字符串或undefined，设置为null
        if (moduleCountValue === '' || moduleCountValue === undefined) {
          // 当组件数量为空时，相关字段也设置为空值
          updateData.module_count = null;
          updateData.capacity = null;
          updateData.investment_amount = null;
          updateData.land_area = null;
          console.log('将module_count及相关字段的值转换为null');
        } else if (typeof moduleCountValue === 'string') {
          // 如果是字符串，尝试转换为数字
          const numValue = Number(moduleCountValue);
          if (!isNaN(numValue)) {
            updateData.module_count = numValue;
            console.log('将module_count字符串转换为数字:', moduleCountValue, '->', numValue);
            
            // 如果是有效数字，计算相关字段
            if (numValue > 0) {
              const calculatedFields = calculateAllFields(numValue);
              Object.assign(updateData, calculatedFields);
              console.log('自动计算相关字段:', calculatedFields);
              } else {
              // 如果组件数量为0，相关字段也设置为空值
              updateData.capacity = null;
              updateData.investment_amount = null;
              updateData.land_area = null;
              console.log('组件数量为0，相关字段设置为null');
              }
            } else {
            // 无效的数字字符串，组件数量及相关字段都设置为null
            updateData.module_count = null;
            updateData.capacity = null;
            updateData.investment_amount = null;
            updateData.land_area = null;
            console.log('将module_count无效字符串及相关字段转换为null:', moduleCountValue);
          }
        } else if (typeof moduleCountValue === 'number') {
          // 如果已经是数字类型，且是有效数字，计算相关字段
          if (!isNaN(moduleCountValue) && moduleCountValue > 0) {
            const calculatedFields = calculateAllFields(moduleCountValue);
            Object.assign(updateData, calculatedFields);
            console.log('数字类型，自动计算相关字段:', calculatedFields);
          } else {
            // 数字为0或NaN，相关字段也设置为空值
            updateData.capacity = null;
            updateData.investment_amount = null;
            updateData.land_area = null;
            console.log('组件数量为0或NaN，相关字段设置为null');
          }
        }
      }
      
      // 特殊处理图纸变更字段
      if (dataIndex === 'drawing_change') {
        if (values.drawing_change === undefined || values.drawing_change === '') {
          updateData.drawing_change = '无变更';
        }
      }
      
      // 记录将发送到API的数据
      console.log('将发送到API的更新数据:', updateData);
      
      // 使用缓存服务更新数据
      customerApi.updateWithCache(id, updateData);
      
      // 查找当前编辑客户的索引
      const index = customers.findIndex(customer => customer.id === id);
      const filteredIndex = filteredCustomers.findIndex(customer => customer.id === id);
      
      if (index > -1) {
        // 更新本地状态
        const newCustomers = [...customers];
        newCustomers[index] = { ...newCustomers[index], ...updateData };
        console.log('更新后的客户数据:', newCustomers[index]);
        setCustomers(newCustomers);
      }
      
      if (filteredIndex > -1) {
        // 更新筛选后的数据
        const newFilteredCustomers = [...filteredCustomers];
        newFilteredCustomers[filteredIndex] = { ...newFilteredCustomers[filteredIndex], ...updateData };
        setFilteredCustomers(newFilteredCustomers);
      }
      
      // 退出编辑状态
      setEditingCell(null);
      
      // 显示成功消息
      message.success('数据已更新');
      
      // 如果编辑的是施工队电话，自动更新所有相同施工队名称的记录
      if (dataIndex === 'construction_team_phone') {
        const currentCustomer = customers.find(customer => customer.id === id);
        if (currentCustomer && currentCustomer.construction_team && values.construction_team_phone) {
          const teamName = currentCustomer.construction_team;
          const newPhone = values.construction_team_phone;
          console.log(`准备更新所有施工队 "${teamName}" 的电话为 ${newPhone}`);
          
          // 找到所有具有相同施工队名称的记录
          const recordsToUpdate = customers.filter(
            c => c.id !== id && c.construction_team === teamName
          );
          
          if (recordsToUpdate.length > 0) {
            console.log(`找到 ${recordsToUpdate.length} 条需要更新电话的记录`);
            
            // 批量更新这些记录
            const updatePromises = recordsToUpdate.map(customer => {
              return customerApi.updateWithCache(customer.id, {
                construction_team_phone: newPhone
              });
            });
            
            // 等待所有更新完成
            await Promise.all(updatePromises);
            
            // 更新本地状态
            setCustomers(prev => 
              prev.map(customer => 
                customer.construction_team === teamName
                  ? { ...customer, construction_team_phone: newPhone }
                  : customer
              )
            );
            
            setFilteredCustomers(prev => 
              prev.map(customer => 
                customer.construction_team === teamName
                  ? { ...customer, construction_team_phone: newPhone }
                  : customer
              )
            );
            
            message.success(`已自动更新所有"${teamName}"的电话号码`);
          } else {
            console.log('没有找到其他需要更新电话的相同施工队记录');
          }
        }
      }
      
      // 如果编辑的是设计师电话，自动更新所有相同设计师名称的记录
      if (dataIndex === 'designer_phone') {
        const currentCustomer = customers.find(customer => customer.id === id);
        if (currentCustomer && currentCustomer.designer && values.designer_phone) {
          const designerName = currentCustomer.designer;
          const newPhone = values.designer_phone;
          console.log(`准备更新所有设计师 "${designerName}" 的电话为 ${newPhone}`);
          
          // 找到所有具有相同设计师名称的记录
          const recordsToUpdate = customers.filter(
            c => c.id !== id && c.designer === designerName
          );
          
          if (recordsToUpdate.length > 0) {
            console.log(`找到 ${recordsToUpdate.length} 条需要更新电话的记录`);
            
            // 批量更新这些记录
            const updatePromises = recordsToUpdate.map(customer => {
              return customerApi.updateWithCache(customer.id, {
                designer_phone: newPhone
              });
            });
            
            // 等待所有更新完成
            await Promise.all(updatePromises);
            
            // 更新本地状态
            setCustomers(prev => 
              prev.map(customer => 
                customer.designer === designerName
                  ? { ...customer, designer_phone: newPhone }
                  : customer
              )
            );
            
            setFilteredCustomers(prev => 
              prev.map(customer => 
                customer.designer === designerName
                  ? { ...customer, designer_phone: newPhone }
                  : customer
              )
            );
            
            message.success(`已自动更新所有"${designerName}"的电话号码`);
          } else {
            console.log('没有找到其他需要更新电话的相同设计师记录');
          }
        }
      }
      
      // 如果编辑的是踏勘员电话，自动更新所有相同踏勘员名称的记录
      if (dataIndex === 'surveyor_phone') {
        const currentCustomer = customers.find(customer => customer.id === id);
        if (currentCustomer && currentCustomer.surveyor && values.surveyor_phone) {
          const surveyorName = currentCustomer.surveyor;
          const newPhone = values.surveyor_phone;
          console.log(`准备更新所有踏勘员 "${surveyorName}" 的电话为 ${newPhone}`);
          
          // 找到所有具有相同踏勘员名称的记录
          const recordsToUpdate = customers.filter(
            c => c.id !== id && c.surveyor === surveyorName
          );
          
          if (recordsToUpdate.length > 0) {
            console.log(`找到 ${recordsToUpdate.length} 条需要更新电话的记录`);
            
            // 批量更新这些记录
            const updatePromises = recordsToUpdate.map(customer => {
              return customerApi.updateWithCache(customer.id, {
                surveyor_phone: newPhone
              });
            });
            
            // 等待所有更新完成
            await Promise.all(updatePromises);
            
            // 更新本地状态
            setCustomers(prev => 
              prev.map(customer => 
                customer.surveyor === surveyorName
                  ? { ...customer, surveyor_phone: newPhone }
                  : customer
              )
            );
            
            setFilteredCustomers(prev => 
              prev.map(customer => 
                customer.surveyor === surveyorName
                  ? { ...customer, surveyor_phone: newPhone }
                  : customer
              )
            );
            
            message.success(`已自动更新所有"${surveyorName}"的电话号码`);
          } else {
            console.log('没有找到其他需要更新电话的相同踏勘员记录');
          }
        }
      }
      
      // 如果编辑的是业务员电话，自动更新所有相同业务员名称的记录
      if (dataIndex === 'salesman_phone') {
        const currentCustomer = customers.find(customer => customer.id === id);
        if (currentCustomer && currentCustomer.salesman && values.salesman_phone) {
          const salesmanName = currentCustomer.salesman;
          const newPhone = values.salesman_phone;
          console.log(`准备更新所有业务员 "${salesmanName}" 的电话为 ${newPhone}`);
          
          // 找到所有具有相同业务员名称的记录
          const recordsToUpdate = customers.filter(
            c => c.id !== id && c.salesman === salesmanName
          );
          
          if (recordsToUpdate.length > 0) {
            console.log(`找到 ${recordsToUpdate.length} 条需要更新电话的记录`);
            
            // 批量更新这些记录
            const updatePromises = recordsToUpdate.map(customer => {
              return customerApi.updateWithCache(customer.id, {
                salesman_phone: newPhone
              });
            });
            
            // 等待所有更新完成
            await Promise.all(updatePromises);
            
            // 更新本地状态
            setCustomers(prev => 
              prev.map(customer => 
                customer.salesman === salesmanName
                  ? { ...customer, salesman_phone: newPhone }
                  : customer
              )
            );
            
            setFilteredCustomers(prev => 
              prev.map(customer => 
                customer.salesman === salesmanName
                  ? { ...customer, salesman_phone: newPhone }
                  : customer
              )
            );
            
            message.success(`已自动更新所有"${salesmanName}"的电话号码`);
          } else {
            console.log('没有找到其他需要更新电话的相同业务员记录');
          }
        }
      }
    } catch (error) {
      console.error('保存编辑数据失败:', error);
      message.error('保存失败，请重试');
    }
  };

  // 修改可编辑日期单元格中的handleDateChange函数
  const handleDateChange = async (date: any, record: Customer, dataIndex: string) => {
    try {
      if (!record.id) {
        console.error('保存错误: 无效的记录ID');
        message.error('保存失败: 记录标识无效');
        return;
      }
      
      // 准备更新数据
      const dataToUpdate = {
        [dataIndex]: date ? date.toISOString() : null
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(record.id, dataToUpdate);
      
      // 更新本地状态
      setCustomers(prev => 
        prev.map(customer => (customer.id === record.id ? { ...customer, ...updatedCustomer } : customer))
      );
      setFilteredCustomers(prev => 
        prev.map(customer => (customer.id === record.id ? { ...customer, ...updatedCustomer } : customer))
      );
        
        // 退出编辑状态
      setEditingCell(null);
      message.success('日期更新成功');
    } catch (error) {
      console.error('更新日期失败:', error);
      message.error('更新失败');
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
          // 使用数据缓存服务删除客户（前端立即删除，后台静默处理）
          customerApi.deleteWithCache(id);
          
          // 更新本地状态
          setCustomers(prev => prev.filter(customer => customer.id !== id));
          setFilteredCustomers(prev => prev.filter(customer => customer.id !== id));
          
          message.success('客户删除成功');
        } catch (error) {
          message.error('删除客户失败');
          console.error(error);
        }
      }
    });
  };

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
          module_count: row['组件数量'] ? parseInt(row['组件数量']) : null, // 允许组件数量为空
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
          onPressEnter={() => record.id && saveEditedCell(record.id)} 
          placeholder={required ? `请输入${title}` : `${title}(可选)`}
          autoFocus
          onBlur={() => record.id && saveEditedCell(record.id)}
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
          onBlur={() => record.id && saveEditedCell(record.id)}
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
          onBlur={() => record.id && saveEditedCell(record.id)}
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

  // 可编辑日期单元格
  const EditableDateCell = ({ value, record, dataIndex, title }: { 
    value: any; 
    record: Customer; 
    dataIndex: string; 
    title: string; 
  }) => {
    const editable = isEditing(record, dataIndex);
    const [hover, setHover] = useState(false);
    
    // 安全地转换日期值为dayjs对象
    let safeDate = null;
    if (value) {
      try {
        safeDate = dayjs(value);
        if (!safeDate.isValid()) {
          safeDate = null;
        }
      } catch (error) {
        console.error(`解析${title}错误:`, error);
        safeDate = null;
      }
    }
    
    // 打开编辑模式
    const handleEdit = () => {
      if (editingCell !== null) return; // 如果已经在编辑其他单元格，则不执行
          edit(record, dataIndex);
    };
    
    return editable ? (
      <DatePicker 
        style={{ width: '100%' }} 
        format="YYYY-MM-DD"
        defaultValue={safeDate}
        open={true} // 自动打开日期选择器
        onChange={(date) => handleDateChange(date, record, dataIndex)} // 选择日期时就保存
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
      title: '设计师',
      dataIndex: 'designer',
      key: 'designer',
      width: 120,
      sorter: (a, b) => (a.designer || '').localeCompare(b.designer || ''),
      ellipsis: true,
      render: (value, record) => <DesignerCell value={value} record={record} />
    },
    {
      title: '设计师电话',
      dataIndex: 'designer_phone',
      key: 'designer_phone',
      width: 130,
      ellipsis: true,
      render: (value, record) => <DesignerPhoneCell value={value} record={record} />
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
      sorter: (a, b) => {
        // 处理station_management可能是string或string[]的情况
        const aArray = Array.isArray(a.station_management) ? a.station_management : 
                     (a.station_management ? [a.station_management] : []);
        const bArray = Array.isArray(b.station_management) ? b.station_management : 
                     (b.station_management ? [b.station_management] : []);
        
        // 首先按数量排序
        if (aArray.length !== bArray.length) {
          return aArray.length - bArray.length;
        }
        
        // 如果数量相同，按内容排序
        const aStr = aArray.join(',');
        const bStr = bArray.join(',');
        return aStr.localeCompare(bStr);
      },
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
        
        // 显示图纸变更选项下拉菜单
        const menu = (
          <Menu onClick={({ key }) => record.id && handleDrawingChangeClick(record.id, key as string)}>
            {DRAWING_CHANGE_OPTIONS.map(option => (
              <Menu.Item key={option.value}>
                <Tag color={option.color} style={{ margin: 0 }}>
                  {option.label}
                </Tag>
              </Menu.Item>
            ))}
          </Menu>
        );
        
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Dropdown overlay={menu} trigger={['click']}>
              <Button 
              ghost
              type={btnTypeMap[option.color] || 'default'}
              style={btnStyleMap[option.color] || {}}
                size="small"
            >
                {option.label} <DownOutlined />
            </Button>
            </Dropdown>
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
              onClick={() => record.id && handleUrgeOrderClick(record.id)}
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
          return <span style={{ color: '#999' }}>-</span>;
        }

        // 检查是否有出库日期（时间戳）
        const outboundDate = record.inverter_outbound_date ? 
          dayjs(record.inverter_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={record.inverter_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundClick(record.id, 'inverter')}
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
        // 如果组件数量为空或过少，显示"无法确定型号"
        if (!record.module_count || record.module_count < 10) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        // 检查是否有出库日期（时间戳）
        const outboundDate = record.copper_wire_outbound_date ? 
          dayjs(record.copper_wire_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={record.copper_wire_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundClick(record.id, 'copper_wire')}
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
        // 如果组件数量为空或过少，显示"无法确定型号"
        if (!record.module_count || record.module_count < 10) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        // 检查是否有出库日期（时间戳）
        const outboundDate = record.aluminum_wire_outbound_date ? 
          dayjs(record.aluminum_wire_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={record.aluminum_wire_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundClick(record.id, 'aluminum_wire')}
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
        // 如果组件数量为空或过少，显示"无法确定型号"
        if (!record.module_count || record.module_count < 10) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        // 检查是否有出库日期（时间戳）
        const outboundDate = record.distribution_box_outbound_date ? 
          dayjs(record.distribution_box_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出库"}>
            <Tag 
              color={record.distribution_box_outbound_date ? "green" : "blue"}
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundClick(record.id, 'distribution_box')}
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
              onClick={() => handleItemOutboundClick(record.id, 'square_steel')}
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
              onClick={() => handleItemOutboundClick(record.id, 'square_steel')}
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
              onClick={() => handleItemOutboundClick(record.id, 'square_steel')}
            >
              出库
            </Button>
          );
        }
      },
      sorter: (a: Customer, b: Customer) => {
        // 状态优先级：none(未出库) < outbound(已出库) < inbound(已回库) < returned(退单)
        const statusPriority: Record<OutboundStatus, number> = {
          'none': 0,
          'outbound': 1,
          'inbound': 2,
          'returned': 3
        };
        
        const aStatus = a.square_steel_status || 'none';
        const bStatus = b.square_steel_status || 'none';
        
        // 首先按状态优先级排序
        if (statusPriority[aStatus] !== statusPriority[bStatus]) {
          return statusPriority[aStatus] - statusPriority[bStatus];
        }
        
        // 如果状态相同且都是出库状态，按出库日期排序
        if (aStatus === 'outbound' && bStatus === 'outbound') {
          const aDate = a.square_steel_outbound_date ? new Date(a.square_steel_outbound_date).getTime() : 0;
          const bDate = b.square_steel_outbound_date ? new Date(b.square_steel_outbound_date).getTime() : 0;
          return aDate - bDate;
        }
        
        // 如果状态相同且都是回库状态，按回库日期排序
        if (aStatus === 'inbound' && bStatus === 'inbound') {
          const aDate = a.square_steel_inbound_date ? new Date(a.square_steel_inbound_date).getTime() : 0;
          const bDate = b.square_steel_inbound_date ? new Date(b.square_steel_inbound_date).getTime() : 0;
          return aDate - bDate;
        }
        
        // 其他情况返回0
        return 0;
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
              onClick={() => handleItemOutboundClick(record.id, 'component')}
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
              onClick={() => handleItemOutboundClick(record.id, 'component')}
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
              onClick={() => handleItemOutboundClick(record.id, 'component')}
            >
              出库
            </Button>
          );
        }
      },
      sorter: (a: Customer, b: Customer) => {
        // 状态优先级：none(未出库) < outbound(已出库) < inbound(已回库) < returned(退单)
        const statusPriority: Record<OutboundStatus, number> = {
          'none': 0,
          'outbound': 1,
          'inbound': 2,
          'returned': 3
        };
        
        const aStatus = a.component_status || 'none';
        const bStatus = b.component_status || 'none';
        
        // 首先按状态优先级排序
        if (statusPriority[aStatus] !== statusPriority[bStatus]) {
          return statusPriority[aStatus] - statusPriority[bStatus];
        }
        
        // 如果状态相同且都是出库状态，按出库日期排序
        if (aStatus === 'outbound' && bStatus === 'outbound') {
          const aDate = a.component_outbound_date ? new Date(a.component_outbound_date).getTime() : 0;
          const bDate = b.component_outbound_date ? new Date(b.component_outbound_date).getTime() : 0;
          return aDate - bDate;
        }
        
        // 如果状态相同且都是回库状态，按回库日期排序
        if (aStatus === 'inbound' && bStatus === 'inbound') {
          const aDate = a.component_inbound_date ? new Date(a.component_inbound_date).getTime() : 0;
          const bDate = b.component_inbound_date ? new Date(b.component_inbound_date).getTime() : 0;
          return aDate - bDate;
        }
        
        // 其他情况返回0
        return 0;
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
      render: (value, record) => {
        console.log('渲染施工队字段:', record.id, value);
        return <EditableCell value={value} record={record} dataIndex="construction_team" title="施工队" required={false} />;
      }
    },
    {
      title: '施工队电话',
      dataIndex: 'construction_team_phone',
      key: 'construction_team_phone',
      sorter: (a, b) => (a.construction_team_phone || '').localeCompare(b.construction_team_phone || ''),
      ellipsis: true,
      render: (value, record) => {
        console.log('渲染施工队电话字段:', record.id, value);
        return <ConstructionTeamPhoneCell value={value} record={record} />;
      }
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
          // 检查是否为有效日期
          let reviewTime = '未知时间';
          try {
            // 使用dayjs检查是否为有效日期，如果无效会抛出警告
            if (dayjs(text).isValid()) {
              reviewTime = dayjs(text).format('YYYY-MM-DD HH:mm');
            } else if (text === true || text === 'true' || text === 'false' || text === false) {
              // 处理布尔值情况
              reviewTime = dayjs().format('YYYY-MM-DD HH:mm');
              console.warn(`技术审核字段为布尔值: ${text}，使用当前时间替代`);
            } else {
              console.warn(`无效的技术审核日期: ${text}`);
            }
          } catch (error) {
            console.error('技术审核日期格式化错误:', error);
          }
          
          const canReset = userRole === 'admin';
          
          return (
            <Tooltip title={canReset ? '点击重置为待审核状态' : `审核通过时间: ${reviewTime}`}>
              <Tag 
                color="green"
                style={{ cursor: canReset ? 'pointer' : 'default' }}
                onClick={() => canReset && record.id && handleTechnicalReviewChange(record.id, 'reset')}
              >
                <CheckCircleOutlined /> {reviewTime}
              </Tag>
            </Tooltip>
          );
        } else if (record.technical_review_rejected) {
          // 如果被驳回，从technical_review_rejected字段提取时间信息
          let rejectionTime = '未知时间';
          
          // 尝试从状态中提取时间
          const match = record.technical_review_rejected.match(/技术驳回 \(([0-9/\-.: ]+)\)/);
          if (match && match[1]) {
            rejectionTime = match[1];
          } else {
            // 如果没有匹配到时间格式，直接使用字段原始值
            rejectionTime = String(record.technical_review_rejected).replace('技术驳回', '').trim();
            if (rejectionTime.startsWith('(') && rejectionTime.endsWith(')')) {
              rejectionTime = rejectionTime.substring(1, rejectionTime.length - 1).trim();
            }
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
        
        try {
          // 确保日期比较不会因格式无效而崩溃
          const aTime = dayjs(a.technical_review).isValid() ? 
            new Date(a.technical_review).getTime() : 0;
          const bTime = dayjs(b.technical_review).isValid() ? 
            new Date(b.technical_review).getTime() : 0;
          return aTime - bTime;
        } catch (e) {
          console.error('排序日期错误:', e);
          return 0;
        }
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
                onClick={() => canReset && record.id && handleUploadToGridChange(record.id)}
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
              onClick={() => record.id && handleUploadToGridChange(record.id)}
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
              
              try {
                // 检查日期有效性
                if (dayjs(startDate).isValid()) {
              // 计算从开始日期至今已等待天数
              const elapsedDays = dayjs().diff(dayjs(startDate), 'day');
              // 计算当前累计等待天数
              const totalWaitDays = initialDays + elapsedDays;
              
              displayText = `已等待 ${totalWaitDays} 天`;
                } else {
                  console.warn(`建设验收等待起始日期无效: ${startDate}`);
                  displayText = `已等待 ${initialDays} 天`;
                }
              } catch (error) {
                console.error('计算等待天数错误:', error);
                displayText = `已等待 ${initialDays} 天`;
              }
            } else {
              displayText = '等待中';
            }
          } else {
            // 普通日期显示
            try {
              // 检查日期有效性
              if (dayjs(text).isValid()) {
            displayText = dayjs(text).format('YYYY-MM-DD HH:mm');
              } else if (text === true || text === 'true' || text === false || text === 'false') {
                // 处理布尔值情况
                displayText = dayjs().format('YYYY-MM-DD HH:mm');
                console.warn(`建设验收日期字段为布尔值: ${text}，使用当前时间替代`);
              } else {
                console.warn(`无效的建设验收日期: ${text}`);
                displayText = '已验收';
              }
            } catch (error) {
              console.error('建设验收日期格式化错误:', error);
              displayText = '已验收';
            }
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
        
        try {
          // 确保日期比较不会因格式无效而崩溃
          const aTime = dayjs(a.construction_acceptance).isValid() ? 
            new Date(a.construction_acceptance).getTime() : 0;
          const bTime = dayjs(b.construction_acceptance).isValid() ? 
            new Date(b.construction_acceptance).getTime() : 0;
          return aTime - bTime;
        } catch (e) {
          console.error('排序日期错误:', e);
          return 0;
        }
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
                onClick={() => canReset && record.id && handleMeterInstallationChange(record.id)}
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
              onClick={() => record.id && handleMeterInstallationChange(record.id)}
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
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'delete',
                    danger: true,
                    label: (
                      <Typography.Text onClick={() => handleDelete(record.id, record.customer_name)}>
                        删除
                      </Typography.Text>
                    ),
                  },
                  // ... 其他菜单项
                ],
              }}
            >
          <Button 
            type="text" 
            size="small"
                icon={<DeleteOutlined />} 
            style={{ padding: '0 4px' }}
                title="更多操作"
          />
            </Dropdown>
          </Space>
    );
      },
    },
  ];
  
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
          onPressEnter={() => record.id ? saveEditedCell(record.id) : undefined} 
          onBlur={() => record.id ? saveEditedCell(record.id) : undefined}
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

  // 创建施工队可编辑单元格
  const ConstructionTeamCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'construction_team');
    const [hover, setHover] = useState(false);
    
    // 将施工队数据转换为Select选项格式
    const constructionTeamOptions = constructionTeams.map(team => ({
      value: team.name,
      label: team.name,
      phone: team.phone || ''
    }));
    
    // 添加一个清空选项
    constructionTeamOptions.unshift({
      value: '',
      label: '清空施工队',
      phone: ''
    });
    
    console.log('渲染施工队单元格:', value);
    
    return editable ? (
      <Form.Item
        name="construction_team"
        style={{ margin: 0 }}
        initialValue={value}
      >
        <Select
          placeholder="请选择施工队"
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={constructionTeamOptions}
          onBlur={() => record.id ? saveEditedCell(record.id) : undefined}
          onChange={(value, option) => {
            // 如果选择了施工队，自动填充电话
            if (value && typeof option === 'object' && 'phone' in option) {
              editForm.setFieldsValue({ construction_team_phone: option.phone });
            } else if (!value) {
              // 如果清空了施工队，也清空电话
              editForm.setFieldsValue({ construction_team_phone: '' });
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

  // 处理施工状态变更
  const handleConstructionStatusChange = async (id: string | undefined, currentStatus: string | null) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    // 如果当前状态已设置，标记为未完成，否则标记为完成并记录日期
    const newStatus = currentStatus ? null : new Date().toISOString();
      
    try {
      // 明确指定类型为Partial<Customer>
      const updateData: Partial<Customer> = {
        construction_status: newStatus
        // 移除construction_date字段，因为数据库中不存在此字段
      };
      
      // 使用数据缓存服务更新数据
      customerApi.updateWithCache(id, updateData);
      
      // 更新本地状态 - 直接使用updateData而非更新后的返回值
      setCustomers(prev => 
        prev.map(customer => {
          if (customer.id === id) {
            return { ...customer, ...updateData };
          }
          return customer;
        })
      );
      
      setFilteredCustomers(prev => 
        prev.map(customer => {
          if (customer.id === id) {
            return { ...customer, ...updateData };
          }
          return customer;
        })
      );
      
      message.success(newStatus ? '已标记为施工完成' : '已标记为未施工');
    } catch (error) {
      console.error('更新施工状态失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 处理技术审核状态变更
  const handleTechnicalReviewChange = async (id: string | undefined, status: 'approved' | 'rejected' | 'reset') => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      let updateObj: Record<string, any> = {};
      
      if (status === 'approved') {
        // 使用dayjs处理日期，确保格式一致
        const now = dayjs();
        const formattedDate = now.format('YYYY-MM-DD HH:mm:ss');
        
        updateObj = {
          technical_review: now.toISOString(), // 使用ISO标准格式存储
          technical_review_date: now.toISOString(),
          technical_review_notes: '已通过技术审核',
          technical_review_rejected: null // 清除驳回状态
        };
      } else if (status === 'rejected') {
        const now = dayjs();
        const formattedDate = now.format('YYYY-MM-DD HH:mm:ss');
        
        updateObj = {
          technical_review: null, // 设置为null而非false
          technical_review_date: now.toISOString(),
          technical_review_notes: '技术审核不通过',
          technical_review_rejected: `技术驳回 (${formattedDate})` // 使用格式化的日期时间
        };
      } else {
        // 重置状态
        updateObj = {
          technical_review: null,
          technical_review_date: null,
          technical_review_notes: null,
          technical_review_rejected: null
        };
      }
      
      // 使用数据缓存服务更新数据
      customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状态 - 使用传入的updateObj而非updatedCustomer，确保UI立即更新
      setCustomers(prev => 
        prev.map(customer => (customer.id === id ? { ...customer, ...updateObj } : customer))
      );
      setFilteredCustomers(prev => 
        prev.map(customer => (customer.id === id ? { ...customer, ...updateObj } : customer))
      );
      
      const statusText = 
        status === 'approved' ? '已通过技术审核' : 
        status === 'rejected' ? '已标记为技术审核不通过' : 
        '已重置技术审核状态';
      
      message.success(statusText);
    } catch (error) {
      console.error('更新技术审核状态失败:', error);
      message.error('操作失败，请重试');
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
  const handleUploadToGridChange = async (id: string | undefined) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('未找到客户信息');
        return;
      }
      
      // 切换上传国网状态，当前有值则清空，无值则设置为当前日期
      const updateObj: Record<string, any> = {
        upload_to_grid: customer.upload_to_grid ? null : new Date().toISOString()
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状态
      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      message.success(customer.upload_to_grid ? '已重置上传国网状态' : '已标记为已上传国网');
    } catch (error) {
      console.error('更新上传国网状态失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 处理电表安装日期变更
  const handleMeterInstallationChange = async (id: string | undefined) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('未找到客户信息');
        return;
      }
      
      // 切换电表安装状态，当前有值则清空，无值则设置为当前日期
      const updateObj: Record<string, any> = {
        meter_installation_date: customer.meter_installation_date ? null : new Date().toISOString()
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状态
      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      message.success(customer.meter_installation_date ? '已重置电表安装状态' : '已标记为电表已安装');
    } catch (error) {
      console.error('更新电表安装状态失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 处理建设验收状态变更
  const handleConstructionAcceptanceChange = async (id: string | undefined, currentStatus: string | null, days?: number) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      const now = dayjs();
      let updateObj: Record<string, any> = {};
      
      if (currentStatus) {
        // 如果已经验收，则重置验收状态
        updateObj = {
          construction_acceptance: null,
          construction_acceptance_date: null,
          construction_acceptance_notes: null
        };
      } else if (days) {
        // 如果选择了等待天数选项，使用特殊格式"waiting:天数:开始日期"
        updateObj = {
          construction_acceptance: `waiting:${days}:${now.format('YYYY-MM-DD')}`,
          construction_acceptance_date: now.toISOString(),
          construction_acceptance_notes: `等待中 - 设置于 ${now.format('YYYY-MM-DD HH:mm:ss')}`
        };
      } else {
        // 如果未验收且没有设置等待天数，则标记为验收完成
        updateObj = {
          construction_acceptance: now.toISOString(),
          construction_acceptance_date: now.toISOString(),
          construction_acceptance_notes: '今日验收完成'
        };
      }
      
      // 使用数据缓存服务更新数据
      customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状态 - 使用updateObj而非updatedCustomer，确保UI立即更新
      setCustomers(prev => 
        prev.map(customer => (customer.id === id ? { ...customer, ...updateObj } : customer))
      );
      setFilteredCustomers(prev => 
        prev.map(customer => (customer.id === id ? { ...customer, ...updateObj } : customer))
      );
      
      const successMsg = currentStatus ? '已重置验收状态' : 
                         days ? `已设置为等待 ${days} 天` : 
                         '已标记为验收完成';
      message.success(successMsg);
    } catch (error) {
      console.error('更新验收状态失败:', error);
      message.error('操作失败，请重试');
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
              <Radio value="wait">设置等待天数</Radio>
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
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        try {
          if (radioValue === 'wait') {
            // 设置等待天数
            await handleConstructionAcceptanceChange(id, null, waitDays);
          } else {
            // 立即标记为已推到
            await handleConstructionAcceptanceChange(id, null);
          }
          return Promise.resolve();
        } catch (error) {
          console.error('设置建设验收状态失败:', error);
          return Promise.reject(error);
        }
      }
    });
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
      const updateObj = {
        status: newStatus
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状态
      setCustomers(prev => 
        prev.map(customer => (customer.id === id ? { ...customer, ...updatedCustomer } : customer))
      );
      setFilteredCustomers(prev => 
        prev.map(customer => (customer.id === id ? { ...customer, ...updatedCustomer } : customer))
      );
      
      message.success(`状态已更新为: ${newStatus}`);
    } catch (error) {
      console.error('更新状态失败:', error);
      message.error('操作失败，请重试');
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
      <Space>
        <Button 
          size="small"
          type={pageSize === 100 ? "primary" : "default"}
          onClick={() => handlePageSizeChange(100)}
        >
          100条/页
        </Button>
        <Button 
          size="small"
          type={pageSize === 500 ? "primary" : "default"}
          onClick={() => handlePageSizeChange(500)}
        >
          500条/页
        </Button>
        <Button 
          size="small"
          type={pageSize === 1000 ? "primary" : "default"}
          onClick={() => handlePageSizeChange(1000)}
        >
          1000条/页
        </Button>
        <Select
          size="small"
          style={{ width: 100 }}
          value={currentPage}
          onChange={handlePageChange}
          placeholder="选择页码"
        >
          {Array.from({ length: totalPages }, (_, i) => (
            <Select.Option key={i + 1} value={i + 1}>
              {i + 1} / {totalPages}
            </Select.Option>
          ))}
        </Select>
      </Space>
      <Space>
        <Input
          placeholder="搜索客户名称/电话/地址 (多关键词用空格或逗号分隔)"
          value={searchText}
          onChange={handleInputChange}
          onPressEnter={(e) => handleSearch(searchText)}
          style={{ width: 250 }}
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
          onBlur={() => record.id ? saveEditedCell(record.id) : undefined}
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
          onPressEnter={() => record.id ? saveEditedCell(record.id) : undefined}
          onBlur={() => record.id ? saveEditedCell(record.id) : undefined}
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

  // 添加页码改变的处理函数
  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  }
  
  // 添加页面大小改变的处理函数
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // 重置到第一页
    setTotalPages(Math.ceil(filteredCustomers.length / size));
  }
  
  // 计算当前页显示的数据
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage, pageSize]);

  // 修改handleSearch函数，用于按钮点击和Enter键触发搜索
  const handleSearch = (value: string) => {
    setCurrentPage(1); // 搜索时重置到第一页
    performSearch(value);
    
    // 在这里显示未找到匹配的提示，因为这是用户主动触发的搜索
    if (value.trim().length > 0) {
      // 支持空格或逗号分隔的多关键词搜索
      const keywords = value.toLowerCase()
        .split(/[\s,，]+/) // 按空格或中英文逗号分隔
        .filter(keyword => keyword.trim() !== ''); // 过滤掉空字符串
      
      const filtered = customers.filter(customer => {
        const name = (customer.customer_name || '').toLowerCase();
        const phone = (customer.phone || '').toLowerCase();
        const address = (customer.address || '').toLowerCase();
        const salesman = (customer.salesman || '').toLowerCase();
        const idCard = (customer.id_card || '').toLowerCase();
        const meterNumber = (customer.meter_number || '').toLowerCase();
        
        // 对每个关键词进行检查，只要有一个关键词匹配任何字段就返回true
        return keywords.some(keyword => 
          name.includes(keyword) || 
          phone.includes(keyword) || 
          address.includes(keyword) || 
          salesman.includes(keyword) ||
          idCard.includes(keyword) ||
          meterNumber.includes(keyword)
        );
      });
      
      if (filtered.length === 0 && customers.length > 0) {
        message.info(`未找到匹配"${value}"的客户记录`);
      }
    }
  };

  // 处理首次联系状态变更
  const handleFirstContactChange = async (id: string | undefined) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('未找到客户信息');
        return;
      }
      
      // 使用类型断言解决类型问题
      const hasFirstContact = (customer as any).first_contact;
      const updateObj: Record<string, any> = {
        first_contact: hasFirstContact ? null : new Date().toISOString()
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状态
      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      message.success(hasFirstContact ? '已重置首次联系状态' : '已标记为已联系');
    } catch (error) {
      console.error('更新首次联系状态失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 处理续约状态变更
  const handleRenewalStatusChange = async (id: string | undefined) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('未找到客户信息');
        return;
      }
      
      // 使用类型断言解决类型问题
      const hasRenewalStatus = (customer as any).renewal_status;
      const updateObj: Record<string, any> = {
        renewal_status: hasRenewalStatus ? null : new Date().toISOString()
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状态
      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      message.success(hasRenewalStatus ? '已重置续约状态' : '已标记为已续约');
    } catch (error) {
      console.error('更新续约状态失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 处理有意向状态变更
  const handleInterestStatusChange = async (id: string | undefined) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('未找到客户信息');
        return;
      }
      
      // 切换有意向状态
      const updateObj = {
        status: customer.status === 'interested' ? null : 'interested'
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状态
      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      message.success(customer.status === 'interested' ? '已重置意向状态' : '已标记为有意向');
    } catch (error) {
      console.error('更新意向状态失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 处理催单按钮点击事件
  const handleUrgeOrderClick = async (recordId: string) => {
    try {
      if (!recordId) {
        message.error('记录ID无效');
        return;
      }
      
      // 使用带缓存的方法更新催单状态，UI立即响应
      const updatedCustomer = customerApi.updateUrgeOrderWithCache(recordId);
      
      // 更新本地状态
      setCustomers(prev => 
        prev.map(customer => (customer.id === recordId ? { ...customer, urge_order: updatedCustomer.urge_order } : customer))
      );
      setFilteredCustomers(prev => 
        prev.map(customer => (customer.id === recordId ? { ...customer, urge_order: updatedCustomer.urge_order } : customer))
      );
      
      // 显示操作结果
      message.success(updatedCustomer.urge_order ? '已添加催单标记' : '已移除催单标记');
    } catch (error) {
      console.error('催单操作失败:', error);
      message.error('催单操作失败');
      // 如果出错，刷新列表获取最新数据
      fetchCustomers();
    }
  };

  // 处理图纸变更按钮点击事件
  const handleDrawingChangeClick = async (recordId: string, newValue: string) => {
    try {
      if (!recordId) {
        message.error('记录ID无效');
        return;
      }
      
      // 使用Record<string, any>类型绕过类型检查
      const updateData: Record<string, any> = {
        drawing_change: newValue || '无变更'
      };
      
      // 使用updateWithCache方法异步更新，绕过类型检查
      await customerApi.updateWithCache(recordId, updateData);
      
      // 本地更新状态，使用类型断言
      setCustomers(prev => 
        prev.map(customer => {
          if (customer.id === recordId) {
            const updatedCustomer = { ...customer } as any;
            updatedCustomer.drawing_change = newValue || '无变更';
            return updatedCustomer;
          }
          return customer;
        })
      );
      
      setFilteredCustomers(prev => 
        prev.map(customer => {
          if (customer.id === recordId) {
            const updatedCustomer = { ...customer } as any;
            updatedCustomer.drawing_change = newValue || '无变更';
            return updatedCustomer;
          }
          return customer;
        })
      );
      
      // 显示操作结果
      message.success(`图纸变更状态已更新为"${newValue || '无变更'}"`);
    } catch (error) {
      console.error('更新图纸变更状态失败:', error);
      message.error('更新图纸变更状态失败');
      // 如果出错，刷新列表获取最新数据
      fetchCustomers();
    }
  };

  // 处理物品出库状态变更
  const handleItemOutboundClick = async (recordId: string, itemType: string) => {
    try {
      if (!recordId) {
        message.error('记录ID无效');
        return;
      }

      // 找到当前客户
      const customer = customers.find(c => c.id === recordId);
      if (!customer) {
        message.error('找不到客户信息');
        return;
      }

      // 准备更新数据
      const updateData: Record<string, any> = {};
      
      // 方钢和组件需要特殊处理，包括状态字段
      if (itemType === 'square_steel' || itemType === 'component') {
        // 获取当前状态
        const statusField = `${itemType}_status`;
        const dateField = `${itemType}_outbound_date`; 
        const status = customer[statusField as keyof Customer] || 'none';
        
        // 根据当前状态决定下一个状态
        if (status === 'none') {
          // 未出库 -> 出库
          updateData[dateField] = dayjs().format('YYYY-MM-DD');
          updateData[statusField] = 'outbound';
          updateData[`${itemType}_inbound_date`] = null;
        } else if (status === 'outbound') {
          // 出库 -> 回库
          updateData[statusField] = 'inbound';
          updateData[`${itemType}_inbound_date`] = dayjs().format('YYYY-MM-DD');
          // 保留出库日期
        } else if (status === 'inbound') {
          // 回库 -> 未出库（重置）
          updateData[dateField] = null;
          updateData[statusField] = 'none';
          updateData[`${itemType}_inbound_date`] = null;
        }
      } else {
        // 其他物品简单处理出库日期
        const statusField = `${itemType}_outbound_date`;
        const currentStatus = customer[statusField as keyof Customer];
        
        // 如果当前有出库日期，则标记为空（撤销出库）
        // 否则设置为当前日期（标记为已出库）
        updateData[statusField] = currentStatus ? null : dayjs().format('YYYY-MM-DD');
      }
      
      // 使用updateWithCache方法异步更新
      await customerApi.updateWithCache(recordId, updateData);
      
      // 更新本地状态
      setCustomers(prev => 
        prev.map(c => {
          if (c.id === recordId) {
            return { ...c, ...updateData };
          }
          return c;
        })
      );
      
      setFilteredCustomers(prev => 
        prev.map(c => {
          if (c.id === recordId) {
            return { ...c, ...updateData };
          }
          return c;
        })
      );
      
      // 根据操作类型显示不同的成功消息
      const itemNames: Record<string, string> = {
        'inverter': '逆变器',
        'copper_wire': '铜线',
        'aluminum_wire': '铝线',
        'distribution_box': '配电箱',
        'square_steel': '方钢',
        'component': '组件'
      };
      
      // 方钢和组件特殊消息处理
      let actionText = '';
      if (itemType === 'square_steel' || itemType === 'component') {
        const status = updateData[`${itemType}_status`];
        if (status === 'outbound') {
          actionText = '已标记为出库';
        } else if (status === 'inbound') {
          actionText = '已标记为回库';
        } else {
          actionText = '已重置为未出库';
        }
      } else {
        // 其他物品使用通用消息
        actionText = updateData[`${itemType}_outbound_date`] ? '出库成功' : '已撤销出库';
      }
      
      message.success(`${itemNames[itemType] || '物品'} ${actionText}`);
      
    } catch (error) {
      console.error('更新物品出库状态失败:', error);
      message.error('更新物品出库状态失败');
      // 如果出错，刷新列表获取最新数据
      fetchCustomers();
    }
  };

  // 添加设计师选择单元格组件
  const DesignerCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'designer');
    const [hover, setHover] = useState(false);
    
    // 将设计师数据转换为Select选项格式
    const designerOptions = designers.map(designer => ({
      value: designer.name,
      label: designer.name,
      phone: designer.phone || ''
    }));
    
    // 添加一个清空选项
    designerOptions.unshift({
      value: '',
      label: '清空设计师',
      phone: ''
    });
    
    return editable ? (
      <Form.Item
        name="designer"
        style={{ margin: 0 }}
      >
        <Select
          placeholder="请选择设计师"
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={designerOptions}
          onBlur={() => record.id ? saveEditedCell(record.id) : undefined}
          onChange={(value, option) => {
            // 如果选择了设计师，自动填充电话
            if (value && typeof option === 'object' && 'phone' in option) {
              editForm.setFieldsValue({ designer_phone: option.phone });
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
        onClick={() => editingCell === null && edit(record, 'designer')}
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
            onClick={() => edit(record, 'designer')}
            style={{ padding: '0 4px' }}
            title="编辑设计师"
          />
        )}
      </div>
    );
  };
  
  // 添加设计师电话可编辑单元格
  const DesignerPhoneCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'designer_phone');
    const [hover, setHover] = useState(false);
    
    return editable ? (
      <Form.Item
        name="designer_phone"
        style={{ margin: 0 }}
      >
        <Input 
          placeholder="请输入设计师电话"
          onPressEnter={() => record.id ? saveEditedCell(record.id) : undefined}
          onBlur={() => record.id ? saveEditedCell(record.id) : undefined}
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
        onClick={() => editingCell === null && edit(record, 'designer_phone')}
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
            onClick={() => edit(record, 'designer_phone')}
            style={{ padding: '0 4px' }}
            title="编辑设计师电话"
          />
        )}
      </div>
    );
  };

  return (
    <div className="customer-list-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderTitleBar()}
      
      <Form form={editForm} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Table 
            dataSource={paginatedCustomers} 
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
            onChange={(pagination, filters, sorter) => {
              // 处理排序，确保所有客户都参与排序
              if (sorter && !Array.isArray(sorter)) {
                const { field, order } = sorter;
                if (field && order) {
                  // 应用排序到所有filteredCustomers数据
                  const sortFunc = (a: Customer, b: Customer) => {
                    // 为field创建类型安全的访问
                    const fieldKey = field as keyof Customer;
                    
                    // 找到对应的列定义
                    const column = columns.find(col => {
                      if (typeof col.key === 'string' && col.key === field) return true;
                      if ('dataIndex' in col && col.dataIndex === field) return true;
                      return false;
                    });
                    
                    // 如果列有自定义排序函数，使用它
                    if (column && 'sorter' in column && typeof column.sorter === 'function') {
                      const result = column.sorter(a, b);
                      return order === 'ascend' ? result : -result;
                    }
                    
                    // 否则使用默认排序逻辑
                    const aValue = a[fieldKey];
                    const bValue = b[fieldKey];
                    
                    if (aValue === bValue) return 0;
                    if (aValue === undefined || aValue === null) return order === 'ascend' ? -1 : 1;
                    if (bValue === undefined || bValue === null) return order === 'ascend' ? 1 : -1;
                    
                    if (typeof aValue === 'string' && typeof bValue === 'string') {
                      return order === 'ascend' 
                        ? aValue.localeCompare(bValue) 
                        : bValue.localeCompare(aValue);
                    }
                    
                    if (typeof aValue === 'number' && typeof bValue === 'number') {
                      return order === 'ascend' ? aValue - bValue : bValue - aValue;
                    }
                    
                    return 0;
                  };
                  
                  // 排序数据
                  const sortedData = [...filteredCustomers].sort(sortFunc);
                  
                  // 更新排序后的数据
                  setFilteredCustomers(sortedData);
                  setCurrentPage(1); // 重置到第一页
                }
              }
            }}
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
                onClick={() => console.log('模板下载功能已移除')}
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