import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Table, Button, Input, Space, message, Modal, Tag, Tooltip, Typography, Upload, Drawer, Divider, Select, DatePicker, Form, Radio, InputNumber, Dropdown, Menu, AutoComplete, Checkbox, Row, Col } from 'antd'
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
  DownOutlined,
  LoadingOutlined
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
import { updateConstructionAcceptance } from '../services/api_fix'

const { Title } = Typography
const { confirm } = Modal
const { Dragger } = Upload

// 扩展Window接口，添加scrollTimer属�?declare global {
  interface Window {
    scrollTimer: ReturnType<typeof setTimeout> | null;
  }
}

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
  // 添加分页相关状�?  const [pageSize, setPageSize] = useState<number>(100)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  // 添加缓存页面数据的状�?  const [cachedPageData, setCachedPageData] = useState<{[key: number]: Customer[]}>({})
  // 添加是否正在后台加载数据的状�?  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false)
  // 添加上一次的页面大小
  const [previousPageSize, setPreviousPageSize] = useState<number>(100)
  // 添加用于存储预渲染数据的状�?  const [preRenderedData, setPreRenderedData] = useState<Customer[]>([])
  // 用于控制编辑时的性能优化
  const editingRef = useRef<boolean>(false)
  
  // 添加高级搜索相关状�?  const [advancedSearchVisible, setAdvancedSearchVisible] = useState(false)
  const [searchFields, setSearchFields] = useState<{[key: string]: boolean}>({
    customer_name: true,
    phone: true,
    address: true,
    salesman: true,
    id_card: true,
    meter_number: true,
    designer: true,
    surveyor: true,
    construction_team: true,
    remarks: false,
  })
  
  // 高级搜索字段名称映射
  const fieldNameMap: {[key: string]: string} = {
    customer_name: '客户姓名',
    phone: '客户电话',
    address: '客户地址',
    salesman: '业务�?,
    id_card: '身份证号',
    meter_number: '电表号码',
    designer: '设计�?,
    surveyor: '踏勘�?,
    construction_team: '施工�?,
    remarks: '备注',
  }
  
  // 限制每次最大加载记录数以提高性能
  const MAX_RECORDS_PER_LOAD = 5000; // 增加�?000，确保能加载所有数�?  // 添加虚拟滚动页大小常�?  const VIRTUAL_PAGE_SIZE = 100; // 在大页面模式下使用虚拟滚动分�?  
  const STATION_MANAGEMENT_OPTIONS = [
    { value: '房产�?, label: '房产�?, color: 'blue' },
    { value: '授权�?, label: '授权�?, color: 'purple' },
    { value: '银行�?, label: '银行�?, color: 'cyan' },
    { value: '航拍', label: '航拍', color: 'green' },
    { value: '结构�?, label: '结构�?, color: 'magenta' },
    { value: '门头�?, label: '门头�?, color: 'orange' },
    { value: '合同', label: '合同', color: 'red' },
    { value: '日期', label: '日期', color: 'cyan' }
  ];

  // 定义图纸变更选项
  const DRAWING_CHANGE_OPTIONS = [
    { value: '未出�?, label: '未出�?, color: 'default' },
    { value: '已出�?, label: '已出�?, color: 'green' },
    { value: '变更1', label: '变更1', color: 'blue' },
    { value: '变更2', label: '变更2', color: 'purple' },
    { value: '变更3', label: '变更3', color: 'orange' },
    { value: '变更4', label: '变更4', color: 'red' },
    { value: '变更5', label: '变更5', color: 'volcano' },
  ];

  const [constructionTeams, setConstructionTeams] = useState<{name: string, phone: string}[]>([]);
  const [surveyors, setSurveyors] = useState<{ name: string; phone: string }[]>([])

  // 在组件开始处添加状�?  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFields, setExportFields] = useState<{[key: string]: boolean}>({
    '登记日期': true,
    '客户姓名': true,
    '客户电话': true,
    '地址': true,
    '身份证号': true,
    '业务�?: true,
    '业务员电�?: true,
    '业务员邮�?: false,
    '踏勘�?: true,
    '踏勘员电�?: true,
    '踏勘员邮�?: false,
    '补充资料': true,
    '备案日期': true,
    '电表号码': true,
    '设计�?: true,
    '设计师电�?: true,
    '图纸变更': true,
    '催单': true,
    '容量(KW)': true,
    '投资金额': true,
    '用地面积(m²)': true,
    '组件数量': true,
    '逆变�?: true,
    '铜线': true,
    '铝线': true,
    '配电�?: true,
    '方钢出库日期': true,
    '组件出库日期': true,
    '派工日期': true,
    '施工�?: true,
    '施工队电�?: true,
    '施工状�?: true,
    '大线': true,
    '技术审�?: true,
    '上传国网': true,
    '建设验收': true,
    '挂表日期': true,
    '购售电合�?: true,
    '状�?: true,
    '价格': true,
    '公司': true,
    '备注': true,
    '创建时间': false,
    '最后更�?: false,
  });

  useEffect(() => {
    fetchCustomers()
    fetchConstructionTeams()
    fetchSurveyors()
  }, [])

  // 获取所有客户数�?  const fetchCustomers = async () => {
      setLoading(true)
    try {
      console.log('开始获取所有客户数�?..');
      // 获取所有客�?      const data = await customerApi.getAll()
      console.log(`成功获取�?${data.length} 条客户数据`);
      
      // 先从客户数据中提取业务员信息
      const salesmen = new Map<string, string>();
      data.forEach(customer => {
        if (customer.salesman && customer.salesman.trim() !== '') {
          salesmen.set(customer.salesman, customer.salesman_phone || '');
        }
      });
      
      // 从user_roles表获取业务员信息
      try {
        const { data: salesmenData, error } = await supabase
          .from('user_roles')
          .select('name, phone, email, user_id')
          .eq('role', 'salesman');
        
        if (error) throw error;
        
        // 将从user_roles表获取的业务员信息合并到映射�?        if (salesmenData) {
          salesmenData.forEach(salesman => {
            if (salesman.name && salesman.name.trim() !== '') {
              // 只有当salesmen中不存在此业务员或电话为空时才更�?              if (!salesmen.has(salesman.name) || !salesmen.get(salesman.name)) {
                salesmen.set(salesman.name, salesman.phone || '');
              }
            }
          });
        }
      } catch (error) {
        console.error('获取业务员信息失�?', error);
      }
      
      // 转换为数组并更新业务员列�?      const salesmenArray = Array.from(salesmen).map(([name, phone]) => ({
        name,
        phone
      }));
      
      // 更新业务员列�?      setSalesmenList(salesmenArray);
      
      // 分批处理数据以避免UI卡顿
      const processData = (startIndex = 0, batchSize = MAX_RECORDS_PER_LOAD) => {
        const endIndex = Math.min(startIndex + batchSize, data.length);
        const batch = data.slice(startIndex, endIndex);
        
        // 处理当前批次
        const processedBatch = batch.map(customer => {
                let processedCustomer = { ...customer };
                if (customer.module_count && customer.module_count > 0) {
                  const calculatedFields = calculateAllFields(customer.module_count);
                  processedCustomer = {
                    ...processedCustomer,
                    ...calculatedFields
                  };
                }
                return processedCustomer;
              });
              
        // 更新状态，保留之前处理的数�?        setCustomers(prev => [...prev, ...processedBatch]);
        setFilteredCustomers(prev => [...prev, ...processedBatch]);
            
        // 检查是否还有更多数据需要处�?        if (endIndex < data.length) {
          // 使用setTimeout避免阻塞UI
          setTimeout(() => {
            processData(endIndex, batchSize);
          }, 0);
        } else {
          // 所有数据处理完�?          console.log('所有客户数据处理完�?);
          setTotalPages(Math.ceil(data.length / pageSize)); // 更新总页�?          setLoading(false);
        }
      };
      
      // 重置状态并开始处理第一批数�?      setCustomers([]);
      setFilteredCustomers([]);
      processData(0, MAX_RECORDS_PER_LOAD);
      
    } catch (error) {
      message.error('获取客户数据失败')
      console.error(error)
      setLoading(false)
    }
  };

  // 获取施工队列�?  const fetchConstructionTeams = async () => {
    try {
      console.log('开始获取施工队数据...');
      
      // 使用新的getAll方法获取所有来源的施工队数�?      const teamList = await constructionTeamApi.getAll();
      console.log('获取到的施工队数�?', teamList);
      
      if (teamList && teamList.length > 0) {
        setConstructionTeams(teamList);
        return;
      }
      
      // 如果getAll仍然获取不到数据，使用空列表
      console.log('无法获取施工队数据，使用空列�?);
      setConstructionTeams([]);
    } catch (error) {
      console.error('获取施工队列表失�?', error);
      message.error('获取施工队列表失�?);
      
      // 发生错误时使用空数组
      setConstructionTeams([]);
    }
  };

  // 获取踏勘员列�?  const fetchSurveyors = async () => {
    try {
      console.log('开始获取踏勘员数据...');
      
      // 使用新的getAll方法获取所有来源的踏勘员数�?      const surveyorList = await surveyorApi.getAll();
      console.log('获取到的踏勘员数�?', surveyorList);
      
      if (surveyorList && surveyorList.length > 0) {
        setSurveyors(surveyorList);
        return;
      }
      
      // 如果getAll仍然获取不到数据，回退到从customers表中查询（这是一个额外的保障�?      console.log('无法获取踏勘员数据，使用空列�?);
      setSurveyors([]);
    } catch (error) {
      console.error('获取踏勘员列表失�?', error);
      message.error('获取踏勘员列表失�?);
      
      // 发生错误时使用空数组
      setSurveyors([]);
    }
  };

  // 优化的搜索函�?  const performSearch = (value: string) => {
    // 如果搜索为空，直接返回所有数�?    if (!value.trim()) {
      setFilteredCustomers(customers);
      setTotalPages(Math.ceil(customers.length / pageSize));
      setCurrentPage(1); // 重置到第一�?      return;
    }

    // 支持空格或逗号分隔的多关键词搜�?    const keywords = value.toLowerCase()
      .split(/[\s,，]+/) // 按空格或中英文逗号分隔
      .filter(keyword => keyword.trim() !== ''); // 过滤掉空字符�?    
    // 获取启用的搜索字�?    const enabledFields = Object.entries(searchFields)
      .filter(([_, enabled]) => enabled)
      .map(([field]) => field);
    
    // 如果没有启用任何字段，使用默认字�?    if (enabledFields.length === 0) {
      enabledFields.push('customer_name', 'phone', 'address', 'salesman', 'id_card', 'meter_number');
    }
    
    // 直接过滤所有数据，不再分批处理
    const filtered = customers.filter(customer => {
      // 检查启用的每个字段
      return keywords.some(keyword => 
        enabledFields.some(field => {
          const fieldValue = (customer[field as keyof Customer] || '').toString().toLowerCase();
          return fieldValue.includes(keyword);
        })
      );
    });
    
    setFilteredCustomers(filtered);
    setTotalPages(Math.ceil(filtered.length / pageSize));
    setCurrentPage(1); // 重置到第一�?  };
  
  // 使用立即处理的方式代替防抖，避免延迟
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    
    // 只有在输入长度大�?或为空时才触发搜索，避免单个字符时的频繁搜索
    // 但不显示未找到的提示，只在用户主动搜索时才显�?    if (value.length > 1 || !value) {
      performSearch(value);
    }
  };

  // 判断单元格是否处于编辑状�?  const isEditing = (record: Customer, dataIndex: string) => {
    return record.id === editingCell?.id && dataIndex === editingCell?.dataIndex;
  };

  // 开始编辑单元格
  const edit = (record: Customer, dataIndex: string) => {
    console.log('开始编辑字�?', dataIndex, '客户ID:', record.id, '当前�?', record[dataIndex as keyof Customer]);
    
    // 标记正在编辑状态，避免虚拟滚动重新计算
    editingRef.current = true;
    
    // 在大页面模式下，确保在状态更新前先设置表单值，避免延迟
    if (pageSize >= 500) {
      // 先设置表单值，再设置编辑状�?      editForm.setFieldsValue({
        [dataIndex]: record[dataIndex as keyof Customer]
      });
      
      // 针对特定字段的处�?      if (dataIndex === 'construction_team') {
        const currentTeam = record.construction_team;
        const currentPhone = record.construction_team_phone;
        console.log('编辑施工�?', currentTeam, '当前电话:', currentPhone);
        
        editForm.setFieldsValue({
          construction_team: currentTeam,
          construction_team_phone: currentPhone
        });
      } else if (dataIndex === 'salesman') {
        // 同时设置业务员电�?        editForm.setFieldsValue({
          salesman_phone: record.salesman_phone
        });
      } else if (dataIndex === 'surveyor') {
        // 同时设置踏勘员电�?        editForm.setFieldsValue({
          surveyor_phone: record.surveyor_phone
        });
      }
      
      // 使用requestAnimationFrame确保在下一帧渲�?      requestAnimationFrame(() => {
        setEditingCell({ id: record.id, dataIndex });
        
        // 找到并聚焦到编辑元素
        setTimeout(() => {
          const editInput = document.querySelector('.customer-table .ant-table-cell-editing input, .customer-table .ant-table-cell-editing textarea, .customer-table .ant-table-cell-editing .ant-select');
          if (editInput) {
            (editInput as HTMLElement).focus();
          }
        }, 50);
      });
    } else {
      // 常规页面模式的编辑流�?    setEditingCell({ id: record.id, dataIndex });
    
    // 如果是编辑施工队，预先设置施工队电话到表�?    if (dataIndex === 'construction_team') {
      const currentTeam = record.construction_team;
      const currentPhone = record.construction_team_phone;
      console.log('编辑施工�?', currentTeam, '当前电话:', currentPhone);
      
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
    
    // 针对特定字段的处�?    if (dataIndex === 'salesman') {
      // 同时设置业务员电�?        editForm.setFieldsValue({
        salesman_phone: record.salesman_phone
      });
      }
    }
  };

  // 取消编辑
  const cancel = () => {
    setEditingCell(null);
    // 编辑结束时重置标�?    editingRef.current = false;
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
      console.log('验证通过的编辑数�?', values);
      console.log('当前编辑单元�?', editingCell);
      
      // 创建更新对象
      const updateData: any = {};
      
      // 添加被编辑的字段
      const dataIndex = editingCell.dataIndex;
      updateData[dataIndex] = values[dataIndex];
      
      // 如果编辑施工队字段，同时保存施工队电�?      if (dataIndex === 'construction_team') {
        console.log('正在保存施工队字�?', values[dataIndex]);
        // 获取施工队电话并添加到更新数据中
        if (values.construction_team_phone !== undefined) {
          updateData.construction_team_phone = values.construction_team_phone;
          console.log('同时更新施工队电�?', values.construction_team_phone);
        } else if (values.construction_team) {
          // 如果没有明确设置电话但选择了施工队，尝试从施工队列表找到对应电�?          const teamInfo = constructionTeams.find(team => team.name === values.construction_team);
          if (teamInfo && teamInfo.phone) {
            updateData.construction_team_phone = teamInfo.phone;
            console.log('根据施工队名称自动设置电�?', teamInfo.phone);
          }
        } else {
          // 如果施工队被清空，也清空施工队电�?          updateData.construction_team_phone = null;
          console.log('施工队被清空，同时清空施工队电话');
        }
      }
      
      // 如果编辑的是施工队电话字段，将新电话更新到具有相同施工队名称的所有记�?      if (dataIndex === 'construction_team_phone') {
        console.log('正在更新施工队电�?', values.construction_team_phone);
      }
      
      // 如果编辑设计师字段，同时保存设计师电�?      if (dataIndex === 'designer') {
        console.log('正在保存设计师字�?', values[dataIndex]);
        // 获取设计师电话并添加到更新数据中
        if (values.designer_phone !== undefined) {
          updateData.designer_phone = values.designer_phone;
          console.log('同时更新设计师电�?', values.designer_phone);
        } else if (values.designer) {
          // 如果没有明确设置电话但选择了设计师，尝试从设计师列表找到对应电�?          const designerInfo = designers.find(designer => designer.name === values.designer);
          if (designerInfo && designerInfo.phone) {
            updateData.designer_phone = designerInfo.phone;
            console.log('根据设计师名称自动设置电�?', designerInfo.phone);
          }
        } else {
          // 如果设计师被清空，也清空设计师电�?          updateData.designer_phone = null;
          console.log('设计师被清空，同时清空设计师电话');
        }
      }
      
      // 如果编辑踏勘员字段，同时保存踏勘员电�?      if (dataIndex === 'surveyor') {
        console.log('正在保存踏勘员字�?', values[dataIndex]);
        // 获取踏勘员电话并添加到更新数据中
        if (values.surveyor_phone !== undefined) {
          updateData.surveyor_phone = values.surveyor_phone;
          console.log('同时更新踏勘员电�?', values.surveyor_phone);
        } else if (values.surveyor) {
          // 如果没有明确设置电话但选择了踏勘员，尝试从踏勘员列表找到对应电�?          const surveyorInfo = surveyors.find(surveyor => surveyor.name === values.surveyor);
          if (surveyorInfo && surveyorInfo.phone) {
            updateData.surveyor_phone = surveyorInfo.phone;
            console.log('根据踏勘员名称自动设置电�?', surveyorInfo.phone);
          }
        } else {
          // 如果踏勘员被清空，也清空踏勘员电�?          updateData.surveyor_phone = null;
          console.log('踏勘员被清空，同时清空踏勘员电话');
        }
      }
      
      // 如果编辑业务员字段，同时保存业务员电�?      if (dataIndex === 'salesman') {
        console.log('正在保存业务员字�?', values[dataIndex]);
        // 获取业务员电话并添加到更新数据中
        if (values.salesman_phone !== undefined) {
          updateData.salesman_phone = values.salesman_phone;
          console.log('同时更新业务员电�?', values.salesman_phone);
        } else if (values.salesman) {
          // 如果没有明确设置电话但选择了业务员，尝试从业务员列表找到对应电�?          const salesmanInfo = salesmenList.find(salesman => salesman.name === values.salesman);
          if (salesmanInfo && salesmanInfo.phone) {
            updateData.salesman_phone = salesmanInfo.phone;
            console.log('根据业务员名称自动设置电�?', salesmanInfo.phone);
          }
        }
      }
      
      // 特别处理module_count字段
      if (dataIndex === 'module_count') {
        const moduleCountValue = values.module_count;
        console.log('处理module_count�?', moduleCountValue, '类型:', typeof moduleCountValue);
        
        // 如果为空字符串或undefined，设置为null
        if (moduleCountValue === '' || moduleCountValue === undefined) {
          // 当组件数量为空时，相关字段也设置为空�?          updateData.module_count = null;
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
              // 如果组件数量�?，相关字段也设置为空�?              updateData.capacity = null;
              updateData.investment_amount = null;
              updateData.land_area = null;
              console.log('组件数量�?，相关字段设置为null');
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
          // 如果已经是数字类型，且是有效数字，计算相关字�?          if (!isNaN(moduleCountValue) && moduleCountValue > 0) {
            const calculatedFields = calculateAllFields(moduleCountValue);
            Object.assign(updateData, calculatedFields);
            console.log('数字类型，自动计算相关字�?', calculatedFields);
          } else {
            // 数字�?或NaN，相关字段也设置为空�?            updateData.capacity = null;
            updateData.investment_amount = null;
            updateData.land_area = null;
            console.log('组件数量�?或NaN，相关字段设置为null');
          }
        }
      }
      
      // 特殊处理图纸变更字段
      if (dataIndex === 'drawing_change') {
        if (values.drawing_change === undefined || values.drawing_change === '') {
          updateData.drawing_change = '未出�?;
        }
      }
      
      // 处理补充资料字段中的"日期"选项
      if (dataIndex === 'station_management') {
        // 检查是否选择�?日期"选项
        if (Array.isArray(values.station_management) && values.station_management.includes('日期')) {
          // 创建当前时间�?          const currentTimestamp = new Date().toISOString();
          
          // 从选项中移�?日期"
          const optionsWithoutDate = values.station_management.filter(item => item !== '日期');
          
          // 将其他选项和时间戳一起保存在station_management字段�?          // 保存格式：[选项1, 选项2, ..., 时间戳]
          updateData[dataIndex] = [...optionsWithoutDate, currentTimestamp];
          
          console.log('检测到"日期"选项，添加时间戳:', currentTimestamp);
        }
      }
      
      // 记录将发送到API的数�?      console.log('将发送到API的更新数�?', updateData);
      
      // 使用缓存服务更新数据
      customerApi.updateWithCache(id, updateData);
      
      // 查找当前编辑客户的索�?      const index = customers.findIndex(customer => customer.id === id);
      const filteredIndex = filteredCustomers.findIndex(customer => customer.id === id);
      
      if (index > -1) {
        // 更新本地状�?        const newCustomers = [...customers];
        newCustomers[index] = { ...newCustomers[index], ...updateData };
        console.log('更新后的客户数据:', newCustomers[index]);
        setCustomers(newCustomers);
      }
      
      if (filteredIndex > -1) {
        // 更新筛选后的数�?        const newFilteredCustomers = [...filteredCustomers];
        newFilteredCustomers[filteredIndex] = { ...newFilteredCustomers[filteredIndex], ...updateData };
        setFilteredCustomers(newFilteredCustomers);
      }
      
      // �?00�?页和1000�?页模式下，确保更新页面缓�?      if (pageSize >= 500 && cachedPageData) {
        // 更新页面缓存中的数据
        const updatedCachedData = { ...cachedPageData };
        
        // 遍历所有缓存页查找并更新数�?        Object.keys(updatedCachedData).forEach(pageKey => {
          const page = parseInt(pageKey);
          const pageData = updatedCachedData[page];
          const cachedIndex = pageData.findIndex(customer => customer.id === id);
          
          if (cachedIndex > -1) {
            // 更新缓存中的客户数据
            pageData[cachedIndex] = { ...pageData[cachedIndex], ...updateData };
            console.log(`已更新页面缓�?${page} 中的客户数据`);
          }
        });
        
        // 保存更新后的缓存
        setCachedPageData(updatedCachedData);
        
        // 强制重新渲染分页数据
        setForceUpdate(prev => prev + 1);
      }
      
      // 退出编辑状�?      setEditingCell(null);
      
      // 显示成功消息
      message.success('数据已更�?);
      
      // 如果编辑的是施工队电话，自动更新所有相同施工队名称的记�?      if (dataIndex === 'construction_team_phone') {
        const currentCustomer = customers.find(customer => customer.id === id);
        if (currentCustomer && currentCustomer.construction_team && values.construction_team_phone) {
          const teamName = currentCustomer.construction_team;
          const newPhone = values.construction_team_phone;
          console.log(`准备更新所有施工队 "${teamName}" 的电话为 ${newPhone}`);
          
          // 找到所有具有相同施工队名称的记�?          const recordsToUpdate = customers.filter(
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
            
            // 等待所有更新完�?            await Promise.all(updatePromises);
            
            // 更新本地状�?            setCustomers(prev => 
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
            
            message.success(`已自动更新所�?${teamName}"的电话号码`);
          } else {
            console.log('没有找到其他需要更新电话的相同施工队记�?);
          }
        }
      }
      
      // 如果编辑的是设计师电话，自动更新所有相同设计师名称的记�?      if (dataIndex === 'designer_phone') {
        const currentCustomer = customers.find(customer => customer.id === id);
        if (currentCustomer && currentCustomer.designer && values.designer_phone) {
          const designerName = currentCustomer.designer;
          const newPhone = values.designer_phone;
          console.log(`准备更新所有设计师 "${designerName}" 的电话为 ${newPhone}`);
          
          // 找到所有具有相同设计师名称的记�?          const recordsToUpdate = customers.filter(
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
            
            // 等待所有更新完�?            await Promise.all(updatePromises);
            
            // 更新本地状�?            setCustomers(prev => 
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
            
            message.success(`已自动更新所�?${designerName}"的电话号码`);
          } else {
            console.log('没有找到其他需要更新电话的相同设计师记�?);
          }
        }
      }
      
      // 如果编辑的是踏勘员电话，自动更新所有相同踏勘员名称的记�?      if (dataIndex === 'surveyor_phone') {
        const currentCustomer = customers.find(customer => customer.id === id);
        if (currentCustomer && currentCustomer.surveyor && values.surveyor_phone) {
          const surveyorName = currentCustomer.surveyor;
          const newPhone = values.surveyor_phone;
          console.log(`准备更新所有踏勘员 "${surveyorName}" 的电话为 ${newPhone}`);
          
          // 找到所有具有相同踏勘员名称的记�?          const recordsToUpdate = customers.filter(
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
            
            // 等待所有更新完�?            await Promise.all(updatePromises);
            
            // 更新本地状�?            setCustomers(prev => 
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
            
            message.success(`已自动更新所�?${surveyorName}"的电话号码`);
          } else {
            console.log('没有找到其他需要更新电话的相同踏勘员记�?);
          }
        }
      }
      
      // 如果编辑的是业务员电话，自动更新所有相同业务员名称的记�?      if (dataIndex === 'salesman_phone') {
        const currentCustomer = customers.find(customer => customer.id === id);
        if (currentCustomer && currentCustomer.salesman && values.salesman_phone) {
          const salesmanName = currentCustomer.salesman;
          const newPhone = values.salesman_phone;
          console.log(`准备更新所有业务员 "${salesmanName}" 的电话为 ${newPhone}`);
          
          // 找到所有具有相同业务员名称的记�?          const recordsToUpdate = customers.filter(
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
            
            // 等待所有更新完�?            await Promise.all(updatePromises);
            
            // 更新本地状�?            setCustomers(prev => 
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
            
            message.success(`已自动更新所�?${salesmanName}"的电话号码`);
          } else {
            console.log('没有找到其他需要更新电话的相同业务员记�?);
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
      
      // 更新本地状�?      setCustomers(prev => 
        prev.map(customer => (customer.id === record.id ? { ...customer, ...updatedCustomer } : customer))
      );
      setFilteredCustomers(prev => 
        prev.map(customer => (customer.id === record.id ? { ...customer, ...updatedCustomer } : customer))
      );
        
        // 退出编辑状�?      setEditingCell(null);
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
      content: `确定要删除客�?"${customerName}" 吗？此操作不可恢复！`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 使用数据缓存服务删除客户
          const success = await customerApi.deleteWithCache(id);
          
          if (success) {
          // 更新本地状�?          setCustomers(prev => prev.filter(customer => customer.id !== id));
          setFilteredCustomers(prev => prev.filter(customer => customer.id !== id));
          
          message.success('客户删除成功');
          } else {
            message.error('删除客户失败，请刷新页面后重�?);
          }
        } catch (error) {
          message.error('删除客户失败，系统出现异�?);
          console.error('删除客户时发生错�?', error);
        }
      }
    });
  };

  // 处理导出模态框
  const showExportModal = () => {
    setExportModalVisible(true);
  };
  
  // 处理导出选项变更
  const handleExportFieldChange = (fieldName: string, checked: boolean) => {
    setExportFields(prev => ({
      ...prev,
      [fieldName]: checked
    }));
  };
  
  // 全选所有导出字�?  const selectAllExportFields = () => {
    const allFields = { ...exportFields };
    Object.keys(allFields).forEach(field => {
      allFields[field] = true;
    });
    setExportFields(allFields);
  };
  
  // 取消全选导出字�?  const deselectAllExportFields = () => {
    const allFields = { ...exportFields };
    Object.keys(allFields).forEach(field => {
      allFields[field] = false;
    });
    // 至少保留客户姓名字段
    allFields['客户姓名'] = true;
    setExportFields(allFields);
  };
  
  // 带选择字段的导出客户数�?  const handleExportWithFields = () => {
    setExportLoading(true);
    try {
      // 防止大数据量导出时阻塞UI
      setTimeout(() => {
        try {
          // 获取用户选择的字�?          const selectedFields = Object.keys(exportFields).filter(field => exportFields[field]);
          
      // 准备要导出的数据
          const exportData = filteredCustomers.map(customer => {
            const row: {[key: string]: any} = {};
            
            // 只添加用户选择的字�?            if (exportFields['登记日期']) 
              row['登记日期'] = customer.register_date && dayjs(customer.register_date).isValid() 
                ? dayjs(customer.register_date).format('YYYY-MM-DD') 
                : '';
            if (exportFields['客户姓名'])
              row['客户姓名'] = customer.customer_name || '';
            if (exportFields['客户电话'])
              row['客户电话'] = customer.phone || '';
            if (exportFields['地址'])
              row['地址'] = customer.address || '';
            if (exportFields['身份证号'])
              row['身份证号'] = customer.id_card || '';
            if (exportFields['业务�?])
              row['业务�?] = customer.salesman || '';
            if (exportFields['业务员电�?])
              row['业务员电�?] = customer.salesman_phone || '';
            if (exportFields['业务员邮�?])
              row['业务员邮�?] = customer.salesman_email || '';
            if (exportFields['踏勘�?])
              row['踏勘�?] = customer.surveyor || '';
            if (exportFields['踏勘员电�?])
              row['踏勘员电�?] = customer.surveyor_phone || '';
            if (exportFields['踏勘员邮�?])
              row['踏勘员邮�?] = customer.surveyor_email || '';
            if (exportFields['补充资料'])
              row['补充资料'] = Array.isArray(customer.station_management) 
                ? customer.station_management.join('�?) 
                : (typeof customer.station_management === 'string' ? customer.station_management : '');
            if (exportFields['备案日期']) {
              // 处理备案日期格式
              if (customer.filing_date && customer.filing_date !== '') {
                if (dayjs(customer.filing_date).isValid()) {
                  row['备案日期'] = dayjs(customer.filing_date).format('YYYY-MM-DD');
                } else {
                  row['备案日期'] = customer.filing_date; // 如果不是有效日期，直接使用原始�?                }
              } else {
                row['备案日期'] = '';
              }
            }
            if (exportFields['电表号码'])
              row['电表号码'] = customer.meter_number || '';
            if (exportFields['设计�?])
              row['设计�?] = customer.designer || '';
            if (exportFields['设计师电�?])
              row['设计师电�?] = customer.designer_phone || '';
            if (exportFields['图纸变更'])
              row['图纸变更'] = customer.drawing_change || '未出�?;
            if (exportFields['催单']) {
              if (customer.urge_order && dayjs(customer.urge_order).isValid()) {
                row['催单'] = dayjs(customer.urge_order).format('YYYY-MM-DD HH:mm');
              } else {
                row['催单'] = '';
              }
            }
            if (exportFields['容量(KW)'])
              row['容量(KW)'] = customer.capacity || '';
            if (exportFields['投资金额'])
              row['投资金额'] = customer.investment_amount || '';
            if (exportFields['用地面积(m²)'])
              row['用地面积(m²)'] = customer.land_area || '';
            if (exportFields['组件数量'])
              row['组件数量'] = customer.module_count || '';
            if (exportFields['逆变�?])
              row['逆变�?] = customer.inverter || '';
            if (exportFields['铜线'])
              row['铜线'] = customer.copper_wire || '';
            if (exportFields['铝线'])
              row['铝线'] = customer.aluminum_wire || '';
            if (exportFields['配电�?])
              row['配电�?] = customer.distribution_box || '';
            if (exportFields['方钢出库日期']) {
              if (customer.square_steel_outbound_date === 'RETURNED') {
                row['方钢出库日期'] = '退�?;
              } else if (customer.square_steel_outbound_date && dayjs(customer.square_steel_outbound_date).isValid()) {
                row['方钢出库日期'] = dayjs(customer.square_steel_outbound_date).format('YYYY-MM-DD');
              } else {
                row['方钢出库日期'] = '';
              }
            }
            if (exportFields['组件出库日期']) {
              if (customer.component_outbound_date === 'RETURNED') {
                row['组件出库日期'] = '退�?;
              } else if (customer.component_outbound_date && dayjs(customer.component_outbound_date).isValid()) {
                row['组件出库日期'] = dayjs(customer.component_outbound_date).format('YYYY-MM-DD');
              } else {
                row['组件出库日期'] = '';
              }
            }
            if (exportFields['派工日期']) {
              if (customer.dispatch_date && dayjs(customer.dispatch_date).isValid()) {
                row['派工日期'] = dayjs(customer.dispatch_date).format('YYYY-MM-DD');
              } else {
                row['派工日期'] = '';
              }
            }
            if (exportFields['施工�?])
              row['施工�?] = customer.construction_team || '';
            if (exportFields['施工队电�?])
              row['施工队电�?] = customer.construction_team_phone || '';
            if (exportFields['施工状�?]) {
              if (customer.construction_status && dayjs(customer.construction_status).isValid()) {
                row['施工状�?] = dayjs(customer.construction_status).format('YYYY-MM-DD');
              } else {
                row['施工状�?] = '';
              }
            }
            if (exportFields['大线'])
              row['大线'] = customer.main_line || '';
            if (exportFields['技术审�?]) {
              // 技术审核特殊处�?              if (customer.technical_review_status === 'approved') {
                row['技术审�?] = customer.technical_review && dayjs(customer.technical_review).isValid() 
                  ? dayjs(customer.technical_review).format('YYYY-MM-DD HH:mm') 
                  : '已通过';
              } else if (customer.technical_review_status === 'rejected') {
                row['技术审�?] = '已拒�?;
              } else if (customer.technical_review && dayjs(customer.technical_review).isValid()) {
                row['技术审�?] = dayjs(customer.technical_review).format('YYYY-MM-DD HH:mm');
              } else {
                row['技术审�?] = '';
              }
            }
            if (exportFields['上传国网']) {
              if (customer.upload_to_grid && dayjs(customer.upload_to_grid).isValid()) {
                row['上传国网'] = dayjs(customer.upload_to_grid).format('YYYY-MM-DD HH:mm');
              } else {
                row['上传国网'] = '';
              }
            }
            if (exportFields['建设验收']) {
              // 建设验收简化处�?              if (customer.construction_acceptance_date && dayjs(customer.construction_acceptance_date).isValid()) {
                row['建设验收'] = dayjs(customer.construction_acceptance_date).format('YYYY-MM-DD HH:mm');
              } else {
                row['建设验收'] = '未推�?;
              }
            }
            if (exportFields['挂表日期']) {
              if (customer.meter_installation_date && dayjs(customer.meter_installation_date).isValid()) {
                row['挂表日期'] = dayjs(customer.meter_installation_date).format('YYYY-MM-DD HH:mm');
              } else {
                row['挂表日期'] = '';
              }
            }
            if (exportFields['购售电合�?]) {
              if (customer.power_purchase_contract && dayjs(customer.power_purchase_contract).isValid()) {
                row['购售电合�?] = dayjs(customer.power_purchase_contract).format('YYYY-MM-DD HH:mm');
              } else {
                row['购售电合�?] = '';
              }
            }
            if (exportFields['状�?])
              row['状�?] = customer.status || '';
            if (exportFields['价格'])
              row['价格'] = customer.price || '';
            if (exportFields['公司'])
              row['公司'] = customer.company === 'haoChen' ? '昊尘' : (customer.company === 'youZhi' ? '祐之' : customer.company || '');
            if (exportFields['备注'])
              row['备注'] = customer.remarks || '';
            if (exportFields['创建时间']) {
              if (customer.created_at && dayjs(customer.created_at).isValid()) {
                row['创建时间'] = dayjs(customer.created_at).format('YYYY-MM-DD HH:mm:ss');
              } else {
                row['创建时间'] = '';
              }
            }
            if (exportFields['最后更�?]) {
              if (customer.updated_at && dayjs(customer.updated_at).isValid()) {
                row['最后更�?] = dayjs(customer.updated_at).format('YYYY-MM-DD HH:mm:ss');
              } else {
                row['最后更�?] = '';
              }
            }
            
            return row;
          });

          // 添加工作表样�?          const workbook = XLSX.utils.book_new();
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          
          // 设置列宽（自动调整为内容宽度�?          const colWidths = [];
          for (const key in exportData[0]) {
            let maxWidth = key.length * 2; // 标题宽度
            for (const row of exportData) {
              const cellValue = row[key] ? String(row[key]) : '';
              maxWidth = Math.max(maxWidth, cellValue.length * 1.5);
            }
            colWidths.push({ width: Math.min(60, maxWidth) }); // 最大宽度限制为60
          }
          worksheet['!cols'] = colWidths;
          
          // 添加表头样式
          const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!worksheet[cellRef]) continue;
            
            worksheet[cellRef].s = {
              font: { bold: true },
              fill: { fgColor: { rgb: "EFEFEF" } },
              alignment: { horizontal: 'center', vertical: 'center' }
            };
          }

      // 将工作表添加到工作簿
          XLSX.utils.book_append_sheet(workbook, worksheet, '客户数据');

          // 生成文件名（包含搜索条件�?          let fileName = `客户数据_${dayjs().format('YYYY-MM-DD_HH-mm')}`;
          if (searchText) {
            fileName += `_搜索_${searchText.substring(0, 10)}`;
          }
          fileName += '.xlsx';

      // 保存文件
          XLSX.writeFile(workbook, fileName);
          
          // 显示成功消息
          message.success(`成功导出 ${exportData.length} 条数据`);
          
          // 关闭导出模态框
          setExportModalVisible(false);
    } catch (error) {
          console.error('导出数据时出�?', error);
          message.error('导出失败: ' + (error instanceof Error ? error.message : '未知错误'));
        } finally {
          setExportLoading(false);
        }
      }, 100);
    } catch (error) {
      message.error('导出准备失败');
      console.error(error);
      setExportLoading(false);
    }
  };

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
        message.error('请上传Excel或CSV文件�?)
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
        // 移除客户电话必填验证
        if (!row['地址']) missingFields.push('地址')
        if (!row['身份证号']) missingFields.push('身份证号')
        if (!row['业务�?]) missingFields.push('业务�?)
        
        if (missingFields.length > 0) {
          result.failed++
          result.failedItems?.push({
            row: i + 2, // Excel�?开始，标题行占1�?            reason: `缺少必填字段�?{missingFields.join('�?)}）`
          })
          continue
        }

        // 准备客户数据
        const customerData: Partial<Customer> = {
          register_date: row['登记日期'] ? dayjs(row['登记日期']).format() : new Date().toISOString(),
          customer_name: row['客户姓名'],
          phone: row['客户电话'] || '', // 允许电话为空
          address: row['地址'] || '',
          id_card: row['身份证号'] || '',
          salesman: row['业务�?] || '',
          salesman_phone: row['业务员电�?] || '',
          filing_date: row['备案日期'] ? row['备案日期'] : null, // 直接使用原始值，不转�?          meter_number: row['电表号码'] || '',
          designer: row['设计�?] || '',
          module_count: row['组件数量'] ? parseInt(row['组件数量']) : null, // 允许组件数量为空
          status: row['状�?] || '待处�?,
          company: row['公司'] === '昊尘' ? 'haoChen' : (row['公司'] === '祐之' ? 'youZhi' : 'haoChen') // 默认为昊�?        }
        
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
                // 提取具体的字段名�?                const fieldMatch = error.message.match(/column "([^"]+)"/) 
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
  const EditableCell = React.memo(({ value, record, dataIndex, title, required = true }: { value: any; record: Customer; dataIndex: string; title: string; required?: boolean }) => {
    const editable = isEditing(record, dataIndex);
    const [hover, setHover] = useState(false);
    
    return editable ? (
      <Form.Item
        name={dataIndex}
        style={{ margin: 0 }}
        rules={required ? [{ required: true, message: `请输�?{title}` }] : []}
      >
        <Input 
          onPressEnter={() => record.id && saveEditedCell(record.id)} 
          placeholder={required ? `请输�?{title}` : `${title}(可�?`}
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
            onClick={(e) => {
              e.stopPropagation();
              edit(record, dataIndex);
            }}
            style={{ padding: '0 4px' }}
            title={`编辑${title}`}
          />
        )}
      </div>
    );
  }, (prevProps, nextProps) => {
    // 仅在以下情况重新渲染:
    // 1. 值变�?    // 2. 编辑状态变�?(从查看切换到编辑，或者从编辑切换到查�?
    const valueChanged = prevProps.value !== nextProps.value;
    const wasEditing = isEditing(prevProps.record, prevProps.dataIndex);
    const isEditingNow = isEditing(nextProps.record, nextProps.dataIndex);
    const editingStateChanged = wasEditing !== isEditingNow;
    
    return !(valueChanged || editingStateChanged);
  });

  // 添加可编辑下拉单元格组件
  const EditableSelectCell = React.memo(({ value, record, dataIndex, title, options }: { 
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
          message: `请选择或输�?{title}` 
        }]}
      >
        <Select
          placeholder={`请选择或输�?{title}`}
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={options}
          filterOption={(input, option) => 
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: '100%' }}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          dropdownMatchSelectWidth={false}
          listHeight={256}
          virtual={options.length > 30}
          showArrow={true}
          notFoundContent="无匹配结�?
          onBlur={() => record.id && saveEditedCell(record.id)}
          onSelect={(value) => {
            if (dataIndex === 'salesman') {
              const phone = options.find(o => o.value === value)?.phone || '';
              editForm.setFieldsValue({ salesman_phone: phone });
            }
            
            // 针对图纸变更字段，确保始终是字符�?            if (dataIndex === 'drawing_change') {
              console.log('选择图纸变更�?', value, '类型:', typeof value);
              // 如果为空，设置为默认�?              if (value === null || value === undefined || value === '') {
                editForm.setFieldsValue({ drawing_change: '未出�? });
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
            onClick={(e) => {
              e.stopPropagation();
              edit(record, dataIndex);
            }}
            style={{ padding: '0 4px' }}
            title={`编辑${title}`}
          />
        )}
      </div>
    );
  }, (prevProps, nextProps) => {
    // 仅在以下情况重新渲染:
    // 1. 值变�?    // 2. 编辑状态变�?    const valueChanged = prevProps.value !== nextProps.value;
    const wasEditing = isEditing(prevProps.record, prevProps.dataIndex);
    const isEditingNow = isEditing(nextProps.record, nextProps.dataIndex);
    const editingStateChanged = wasEditing !== isEditingNow;
    
    return !(valueChanged || editingStateChanged);
  });

  // 添加可编辑多选下拉单元格组件
  const EditableMultipleSelectCell = React.memo(({ value, record, dataIndex, title, options }: { 
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
      
      // 如果已经是数组格�?      if (Array.isArray(val)) {
        // 检查数组中是否有时间戳（单个元素且是时间格式）
        if (val.length === 1 && dayjs(val[0]).isValid()) {
          return []; // 是时间戳，返回空数组表示没有选择�?        }
        return val; // 返回数组选项
      }
      
      // 处理字符串格式（兼容旧数据）
      if (typeof val === 'string') {
        // 检查是否是逗号分隔的字符串（选项列表�?        if (val.includes(',')) {
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
      
      // 如果是数组，检查是否有任意元素是时间戳
      if (Array.isArray(val)) {
        return val.some(item => typeof item === 'string' && dayjs(item).isValid() && item.includes('T'));
      }
      
      // 字符串格式：检查是否是时间�?ISO格式带T的字符串)
      if (typeof val === 'string') {
        return dayjs(val).isValid() && val.includes('T');
      }
      
      return false;
    };

    // 解析当前值，获取选项数组（如果是选项列表）或空数组（如果是时间戳�?    const parsedValue = parseValue(value);
    
    return editable ? (
      <Form.Item
        name={dataIndex}
        style={{ margin: 0 }}
        initialValue={parsedValue}
      >
        <Select
          mode="multiple"
          placeholder="请选择补充资料"
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
              // 检查当前项是否是时间戳
              if (typeof item === 'string' && dayjs(item).isValid() && item.includes('T')) {
                return (
                  <Tag key={item} color="green">
                    <ClockCircleOutlined /> {dayjs(item).format('YYYY-MM-DD HH:mm')}
                  </Tag>
                );
              }
              
              const option = options.find(o => o.value === item);
              return (
                <Tag key={item} color={option?.color || 'default'} style={{ margin: '0 1px 0 0', padding: '0 4px' }}>
                  {item}
                </Tag>
              );
            })
          ) : isTimestamp(value) ? (
            // 如果是时间戳（没有选择任何选项），显示时间�?            <Tag color="green">
              <ClockCircleOutlined /> 
              {Array.isArray(value) 
                ? value.find((item: any) => typeof item === 'string' && dayjs(item).isValid() && item.includes('T'))
                  ? dayjs(value.find((item: any) => typeof item === 'string' && dayjs(item).isValid() && item.includes('T'))).format('YYYY-MM-DD HH:mm')
                  : ''
                : typeof value === 'string' && value.includes('T')
                  ? dayjs(value).format('YYYY-MM-DD HH:mm') 
                  : ''}
            </Tag>
          ) : (
            // 如果没有值，显示未设�?            <span style={{ color: '#999', fontStyle: 'italic' }}>未设�?/span>
          )}
        </div>
        {hover && editingCell === null && (
          <Button 
            type="text" 
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              edit(record, dataIndex);
            }}
            style={{ padding: '0 4px' }}
            title={`编辑${title}`}
          />
        )}
      </div>
    );
  }, (prevProps, nextProps) => {
    // 仅在以下情况重新渲染:
    // 1. 值变�?    // 2. 编辑状态变�?    const valueChanged = prevProps.value !== nextProps.value;
    const wasEditing = isEditing(prevProps.record, prevProps.dataIndex);
    const isEditingNow = isEditing(nextProps.record, nextProps.dataIndex);
    const editingStateChanged = wasEditing !== isEditingNow;
    
    return !(valueChanged || editingStateChanged);
  });

  // 可编辑日期单元格
  const EditableDateCell = React.memo(({ value, record, dataIndex, title }: { 
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
      if (editingCell !== null) return; // 如果已经在编辑其他单元格，则不执�?          edit(record, dataIndex);
    };
    
    return editable ? (
      <DatePicker 
        style={{ width: '100%' }} 
        format="YYYY-MM-DD"
        defaultValue={safeDate}
        open={true} // 自动打开日期选择�?        onChange={(date) => handleDateChange(date, record, dataIndex)} // 选择日期时就保存
        onBlur={() => setEditingCell(null)} // 失焦时退出编�?      />
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
            <span style={{ color: '#999', fontStyle: 'italic' }}>未设�?/span>
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
  }, (prevProps, nextProps) => {
    // 仅在以下情况重新渲染:
    // 1. 值变�?    // 2. 编辑状态变�?    const valueChanged = prevProps.value !== nextProps.value;
    const wasEditing = isEditing(prevProps.record, prevProps.dataIndex);
    const isEditingNow = isEditing(nextProps.record, nextProps.dataIndex);
    const editingStateChanged = wasEditing !== isEditingNow;
    
    return !(valueChanged || editingStateChanged);
  });

  // 表格列定�?  const columns: ColumnsType<Customer> = [
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
      title: '业务�?,
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
            // 找到对应的业务员，同时更新数�?            setTimeout(() => {
              handleUpdateSalesmanName(record.id as string, value, matchedSalesman.name, matchedSalesman.phone || '');
            }, 0);
            
            // 立即显示真实姓名
            return (
              <EditableSelectCell 
                value={matchedSalesman.name} 
                record={{...record, salesman: matchedSalesman.name}} 
                dataIndex="salesman" 
                title="业务�? 
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
            title="业务�? 
            options={salesmenList.map(s => ({ value: s.name, label: s.name, phone: s.phone }))}
          />
        );
      }
    },
    {
      title: '业务员电�?,
      dataIndex: 'salesman_phone',
      key: 'salesman_phone',
      width: 150,
      sorter: (a, b) => (a.salesman_phone || '').localeCompare(b.salesman_phone || ''),
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="salesman_phone" title="业务员电�? required={false} />
    },
    {
      title: '设计�?,
      dataIndex: 'designer',
      key: 'designer',
      width: 120,
      sorter: (a, b) => (a.designer || '').localeCompare(b.designer || ''),
      ellipsis: true,
      render: (value, record) => <DesignerCell value={value} record={record} />
    },
    {
      title: '设计师电�?,
      dataIndex: 'designer_phone',
      key: 'designer_phone',
      width: 130,
      ellipsis: true,
      render: (value, record) => <DesignerPhoneCell value={value} record={record} />
    },
    {
      title: '踏勘�?,
      dataIndex: 'surveyor',
      key: 'surveyor',
      width: 120,
      sorter: (a, b) => (a.surveyor || '').localeCompare(b.surveyor || ''),
      ellipsis: true,
      render: (value, record) => <SurveyorCell value={value} record={record} />
    },
    {
      title: '踏勘员电�?,
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
        // 处理station_management可能是string或string[]的情�?        const aArray = Array.isArray(a.station_management) ? a.station_management : 
                     (a.station_management ? [a.station_management] : []);
        const bArray = Array.isArray(b.station_management) ? b.station_management : 
                     (b.station_management ? [b.station_management] : []);
        
        // 首先按数量排�?        if (aArray.length !== bArray.length) {
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
        
        // 尝试将值转换为日期进行比较
        const aDate = new Date(a.filing_date);
        const bDate = new Date(b.filing_date);
        
        // 检查是否为有效日期
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return aDate.getTime() - bDate.getTime();
        }
        
        // 如果不是有效日期，按字符串排�?        return String(a.filing_date).localeCompare(String(b.filing_date));
      },
      render: (value, record) => (
        <EditableCell 
          value={value} 
          record={record} 
          dataIndex="filing_date" 
          title="备案日期" 
          required={false}
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
              value={value || '未出�?} 
              record={record} 
              dataIndex="drawing_change" 
              title="图纸变更" 
              options={DRAWING_CHANGE_OPTIONS}
            />
          );
        }
        
        // 获取当前选项，默认为"未出�?
        const option = DRAWING_CHANGE_OPTIONS.find(o => o.value === value) || DRAWING_CHANGE_OPTIONS[0];
        
        // 显示图纸变更选项下拉菜单
        const menu = (
          <Menu onClick={({ key }) => record.id && handleDrawingChangeClick(record.id, key as string)}>
            {DRAWING_CHANGE_OPTIONS.map(opt => (
              <Menu.Item key={opt.value}>
                <Tag 
                  color={opt.color === 'default' ? undefined : opt.color} 
                  style={{ margin: 0 }}
                >
                  {opt.label}
                </Tag>
              </Menu.Item>
            ))}
          </Menu>
        );
        
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Dropdown overlay={menu} trigger={['click']}>
              <div style={{ cursor: 'pointer' }}>
                <Tag 
                  color={option.color === 'default' ? undefined : option.color}
                  style={{ padding: '4px 8px' }}
            >
                {option.label} <DownOutlined />
                </Tag>
              </div>
            </Dropdown>
          </div>
        );
      },
      sorter: (a, b) => {
        const valA = typeof a.drawing_change === 'string' ? a.drawing_change : '未出�?;
        const valB = typeof b.drawing_change === 'string' ? b.drawing_change : '未出�?;
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
        // 如果两者都为null，排序相�?        if (!a.urge_order && !b.urge_order) return 0;
        // 如果a为null，b排在前面
        if (!a.urge_order) return 1;
        // 如果b为null，a排在前面
        if (!b.urge_order) return -1;
        // 都不为null时，进行时间比较
        return new Date(b.urge_order).getTime() - new Date(a.urge_order).getTime();
      },
      render: (text: string | null, record: Customer) => {
        // 检查station_management是否包含时间�?        const hasTimestamp = Array.isArray(record.station_management) && 
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
      title: '逆变�?,
      dataIndex: 'inverter',
      key: 'inverter',
      width: 120,
      sorter: (a, b) => (a.inverter || '').localeCompare(b.inverter || ''),
      ellipsis: true,
      render: (text, record) => {
        // 如果组件数量过少，无法确定逆变器型�?        if (!record.module_count || record.module_count < 10) {
          return <span style={{ color: '#999' }}>-</span>;
        }

        // 检查是否有出库日期（时间戳�?        const outboundDate = record.inverter_outbound_date ? 
          dayjs(record.inverter_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出�?}>
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
        
        // 检查是否有出库日期（时间戳�?        const outboundDate = record.copper_wire_outbound_date ? 
          dayjs(record.copper_wire_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出�?}>
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
        
        // 检查是否有出库日期（时间戳�?        const outboundDate = record.aluminum_wire_outbound_date ? 
          dayjs(record.aluminum_wire_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出�?}>
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
      title: '配电�?,
      dataIndex: 'distribution_box',
      key: 'distribution_box',
      ellipsis: true,
      render: (text, record) => {
        // 如果组件数量为空或过少，显示"无法确定型号"
        if (!record.module_count || record.module_count < 10) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        // 检查是否有出库日期（时间戳�?        const outboundDate = record.distribution_box_outbound_date ? 
          dayjs(record.distribution_box_outbound_date).format('YYYY-MM-DD') : '';
        
        return (
          <Tooltip title={outboundDate ? `出库时间: ${outboundDate}` : "点击可记录出�?}>
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
        // 判断方钢和组件的出库状�?- 实现新需求逻辑
        // 1. 如果方钢出库日期和回库日期都有数据，显示回库状�?        // 2. 如果只有出库日期有数据，显示出库状�? 
        // 3. 如果出库日期和回库日期都为空，显示按钮状�?        
        if (record.square_steel_outbound_date && record.square_steel_inbound_date) {
          // 回库状�?- 显示回库标签和时间戳
          const inboundDate = dayjs(record.square_steel_inbound_date).format('YYYY-MM-DD');
          
          return (
            <Tag 
              color="orange" 
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundClick(record.id, 'square_steel')}
            >
              <RollbackOutlined /> {inboundDate}
            </Tag>
          );
        } else if (record.square_steel_outbound_date) {
          // 出库状�?- 显示出库时间�?          const outboundDate = dayjs(record.square_steel_outbound_date).format('YYYY-MM-DD');
          
          return (
            <Tag 
              color="green" 
              style={{ cursor: 'pointer' }} 
              onClick={() => handleItemOutboundClick(record.id, 'square_steel')}
            >
              {outboundDate}
            </Tag>
          );
        } else {
          // 未出库状�?- 显示出库按钮
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
        // 状态优先级：none(未出�? < outbound(已出�? < inbound(已回�? < returned(退�?
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
        
        // 如果状态相同且都是出库状态，按出库日期排�?        if (aStatus === 'outbound' && bStatus === 'outbound') {
          const aDate = a.square_steel_outbound_date ? new Date(a.square_steel_outbound_date).getTime() : 0;
          const bDate = b.square_steel_outbound_date ? new Date(b.square_steel_outbound_date).getTime() : 0;
          return aDate - bDate;
        }
        
        // 如果状态相同且都是回库状态，按回库日期排�?        if (aStatus === 'inbound' && bStatus === 'inbound') {
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
        // 判断组件的出库状�?- 实现新需求逻辑
        // 1. 如果组件出库日期和回库日期都有数据，显示回库状�?        // 2. 如果只有出库日期有数据，显示出库状�? 
        // 3. 如果出库日期和回库日期都为空，显示按钮状�?        
        if (record.component_outbound_date && record.component_inbound_date) {
          // 回库状�?- 显示回库标签和时间戳
          const inboundDate = dayjs(record.component_inbound_date).format('YYYY-MM-DD');
          
          return (
            <Tag 
              color="orange" 
              style={{ cursor: 'pointer' }}
              onClick={() => handleItemOutboundClick(record.id, 'component')}
            >
              <RollbackOutlined /> {inboundDate}
            </Tag>
          );
        } else if (record.component_outbound_date) {
          // 出库状�?- 显示出库时间�?          const outboundDate = dayjs(record.component_outbound_date).format('YYYY-MM-DD');
          
          return (
            <Tag 
              color="green" 
              style={{ cursor: 'pointer' }} 
              onClick={() => handleItemOutboundClick(record.id, 'component')}
            >
              {outboundDate}
            </Tag>
          );
        } else {
          // 未出库状�?- 显示出库按钮
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
        // 状态优先级：none(未出�? < outbound(已出�? < inbound(已回�? < returned(退�?
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
        
        // 如果状态相同且都是出库状态，按出库日期排�?        if (aStatus === 'outbound' && bStatus === 'outbound') {
          const aDate = a.component_outbound_date ? new Date(a.component_outbound_date).getTime() : 0;
          const bDate = b.component_outbound_date ? new Date(b.component_outbound_date).getTime() : 0;
          return aDate - bDate;
        }
        
        // 如果状态相同且都是回库状态，按回库日期排�?        if (aStatus === 'inbound' && bStatus === 'inbound') {
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
      title: '施工�?,
      dataIndex: 'construction_team',
      key: 'construction_team',
      sorter: (a, b) => (a.construction_team || '').localeCompare(b.construction_team || ''),
      ellipsis: true,
      render: (value, record) => {
        console.log('渲染施工队字�?', record.id, value);
        return <ConstructionTeamCell 
          value={value} 
          record={record}
          onChange={(newValue) => {
            // 当施工队字段变更时，同步处理派工日期
            if (!newValue || newValue.trim() === '') {
              // 如果施工队清空，也清空派工日�?              customerApi.update(record.id, { 
                construction_team: newValue,
                dispatch_date: null 
              });
            } else if (!record.construction_team && newValue) {
              // 如果施工队从无到有，设置派工日期为当前日�?              customerApi.update(record.id, { 
                construction_team: newValue,
                dispatch_date: new Date().toISOString().split('T')[0]
              });
            } else {
              // 仅更新施工队
              customerApi.update(record.id, { construction_team: newValue });
            }
          }}
        />;
      }
    },
    {
      title: '施工队电�?,
      dataIndex: 'construction_team_phone',
      key: 'construction_team_phone',
      sorter: (a, b) => (a.construction_team_phone || '').localeCompare(b.construction_team_phone || ''),
      ellipsis: true,
      render: (value, record) => {
        console.log('渲染施工队电话字�?', record.id, value);
        return <ConstructionTeamPhoneCell value={value} record={record} />;
      }
    },
    {
      title: '施工状�?,
      dataIndex: 'construction_status',
      key: 'construction_status',
      width: 130,
      align: 'center' as const,
      render: (text, record) => {
        // 如果有施工状态（已完工）
        if (text) {
          // 只有管理员可以将已完工恢复为未完�?          const canReset = userRole === 'admin';
          
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
              未完�?            </Button>
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
      title: '技术审�?,
      dataIndex: 'technical_review_status',
      key: 'technical_review_status',
      width: 120,
      align: 'center' as const,
      render: (text, record) => {
        // 如果已审核通过
        if (text === 'approved') {
          // 检查是否为有效日期
          let reviewTime = '未知时间';
          try {
            // 使用dayjs检查是否为有效日期，如果无效会抛出警告
            if (record.technical_review_date && dayjs(record.technical_review_date).isValid()) {
              reviewTime = dayjs(record.technical_review_date).format('YYYY-MM-DD HH:mm');
            } else {
              console.warn(`无效的技术审核日�? ${record.technical_review_date}`);
            }
          } catch (error) {
            console.error('技术审核日期格式化错误:', error);
          }
          
          const canReset = userRole === 'admin';
          
          return (
            <Tooltip title={canReset ? '点击重置为待审核状�? : `审核通过时间: ${reviewTime}`}>
              <Tag 
                color="green"
                style={{ cursor: canReset ? 'pointer' : 'default' }}
                onClick={() => canReset && record.id && handleTechnicalReviewChange(record.id, 'reset')}
              >
                <CheckCircleOutlined /> {reviewTime}
              </Tag>
            </Tooltip>
          );
        } else if (text === 'rejected') {
          // 如果被驳�?          let rejectionTime = '未知时间';
          
          try {
            if (record.technical_review_date && dayjs(record.technical_review_date).isValid()) {
              rejectionTime = dayjs(record.technical_review_date).format('YYYY-MM-DD HH:mm');
            }
          } catch (error) {
            console.error('驳回日期格式化错�?', error);
          }
          
          return (
            <Tooltip title={`驳回时间: ${rejectionTime}`}>
              <Button 
                danger
                size="small"
                onClick={() => record.id && showTechnicalReviewOptions(record.id)}
              >
                技术驳�?              </Button>
            </Tooltip>
          );
        } else {
          // 待审核状�?          return (
            <Button 
              type="primary"
              size="small"
              ghost
              onClick={() => record.id && showTechnicalReviewOptions(record.id)}
            >
              待审�?            </Button>
          );
        }
      },
      sorter: (a, b) => {
        // 排序顺序：未审核 < 已驳�?< 已通过
        const statusOrder = { 'pending': 0, 'rejected': 1, 'approved': 2 };
        const aValue = statusOrder[a.technical_review_status || 'pending'] || 0;
        const bValue = statusOrder[b.technical_review_status || 'pending'] || 0;
        
        if (aValue !== bValue) {
          return aValue - bValue;
        }
        
        // 如果状态相同，根据日期排序
        try {
          if (!a.technical_review_date && !b.technical_review_date) return 0;
          if (!a.technical_review_date) return -1;
          if (!b.technical_review_date) return 1;
          
          const aTime = dayjs(a.technical_review_date).isValid() ? 
            new Date(a.technical_review_date).getTime() : 0;
          const bTime = dayjs(b.technical_review_date).isValid() ? 
            new Date(b.technical_review_date).getTime() : 0;
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
        // 如果已上�?        if (text) {
          // 只有管理员可以将已上传恢复为未上�?          const canReset = userRole === 'admin';
          
          return (
            <Tooltip title={canReset ? '点击恢复为未上传状�? : '上传时间'}>
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
      dataIndex: 'construction_acceptance_date',
      key: 'construction_acceptance_date',
      width: 130,
      align: 'center' as const,
      render: (text, record) => {
        // 如果已完成验�?        if (text) {
          return (
            <Tooltip title='点击恢复为未推到状�?>
              <Tag 
                color="green" 
                style={{ cursor: 'pointer' }}
                onClick={() => record.id && handleConstructionAcceptanceChange(record.id, text)}
              >
                <ClockCircleOutlined /> {dayjs(text).format('YYYY-MM-DD HH:mm')}
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
              onClick={() => record.id && handleConstructionAcceptanceChange(record.id, null)}
            >
              未推�?            </Button>
          );
        }
      },
      sorter: (a, b) => {
        if (!a.construction_acceptance_date && !b.construction_acceptance_date) return 0;
        if (!a.construction_acceptance_date) return -1;
        if (!b.construction_acceptance_date) return 1;
        return new Date(a.construction_acceptance_date).getTime() - new Date(b.construction_acceptance_date).getTime();
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
        // 如果已挂�?        if (text) {
          // 只有管理员可以将已挂表恢复为未挂�?          const canReset = userRole === 'admin';
          
          return (
            <Tooltip title={canReset ? '点击恢复为未挂表状�? : '挂表时间'}>
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
      title: '购售电合�?,
      dataIndex: 'power_purchase_contract',
      key: 'power_purchase_contract',
      width: 130,
      align: 'center' as const,
      render: (text, record) => {
        // 如果已出合同
        if (text) {
          // 只有管理员可以将已出合同恢复为待出状�?          const canReset = userRole === 'admin';
          
          return (
            <Tooltip title={canReset ? '点击恢复为待出状�? : '合同出具时间'}>
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
      title: '状�?,
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (text, record) => {
        // 检查购售电合同是否�?待出"状�?        const isPowerPurchaseContractPending = !record.power_purchase_contract;
        
        // 如果购售电合同为"待出"状态，显示灰色禁用按钮
        if (isPowerPurchaseContractPending) {
          return (
            <Tooltip title="需要先完成购售电合�?>
              <Button
                size="small"
                disabled
                style={{ color: 'rgba(0, 0, 0, 0.25)', background: '#f5f5f5', borderColor: '#d9d9d9' }}
              >
                待处�?              </Button>
            </Tooltip>
          );
        }
        
        // 如果购售电合同已完成，显示当前状态或可点击的蓝色按钮
        if (text) {
          // 映射状态到颜色
          const statusColorMap: Record<string, string> = {
            '待处�?: 'blue',
          '提交资料': 'blue',
          '技术驳�?: 'red',
          '商务驳回': 'orange',
          '已完�?: 'green'
          };
          
          const color = statusColorMap[text] || 'blue';
          
          // 如果是蓝色状态，显示为可点击的按�?          if (color === 'blue') {
            return (
              <Button
                type="primary"
                size="small"
                onClick={() => record.id && showStatusOptions(record.id, text || '待处�?)}
              >
                {text}
              </Button>
            );
          }
          
          // 其他状态显示为对应颜色的标�?          return (
            <Tag 
              color={color}
              style={{ cursor: 'pointer' }}
              onClick={() => record.id && showStatusOptions(record.id, text)}
            >
              {text}
            </Tag>
          );
        } else {
          // 如果没有状态，显示为蓝�?待处�?按钮
          return (
            <Button
              type="primary"
              size="small"
              onClick={() => record.id && showStatusOptions(record.id, '待处�?)}
            >
              待处�?            </Button>
          );
        }
      },
      filters: [
        { text: '待处�?, value: '待处�? },
        { text: '提交资料', value: '提交资料' },
        { text: '技术驳�?, value: '技术驳�? },
        { text: '商务驳回', value: '商务驳回' },
        { text: '已完�?, value: '已完�? }
      ],
      onFilter: (value, record) => {
        // 对于状态为空的记录，默认认为是"待处�?
        const status = record.status || '待处�?;
        return status === value;
      },
      sorter: (a, b) => {
        // 处理可能为空的状态�?        const statusA = a.status || '待处�?;
        const statusB = b.status || '待处�?;
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
        // 直接使用中文显示公司名称
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
            <Tooltip title="删除客户">
          <Button 
                type="primary"
                danger
                ghost
            size="small"
                icon={<DeleteOutlined />} 
                onClick={() => handleDelete(record.id, record.customer_name)}
          />
            </Tooltip>
          </Space>
    );
      },
    },
  ];
  
  // 施工队电话可编辑单元�?  const ConstructionTeamPhoneCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'construction_team_phone');
    const [hover, setHover] = useState(false);
    
    return editable ? (
      <Form.Item
        name="construction_team_phone"
        style={{ margin: 0 }}
      >
        <Input 
          placeholder="施工队电�? 
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
            onClick={(e) => {
              e.stopPropagation();
              edit(record, 'construction_team_phone');
            }}
            style={{ padding: '0 4px' }}
            title="编辑施工队电�?
          />
        )}
      </div>
    );
  };

  // 创建施工队可编辑单元�?  const ConstructionTeamCell = ({ 
    value, 
    record, 
    onChange 
  }: { 
    value: any; 
    record: Customer; 
    onChange?: (newValue: any) => void 
  }) => {
    const editable = isEditing(record, 'construction_team');
    const [hover, setHover] = useState(false);
    
    // 将施工队数据转换为Select选项格式
    const constructionTeamOptions = constructionTeams.map(team => ({
      value: team.name,
      label: team.name,
      phone: team.phone || ''
    }));
    
    console.log('渲染施工队单元格:', value, '可用施工队选项:', constructionTeamOptions);
    
    return editable ? (
      <Form.Item
        name="construction_team"
        style={{ margin: 0 }}
        initialValue={value}
      >
        <Select
          placeholder="请选择施工�?
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={constructionTeamOptions}
          onBlur={() => {
            if (record.id) {
              saveEditedCell(record.id);
              // 保存后通知父组件值已更改
              const newValue = editForm.getFieldValue('construction_team');
              if (onChange && newValue !== value) {
                onChange(newValue);
              }
            }
          }}
          onChange={(value, option) => {
            console.log('选择施工�?', value, option);
            // 如果选择了施工队，自动填充电�?            if (value && typeof option === 'object' && 'phone' in option) {
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
            onClick={(e) => {
              e.stopPropagation();
              edit(record, 'construction_team');
            }}
            style={{ padding: '0 4px' }}
            title="编辑施工�?
          />
        )}
      </div>
    );
  };

  // 处理施工状态变�?  const handleConstructionStatusChange = async (id: string | undefined, currentStatus: string | null) => {
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
        // 移除construction_date字段，因为数据库中不存在此字�?      };
      
      // 使用数据缓存服务更新数据
      customerApi.updateWithCache(id, updateData);
      
      // 更新本地状�?- 直接使用updateData而非更新后的返回�?      setCustomers(prev => 
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
      
      message.success(newStatus ? '已标记为施工完成' : '已标记为未施�?);
    } catch (error) {
      console.error('更新施工状态失�?', error);
      message.error('操作失败，请重试');
    }
  };

  // 处理技术审核状态变�?  const handleTechnicalReviewChange = async (id: string | undefined, status: 'approved' | 'rejected' | 'reset') => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      let updateObj: Record<string, any> = {};
      
      if (status === 'approved') {
        // 使用dayjs处理日期，确保格式一�?        const now = dayjs();
        
        updateObj = {
          technical_review_status: 'approved', // 使用枚举�?          technical_review_date: now.toISOString(),
          technical_review_notes: '已通过技术审�?
        };
      } else if (status === 'rejected') {
        const now = dayjs();
        
        updateObj = {
          technical_review_status: 'rejected', // 使用枚举�?          technical_review_date: now.toISOString(),
          technical_review_notes: '技术审核不通过'
        };
      } else {
        // 重置状�?        updateObj = {
          technical_review_status: 'pending', // 使用枚举�?          technical_review_date: null,
          technical_review_notes: null
        };
      }
      
      // 使用数据缓存服务更新数据
      customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状�?- 使用传入的updateObj而非updatedCustomer，确保UI立即更新
      setCustomers(prev => 
        prev.map(customer => (customer.id === id ? { ...customer, ...updateObj } : customer))
      );
      setFilteredCustomers(prev => 
        prev.map(customer => (customer.id === id ? { ...customer, ...updateObj } : customer))
      );
      
      const statusText = 
        status === 'approved' ? '已通过技术审�? : 
        status === 'rejected' ? '已标记为技术审核不通过' : 
        '已重置技术审核状�?;
      
      message.success(statusText);
    } catch (error) {
      console.error('更新技术审核状态失�?', error);
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
      title: '选择技术审核结�?,
      content: '请选择技术审核结�?',
      okText: '审核通过',
      okType: 'primary',
      cancelText: '技术驳�?,
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

  // 处理上传国网状态变�?  const handleUploadToGridChange = async (id: string | undefined) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('未找到客户信�?);
        return;
      }
      
      // 切换上传国网状态，当前有值则清空，无值则设置为当前日�?      const updateObj: Record<string, any> = {
        upload_to_grid: customer.upload_to_grid ? null : new Date().toISOString()
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状�?      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      message.success(customer.upload_to_grid ? '已重置上传国网状�? : '已标记为已上传国�?);
    } catch (error) {
      console.error('更新上传国网状态失�?', error);
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
        message.error('未找到客户信�?);
        return;
      }
      
      // 切换电表安装状态，当前有值则清空，无值则设置为当前日�?      const updateObj: Record<string, any> = {
        meter_installation_date: customer.meter_installation_date ? null : new Date().toISOString()
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状�?      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      message.success(customer.meter_installation_date ? '已重置电表安装状�? : '已标记为电表已安�?);
    } catch (error) {
      console.error('更新电表安装状态失�?', error);
      message.error('操作失败，请重试');
    }
  };

  // 处理建设验收状态变�?- 简化版本，使用安全API
  const handleConstructionAcceptanceChange = async (id: string | undefined, currentDate: string | null) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      // 切换建设验收状态，当前有值则清空，无值则设置为当前日�?      const updateObj: Record<string, any> = {
        construction_acceptance_date: currentDate ? null : new Date().toISOString()
      };
      
      console.log(`[建设验收] 更新客户(${id})的建设验收状态，采用缓存+异步模式`);
      
      // 使用数据缓存服务更新数据，UI立即响应
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状�?      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      // 显示成功消息
      const successMsg = currentDate ? '已重置为未推到状�? : '已标记为推到完成';
      message.success(successMsg);
    } catch (error) {
      console.error('[建设验收] 操作过程出错:', error);
      
      if (error instanceof Error) {
        message.error(`更新失败: ${error.message}`);
      } else {
      message.error('操作失败，请重试');
    }
      
      // 失败时重新获取数�?      fetchCustomers();
    }
  };

  // 处理购售电合同状态变�?  const handlePowerPurchaseContractChange = async (id: string | undefined, currentStatus: string | null) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    try {
      // 如果当前有状态（已出合同），则恢复为待出状�?      // 如果当前没有状态（待出），则标记为已出合同
      const updateObj = {
        power_purchase_contract: currentStatus ? null : new Date().toISOString()
      };
      
      console.log(`[购售电合同] 更新客户(${id})的购售电合同状态，采用缓存+异步模式`);
      
      // 获取客户当前数据，确保不会影响其他字�?      const currentCustomer = customers.find(c => c.id === id);
      if (!currentCustomer) {
        throw new Error('找不到客户信�?);
      }
      
      // 使用数据缓存服务更新数据，UI立即响应
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状�?- 只更新power_purchase_contract字段，保留其他字段不�?      setCustomers(prev => 
        prev.map(c => {
          if (c.id === id) {
            return { 
              ...c, 
              power_purchase_contract: updateObj.power_purchase_contract
            };
          }
          return c;
        })
      );
      setFilteredCustomers(prev => 
        prev.map(c => {
          if (c.id === id) {
            return { 
              ...c, 
              power_purchase_contract: updateObj.power_purchase_contract
            };
          }
          return c;
        })
      );
      
      message.success(currentStatus ? '已恢复为待出状�? : '已标记为已出合同');
    } catch (error) {
      console.error('[购售电合同] 更新状态失�?', error);
      message.error('操作失败，请重试');
      
      // 失败时重新获取数�?      fetchCustomers();
    }
  };

  // 处理状态变�?  const handleStatusChange = async (id: string | undefined, newStatus: string) => {
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
      
      // 更新本地状�?      setCustomers(prev => 
        prev.map(customer => (customer.id === id ? { ...customer, ...updatedCustomer } : customer))
      );
      setFilteredCustomers(prev => 
        prev.map(customer => (customer.id === id ? { ...customer, ...updatedCustomer } : customer))
      );
      
      message.success(`状态已更新�? ${newStatus}`);
    } catch (error) {
      console.error('更新状态失�?', error);
      message.error('操作失败，请重试');
    }
  };

  // 显示状态选项对话�?  const showStatusOptions = (id: string | undefined, currentStatus: string) => {
    if (!id) {
      console.error('无效的客户ID');
      message.error('操作失败: 无效的客户ID');
      return;
    }
    
    // 定义状态选项
    const statusOptions = [
      { label: '提交资料', value: '提交资料', color: 'blue' },
      { label: '技术驳�?, value: '技术驳�?, color: 'red' },
      { label: '商务驳回', value: '商务驳回', color: 'orange' },
      { label: '已完�?, value: '已完�?, color: 'green' }
    ];
    
    // 使用状态变量跟踪选择
    let selectedStatus = currentStatus;
    
    Modal.confirm({
      title: '选择新状�?,
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

  // 渲染标题栏操作按�?  const renderTitleBar = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <Space>
        <Button 
          size="small"
          type={pageSize === 100 ? "primary" : "default"}
          onClick={() => handlePageSizeChange(100)}
          loading={loading && pageSize === 100}
        >
          100�?�?        </Button>
        <Button 
          size="small"
          type={pageSize === 500 ? "primary" : "default"}
          onClick={() => handlePageSizeChange(500)}
          loading={loading && pageSize === 500}
        >
          500�?�?        </Button>
        <Button 
          size="small"
          type={pageSize === 1000 ? "primary" : "default"}
          onClick={() => handlePageSizeChange(1000)}
          loading={loading && pageSize === 1000}
        >
          1000�?�?        </Button>
        <Select
          size="small"
          style={{ width: 100 }}
          value={currentPage}
          onChange={handlePageChange}
          placeholder="选择页码"
          disabled={loading}
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
          placeholder="搜索 (多关键词用空格或逗号分隔)"
          value={searchText}
          onChange={handleInputChange}
          onPressEnter={(e) => handleSearch(searchText)}
          style={{ width: 250 }}
          prefix={<SearchOutlined />}
          suffix={isSearching ? <LoadingOutlined /> : null}
          allowClear
          disabled={loading}
        />
        <Dropdown
          overlay={
            <Menu
              items={[
                {
                  key: "search",
                  icon: <SearchOutlined />,
                  label: "快速搜�?,
                  onClick: () => handleSearch(searchText)
                },
                {
                  key: "advanced",
                  icon: <SearchOutlined />,
                  label: "高级搜索",
                  onClick: showAdvancedSearch
                }
              ]}
            />
          }
          placement="bottomRight"
          trigger={['click']}
          disabled={loading}
        >
          <Button type="primary" icon={<SearchOutlined />} loading={isSearching} disabled={loading}>
            搜索 <DownOutlined />
        </Button>
        </Dropdown>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => navigate('/customers/new')}
          disabled={loading}
        >
          新增客户
        </Button>
        <Button 
          type="default" 
            icon={<ImportOutlined />} 
          onClick={() => navigate('/customers/import')}
          disabled={loading}
          >
            导入客户
          </Button>
          <Button 
            icon={<ExportOutlined />} 
            onClick={showExportModal}
          disabled={loading}
          >
          导出数据
          </Button>
        </Space>
      </div>
  )

  // 添加一个专门用于踏勘员的可编辑单元�?  const SurveyorCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'surveyor');
    const [hover, setHover] = useState(false);
    
    // 将踏勘员数据转换为Select选项格式
    const surveyorOptions = surveyors.map(surveyor => ({
      value: surveyor.name,
      label: surveyor.name,
      phone: surveyor.phone || ''
    }));
    
    console.log('渲染踏勘员单元格:', value, '可用踏勘员选项:', surveyorOptions);
    
    return editable ? (
      <Form.Item
        name="surveyor"
        style={{ margin: 0 }}
        initialValue={value}
      >
        <Select
          placeholder="请选择踏勘�?
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={surveyorOptions}
          onBlur={() => record.id ? saveEditedCell(record.id) : undefined}
          onChange={(value, option) => {
            console.log('选择踏勘�?', value, option);
            // 如果选择了踏勘员，自动填充电�?            if (value && typeof option === 'object' && 'phone' in option) {
              editForm.setFieldsValue({ surveyor_phone: option.phone });
            } else if (!value) {
              // 如果清空了踏勘员，也清空电话
              editForm.setFieldsValue({ surveyor_phone: '' });
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
            onClick={(e) => {
              e.stopPropagation();
              edit(record, 'surveyor');
            }}
            style={{ padding: '0 4px' }}
            title="编辑踏勘�?
          />
        )}
      </div>
    );
  };
  
  // 踏勘员电话可编辑单元�?  const SurveyorPhoneCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'surveyor_phone');
    const [hover, setHover] = useState(false);
    
    return editable ? (
      <Form.Item
        name="surveyor_phone"
        style={{ margin: 0 }}
      >
        <Input 
          placeholder="踏勘员电�? 
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
            onClick={(e) => {
              e.stopPropagation();
              edit(record, 'surveyor_phone');
            }}
            style={{ padding: '0 4px' }}
            title="编辑踏勘员电�?
          />
        )}
      </div>
    );
  };

  // 添加处理业务员名称更新的函数
  const handleUpdateSalesmanName = async (id: string, email: string, name: string, phone: string) => {
    try {
      console.log(`自动更新业务员数�? ID ${id}, 邮箱 ${email} -> 姓名 ${name}, 电话 ${phone}`);
      
      // 更新客户数据
      await customerApi.update(id, {
        salesman: name,
        salesman_phone: phone,
        salesman_email: email // 保留邮箱作为关联字段
      });
      
      // 更新本地数据，避免重复处�?      const updatedCustomers = customers.map(c => {
        if (c.id === id) {
          return { ...c, salesman: name, salesman_phone: phone };
        }
        return c;
      });
      
      setCustomers(updatedCustomers);
      // 如果有筛选，更新筛选后的数�?      if (filteredCustomers.length > 0) {
        const updatedFiltered = filteredCustomers.map(c => {
          if (c.id === id) {
            return { ...c, salesman: name, salesman_phone: phone };
          }
          return c;
        });
        setFilteredCustomers(updatedFiltered);
      }
    } catch (error) {
      console.error('自动更新业务员数据失�?', error);
    }
  };

  // 添加页码改变的处理函�?  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  }
  
  // 添加页面大小改变的处理函�?  const handlePageSizeChange = (size: number) => {
    // 如果正在切换到相同大小，直接返回
    if (size === pageSize) return;
    
    // 立即清除搜索状态，重置UI
    setIsSearching(false);
    
    // 从大页面切换到小页面时的特殊处理
    if ((pageSize === 500 || pageSize === 1000) && size === 100) {
      // 立即更新UI相关状�?    setPageSize(size);
      setCurrentPage(1);
      setIsBackgroundLoading(true);
      
      // 使用一个最小数据集先渲染界�?      const minimalDataset = filteredCustomers.slice(0, size);
      const minimalCache = { 1: minimalDataset };
      setCachedPageData(minimalCache);
      
      // 重新计算总页�?      const newTotalPages = Math.ceil(filteredCustomers.length / size);
      setTotalPages(newTotalPages);
      
      // 确保UI立即更新后再进行后台数据处理
      window.requestIdleCallback ? 
        window.requestIdleCallback(() => {
          setTimeout(() => finishDataProcessing(size, newTotalPages), 100);
        }) : 
        setTimeout(() => finishDataProcessing(size, newTotalPages), 200);
      
      return;
    }
    
    // 常规页面大小切换处理
    setPreviousPageSize(pageSize);
    const prevData = paginatedCustomers;
    setPreRenderedData(prevData);
    
    // 立即更新页面大小，这样UI会立即响�?    setPageSize(size);
    setCurrentPage(1);
    setIsBackgroundLoading(true);
    
    // 使用requestAnimationFrame确保UI先更�?    requestAnimationFrame(() => {
      // 使用Web Worker或setTimeout优化大数据处�?      if (size >= 500 && filteredCustomers.length > 1000) {
        // 对于大页面和大数据量，使用Web Worker处理
        if (window.Worker) {
          try {
            const cacheWorker = new Worker('/workers/cacheWorker.js');
            
            cacheWorker.onmessage = function(e) {
              const {cache, totalPages} = e.data;
              setCachedPageData(cache);
              setTotalPages(totalPages);
              
              // 重置表格滚动位置
              const tableBody = document.querySelector('.ant-table-body');
              if (tableBody) {
                tableBody.scrollTop = 0;
              }
              
              // 完成背景加载
              setTimeout(() => {
                setIsBackgroundLoading(false);
                setPreRenderedData([]);
              }, 100);
            };
            
            cacheWorker.postMessage({
              customers: filteredCustomers,
              pageSize: size
            });
            
          } catch (error) {
            console.error('Web Worker处理失败，回退到同步处�?', error);
            handleSyncCaching();
          }
        } else {
          // 没有Web Worker支持，使用异步处�?          handleSyncCaching();
        }
      } else {
        // 对于较小的数据集，直接处�?        handleSyncCaching();
      }
    });
    
    // 同步处理缓存的辅助函�?    function handleSyncCaching() {
      // 更新总页�?      const newTotalPages = Math.ceil(filteredCustomers.length / size);
      setTotalPages(newTotalPages);
      
      // 为提高性能，仅先缓存当前页和下一�?      const tempCache: {[key: number]: Customer[]} = {};
      
      // 先处理第一页和第二页，确保立即可用
      for (let page = 1; page <= Math.min(2, newTotalPages); page++) {
        const startIndex = (page - 1) * size;
        const endIndex = Math.min(startIndex + size, filteredCustomers.length);
        tempCache[page] = filteredCustomers.slice(startIndex, endIndex);
      }
      
      // 立即应用初始缓存
      setCachedPageData(tempCache);
      
      // 异步处理剩余页面的缓存，降低批次数量减轻内存压力
      if (newTotalPages > 2) {
        setTimeout(() => {
          // 每批处理3页，避免阻塞UI
          const processBatch = (startPage: number, endPage: number, fullCache: {[key: number]: Customer[]}) => {
            for (let page = startPage; page <= Math.min(endPage, newTotalPages); page++) {
              const startIndex = (page - 1) * size;
              const endIndex = Math.min(startIndex + size, filteredCustomers.length);
              fullCache[page] = filteredCustomers.slice(startIndex, endIndex);
            }
            
            // 如果还有更多页面，继续处理下一�?            if (endPage < newTotalPages) {
              // 更新当前已处理的缓存
              setCachedPageData({...fullCache});
              
              // 在下一帧处理下一�?              setTimeout(() => {
                processBatch(endPage + 1, endPage + 3, fullCache);
              }, 50);
            } else {
              // 所有页面都已缓存完�?              setCachedPageData({...fullCache});
              
              // 完成背景加载
              setIsBackgroundLoading(false);
              setPreRenderedData([]);
            }
          };
          
          // 开始批量处理，从第3页开始，使用setTimeout代替requestAnimationFrame
          processBatch(3, 5, {...tempCache});
        }, 100);
      } else {
        // 所有页面已缓存完成
        setTimeout(() => {
          setIsBackgroundLoading(false);
          setPreRenderedData([]);
        }, 100);
      }
      
      // 重置表格滚动位置
      const tableBody = document.querySelector('.ant-table-body');
      if (tableBody) {
        tableBody.scrollTop = 0;
      }
    }
    
    // 完成数据处理的辅助函�?    function finishDataProcessing(size: number, totalPages: number) {
      // 重置缓存，释放内�?      setCachedPageData({});
      
      // 只缓存第一页数�?      const newCache: {[key: number]: Customer[]} = {
        1: filteredCustomers.slice(0, size)
      };
      
      // 如果有第二页，也预加�?      if (totalPages > 1) {
        newCache[2] = filteredCustomers.slice(size, size * 2);
      }
      
      // 更新缓存
      setCachedPageData(newCache);
      
      // 完成背景加载
      setIsBackgroundLoading(false);
      
      // 重置表格滚动位置
      const tableBody = document.querySelector('.ant-table-body');
      if (tableBody) {
        tableBody.scrollTop = 0;
      }
    }
  }
  
  // 修改为普通分页函�?  const getPagedCustomers = () => {
    // 尝试从缓存获取当前页数据
    if (cachedPageData[currentPage]) {
      return cachedPageData[currentPage];
    }
    
    // 如果缓存中没有，则计算当前页的数�?    const pageStartIndex = (currentPage - 1) * pageSize;
    const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredCustomers.length);
    
    // 返回当前页的数据
    return filteredCustomers.slice(pageStartIndex, pageEndIndex);
  };

  // 虚拟滚动优化函数用于大数据量分页
  const getVirtualCustomers = () => {
    // 在分页小�?00时，使用普通分页方�?    if (pageSize < 500) {
      return getPagedCustomers();
    }
    
    // 大页面模式下，首次加载可以直接使用预渲染数据
    if (preRenderedData.length > 0 && pageSize !== previousPageSize) {
      // 清除预渲染数据，只使用一�?      setTimeout(() => setPreRenderedData([]), 0);
      return preRenderedData;
    }
    
    // 获取所有数据，不使用虚拟滚�?    // 返回全部当前页数据，不做任何裁剪
    return getPagedCustomers();
  };

  // 更新计算当前页显示的数据函数
  const [forceUpdate, setForceUpdate] = useState(0);
  const paginatedCustomers = useMemo(() => {
    // 如果正在编辑，避免重新计算以提高性能
    if (editingRef.current) {
      return getPagedCustomers();
    }
    
    // 大页面模式使用虚拟滚�?    if (pageSize >= 500) {
      return getVirtualCustomers();
    }
    
    // 普通模式使用标准分�?    return getPagedCustomers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCustomers, currentPage, pageSize, editingCell, preRenderedData, forceUpdate]);

  // 监听表格滚动以支持虚拟滚�?  useEffect(() => {
    // 仅在大页面模式下启用
    if (pageSize < 500) return;
    
    const handleScroll = () => {
      // 如果正在编辑，不要触发重新渲�?      if (editingRef.current) return;
      
      // 防抖处理滚动事件
      if (window.scrollTimer) {
        clearTimeout(window.scrollTimer);
      }
      
      window.scrollTimer = setTimeout(() => {
        // 手动触发重新渲染以更新虚拟列�?        setFilteredCustomers([...filteredCustomers]);
      }, 100);
    };
    
    const tableBody = document.querySelector('.ant-table-body');
    if (tableBody) {
      tableBody.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (tableBody) {
        tableBody.removeEventListener('scroll', handleScroll);
      }
      if (window.scrollTimer) {
        clearTimeout(window.scrollTimer);
      }
    };
  }, [pageSize, filteredCustomers]);

  // 修改handleSearch函数，用于按钮点击和Enter键触发搜�?  const handleSearch = useCallback((value: string) => {
    setIsSearching(true); // 设置搜索中状�?    setCurrentPage(1); // 搜索时重置到第一�?    
    // 使用requestAnimationFrame延迟搜索执行，减少UI阻塞
    requestAnimationFrame(() => {
      // 执行搜索操作
      performSearch(value);
      
      // 在搜索结果为空时，仅显示一次提示消�?      if (value.trim().length > 0 && filteredCustomers.length === 0 && customers.length > 0) {
        message.info(`未找到匹�?${value}"的客户记录`);
      }
      
      setIsSearching(false); // 搜索完成
    });
  }, [customers, performSearch, filteredCustomers]);

  // 处理首次联系状态变�?  const handleFirstContactChange = async (id: string | undefined) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('未找到客户信�?);
        return;
      }
      
      // 使用类型断言解决类型问题
      const hasFirstContact = (customer as any).first_contact;
      const updateObj: Record<string, any> = {
        first_contact: hasFirstContact ? null : new Date().toISOString()
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状�?      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      message.success(hasFirstContact ? '已重置首次联系状�? : '已标记为已联�?);
    } catch (error) {
      console.error('更新首次联系状态失�?', error);
      message.error('操作失败，请重试');
    }
  };

  // 处理续约状态变�?  const handleRenewalStatusChange = async (id: string | undefined) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('未找到客户信�?);
        return;
      }
      
      // 使用类型断言解决类型问题
      const hasRenewalStatus = (customer as any).renewal_status;
      const updateObj: Record<string, any> = {
        renewal_status: hasRenewalStatus ? null : new Date().toISOString()
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状�?      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      message.success(hasRenewalStatus ? '已重置续约状�? : '已标记为已续�?);
    } catch (error) {
      console.error('更新续约状态失�?', error);
      message.error('操作失败，请重试');
    }
  };

  // 处理有意向状态变�?  const handleInterestStatusChange = async (id: string | undefined) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) {
        message.error('未找到客户信�?);
        return;
      }
      
      // 切换有意向状�?      const updateObj = {
        status: customer.status === 'interested' ? null : 'interested'
      };
      
      // 使用数据缓存服务更新数据
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状�?      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      message.success(customer.status === 'interested' ? '已重置意向状�? : '已标记为有意�?);
    } catch (error) {
      console.error('更新意向状态失�?', error);
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
      
      // 更新本地状�?      setCustomers(prev => 
        prev.map(customer => (customer.id === recordId ? { ...customer, urge_order: updatedCustomer.urge_order } : customer))
      );
      setFilteredCustomers(prev => 
        prev.map(customer => (customer.id === recordId ? { ...customer, urge_order: updatedCustomer.urge_order } : customer))
      );
      
      // 显示操作结果
      message.success(updatedCustomer.urge_order ? '已添加催单标�? : '已移除催单标�?);
    } catch (error) {
      console.error('催单操作失败:', error);
      message.error('催单操作失败');
      // 如果出错，刷新列表获取最新数�?      fetchCustomers();
    }
  };

  // 处理图纸变更按钮点击事件
  const handleDrawingChangeClick = async (recordId: string, newValue: string) => {
    try {
      if (!recordId) {
        message.error('记录ID无效');
        return;
      }
      
      // 使用Record<string, any>类型绕过类型检�?      const updateData: Record<string, any> = {
        drawing_change: newValue || '未出�?
      };
      
      // 使用updateWithCache方法异步更新，绕过类型检�?      await customerApi.updateWithCache(recordId, updateData);
      
      // 本地更新状态，使用类型断言
      setCustomers(prev => 
        prev.map(customer => {
          if (customer.id === recordId) {
            const updatedCustomer = { ...customer } as any;
            updatedCustomer.drawing_change = newValue || '未出�?;
            return updatedCustomer;
          }
          return customer;
        })
      );
      
      setFilteredCustomers(prev => 
        prev.map(customer => {
          if (customer.id === recordId) {
            const updatedCustomer = { ...customer } as any;
            updatedCustomer.drawing_change = newValue || '未出�?;
            return updatedCustomer;
          }
          return customer;
        })
      );
      
      // 显示操作结果
      message.success(`图纸变更状态已更新�?${newValue || '未出�?}"`);
    } catch (error) {
      console.error('更新图纸变更状态失�?', error);
      message.error('更新图纸变更状态失�?);
      // 如果出错，刷新列表获取最新数�?      fetchCustomers();
    }
  };

  // 处理物品出库状态变�?  const handleItemOutboundClick = async (recordId: string, itemType: string) => {
    try {
      if (!recordId) {
        message.error('记录ID无效');
        return;
      }

      // 找到当前客户
      const customer = customers.find(c => c.id === recordId);
      if (!customer) {
        message.error('找不到客户信�?);
        return;
      }

      // 准备更新数据
      const updateData: Record<string, any> = {};
      
      // 方钢和组件需要特殊处理，包括状态字�?      if (itemType === 'square_steel' || itemType === 'component') {
        // 获取当前状�?        const statusField = `${itemType}_status`;
        const dateField = `${itemType}_outbound_date`; 
        const status = customer[statusField as keyof Customer] || 'none';
        
        // 根据当前状态决定下一个状�?        if (status === 'none') {
          // 未出�?-> 出库
          updateData[dateField] = dayjs().format('YYYY-MM-DD');
          updateData[statusField] = 'outbound';
          updateData[`${itemType}_inbound_date`] = null;
        } else if (status === 'outbound') {
          // 出库 -> 回库
          updateData[statusField] = 'inbound';
          updateData[`${itemType}_inbound_date`] = dayjs().format('YYYY-MM-DD');
          // 保留出库日期
        } else if (status === 'inbound') {
          // 回库 -> 未出库（重置�?          updateData[dateField] = null;
          updateData[statusField] = 'none';
          updateData[`${itemType}_inbound_date`] = null;
        }
      } else {
        // 其他物品简单处理出库日�?        const statusField = `${itemType}_outbound_date`;
        const currentStatus = customer[statusField as keyof Customer];
        
        // 如果当前有出库日期，则标记为空（撤销出库�?        // 否则设置为当前日期（标记为已出库�?        updateData[statusField] = currentStatus ? null : dayjs().format('YYYY-MM-DD');
      }
      
      // 使用updateWithCache方法异步更新
      await customerApi.updateWithCache(recordId, updateData);
      
      // 更新本地状�?      setCustomers(prev => 
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
      
      // 根据操作类型显示不同的成功消�?      const itemNames: Record<string, string> = {
        'inverter': '逆变�?,
        'copper_wire': '铜线',
        'aluminum_wire': '铝线',
        'distribution_box': '配电�?,
        'square_steel': '方钢',
        'component': '组件'
      };
      
      // 方钢和组件特殊消息处�?      let actionText = '';
      if (itemType === 'square_steel' || itemType === 'component') {
        const status = updateData[`${itemType}_status`];
        if (status === 'outbound') {
          actionText = '已标记为出库';
        } else if (status === 'inbound') {
          actionText = '已标记为回库';
        } else {
          actionText = '已重置为未出�?;
        }
      } else {
        // 其他物品使用通用消息
        actionText = updateData[`${itemType}_outbound_date`] ? '出库成功' : '已撤销出库';
      }
      
      message.success(`${itemNames[itemType] || '物品'} ${actionText}`);
      
    } catch (error) {
      console.error('更新物品出库状态失�?', error);
      message.error('更新物品出库状态失�?);
      // 如果出错，刷新列表获取最新数�?      fetchCustomers();
    }
  };

  // 添加设计师选择单元格组�?  const DesignerCell = ({ value, record }: { value: any; record: Customer }) => {
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
      label: '清空设计�?,
      phone: ''
    });
    
    return editable ? (
      <Form.Item
        name="designer"
        style={{ margin: 0 }}
      >
        <Select
          placeholder="请选择设计�?
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={designerOptions}
          onBlur={() => record.id ? saveEditedCell(record.id) : undefined}
          onChange={(value, option) => {
            // 如果选择了设计师，自动填充电�?            if (value && typeof option === 'object' && 'phone' in option) {
              editForm.setFieldsValue({ designer_phone: option.phone });
            } else if (!value) {
              // 如果清空了设计师，也清空设计师电�?              editForm.setFieldsValue({ designer_phone: '' });
            }
          }}
          onSearch={(input) => {
            // 当用户输入文本时，查找匹配的设计师并自动填充电话
            if (input) {
              const matchedDesigner = designers.find(
                designer => designer.name && designer.name.includes(input)
              );
              if (matchedDesigner && matchedDesigner.phone) {
                editForm.setFieldsValue({ designer_phone: matchedDesigner.phone });
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
            onClick={(e) => {
              e.stopPropagation();
              edit(record, 'designer');
            }}
            style={{ padding: '0 4px' }}
            title="编辑设计�?
          />
        )}
      </div>
    );
  };
  
  // 添加设计师电话可编辑单元�?  const DesignerPhoneCell = ({ value, record }: { value: any; record: Customer }) => {
    const editable = isEditing(record, 'designer_phone');
    const [hover, setHover] = useState(false);
    
    return editable ? (
      <Form.Item
        name="designer_phone"
        style={{ margin: 0 }}
      >
        <Input 
          placeholder="设计师电�? 
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
            onClick={(e) => {
              e.stopPropagation();
              edit(record, 'designer_phone');
            }}
            style={{ padding: '0 4px' }}
            title="编辑设计师电�?
          />
        )}
      </div>
    );
  };

  // 预填充页面缓�?  const populatePageCache = (data: Customer[], size: number) => {
    const newCache: {[key: number]: Customer[]} = {};
    
    const pages = Math.ceil(data.length / size);
    for (let page = 1; page <= pages; page++) {
      const startIndex = (page - 1) * size;
      const endIndex = Math.min(startIndex + size, data.length);
      newCache[page] = data.slice(startIndex, endIndex);
    }
    
    setCachedPageData(newCache);
  };

  // 使用useCallback优化setSearchFields，避免不必要的重新渲�?  const handleSearchFieldsChange = useCallback((newFields: {[key: string]: boolean}) => {
    setSearchFields(newFields);
  }, []);
  
  // 使用useCallback优化showAdvancedSearch函数
  const showAdvancedSearch = useCallback(() => {
    setAdvancedSearchVisible(true);
  }, []);
  
  // 处理高级搜索确认
  const handleAdvancedSearchConfirm = useCallback(() => {
    setAdvancedSearchVisible(false);
    // 执行搜索
    performSearch(searchText);
  }, [searchText]);
  
  // 优化后的高级搜索模态框组件
  const AdvancedSearchModal = () => {
    // 使用本地状态，不会触发父组件重新渲�?    const [localFields, setLocalFields] = useState<{[key: string]: boolean}>(() => ({...searchFields}));
    
    // 使用useEffect同步searchFields到localFields，仅在Modal打开�?    useEffect(() => {
      if (advancedSearchVisible) {
        setLocalFields({...searchFields});
      }
    }, [advancedSearchVisible]);
    
    // 单个字段状态变更，只更新本地状�?    const handleFieldChange = (field: string, checked: boolean) => {
      setLocalFields(prev => ({...prev, [field]: checked}));
    };
    
    // 计算选中的字段数
    const selectedCount = Object.values(localFields).filter(Boolean).length;
    
    // 确认按钮处理函数
    const onOk = () => {
      // 仅在确认时更新父组件状态，避免中间状态引起不必要的渲�?      setSearchFields(localFields);
      setAdvancedSearchVisible(false);
      // 执行搜索
      performSearch(searchText);
    };
    
    // 取消按钮处理函数
    const onCancel = () => {
      setAdvancedSearchVisible(false);
    };
    
    return (
      <Modal
        title="高级搜索设置"
        open={advancedSearchVisible}
        onOk={onOk}
        onCancel={onCancel}
        okText="确认"
        cancelText="取消"
        destroyOnClose={true}
        styles={{
          body: { 
            padding: '16px 24px', 
            maxHeight: 'calc(100vh - 300px)', 
            overflow: 'auto'
          }
        }}
      >
        <div>
          <p>请选择要搜索的字段�?/p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {Object.entries(fieldNameMap).map(([field, name]) => (
              <Checkbox
                key={field}
                checked={!!localFields[field]}
                onChange={(e) => handleFieldChange(field, e.target.checked)}
              >
                {name}
              </Checkbox>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <p>当前搜索内容：{searchText || '(�?'}</p>
            <p>当前将在{selectedCount}个字段中进行搜索</p>
          </div>
        </div>
      </Modal>
    );
  };

  // 在组件顶部添加搜索状�?  const [isSearching, setIsSearching] = useState(false);

  return (
    <div className="customer-list-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderTitleBar()}
      
      <Form form={editForm} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Table 
            className={`customer-table ${pageSize >= 500 ? 'large-mode' : ''}`}
            dataSource={paginatedCustomers} 
            columns={columns} 
            rowKey="id"
            loading={loading}
            size="small"
            bordered
            pagination={false}
            // 为所有页面添加垂直滚动配�?            scroll={{ y: 'calc(100vh - 280px)', x: 'max-content' }}
            // 大页码时启用虚拟滚动优化
            virtual={pageSize >= 500}
            rowClassName={(record, index) => {
              // 使用奇偶行样式，提高渲染性能
              const baseClass = index % 2 === 0 ? 'table-row-light' : 'table-row-dark';
              // 如果是编辑状态添加编辑样�?              const editingClass = editingCell && editingCell.id === record.id ? 'editing-row' : '';
              return `${baseClass} ${editingClass}`.trim();
            }}
            components={{
              body: {
                // 使用虚拟滚动时保持渲染的行不�?                row: React.memo((props: any) => <tr {...props} />, 
                  (prev, next) => {
                    // 只在编辑状态变化或数据变化时重新渲染行
                    const prevRecord = prev.children[0]?.props?.record;
                    const nextRecord = next.children[0]?.props?.record;
                    if (!prevRecord || !nextRecord) return false;
                    
                    // 检查ID是否相同
                    if (prevRecord.id !== nextRecord.id) return false;
                    
                    // 检查是否在编辑这一�?                    const isEditingRow = editingCell && editingCell.id === prevRecord.id;
                    const wasEditingRow = editingCell && editingCell.id === nextRecord.id;
                    if (isEditingRow || wasEditingRow) return false;
                    
                    return true;
                  }
                ),
                // 定制单元格组件，提高渲染性能
                cell: React.memo((props: any) => <td {...props} />)
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
              padding: 8px 12px; /* 减小单元格内边距 */
              text-align: center;
              contain: content; /* 限制内容渲染范围 */
            }
            .customer-table .ant-table-thead > tr > th {
              padding: 8px 12px; /* 减小表头内边�?*/
              font-weight: bold;
              white-space: nowrap;
              background-color: #f0f5ff;
              text-align: center;
            }
            
            /* 奇偶行样式，避免悬停时重绘整�?*/
            .table-row-light {
              background-color: #ffffff;
              contain: layout;
            }
            .table-row-dark {
              background-color: #fafafa;
              contain: layout;
            }
            .table-row-light:hover, .table-row-dark:hover {
              background-color: #f0f7ff !important;
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
            
            /* 性能优化相关样式 */
            .customer-table .ant-table-body {
              will-change: transform; /* 启用GPU加�?*/
              overflow-anchor: none; /* 禁用浏览器的滚动锚定优化 */
              transform: translateZ(0); /* 强制GPU加�?*/
              backface-visibility: hidden; /* 提高渲染性能 */
              perspective: 1000; /* 提高渲染性能 */
              contain: strict; /* 限制渲染区域 */
            }
            
            .customer-table .ant-table-row:not(:hover) {
              contain: layout style paint; /* 限制布局和样式计算范�?*/
            }
            
            .customer-table .ant-table-tbody .ant-table-row {
              transition: none !important; /* 禁用行hover的过渡效�?*/
              contain: layout style; /* 隔离布局和样�?*/
            }
            
            /* 大数据量模式下减少不必要的渲�?*/
            .customer-table.large-mode .ant-table-row:not(.ant-table-row-hover):not(.editing-row) {
              content-visibility: auto; /* 自动管理内容可见�?*/
              contain-intrinsic-size: 0 54px; /* 预设行高，避免滚动跳�?*/
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
              overscroll-behavior: contain; /* 防止iOS的弹性滚�?*/
              scroll-behavior: auto; /* 优化滚动性能 */
            }
            
            /* 禁用非必要的动画效果 */
            .ant-table * {
              animation-duration: 0s !important;
            }
            
            /* 优化表格在大数据量下的渲染性能 */
            @supports (content-visibility: auto) {
              .customer-table .ant-table-row:not(:hover):not(.editing-row) {
                content-visibility: auto;
                contain-intrinsic-size: auto 54px;
              }
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
              <p>�?成功导入: {importResult.success}</p>
              <p>⚠️ 跳过重复: {importResult.duplicate}</p>
              <p>�?导入失败: {importResult.failed}</p>
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
            <p>请上传包含以下字段的Excel文件（CSV、XLS、XLSX�?</p>
            <p><b>必填字段</b>: 客户姓名, 客户电话, 地址, 身份证号, 业务�?/p>
            <p><b>推荐填写</b>: 组件数量 (用于自动计算其他字段)</p>
            <p><b>可选字�?/b>: 登记日期, 业务员电�? 备案日期, 电表号码, 设计�? 公司(昊尘/祐之), 状�?/p>
            <p><b>常见导入失败原因</b>: 缺少必填字段、数据格式错误、客户数据重�?/p>
            
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button 
                type="link" 
                icon={<FileExcelOutlined />} 
                onClick={() => console.log('模板下载功能已移�?)}
              >
                下载导入模板
              </Button>
            </div>
            
            <Dragger {...uploadProps} disabled={importLoading}>
              <p className="ant-upload-drag-icon">
                <FileExcelOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上�?/p>
              <p className="ant-upload-hint">支持 .xlsx, .xls, .csv 格式</p>
            </Dragger>
            
            {importLoading && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <p>正在导入数据，请稍�?..</p>
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
                title: '原�?,
                dataIndex: 'old_value',
                key: 'old_value',
                ellipsis: true,
              },
              {
                title: '新�?,
                dataIndex: 'new_value',
                key: 'new_value',
                ellipsis: true,
              },
              {
                title: '修改�?,
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
      
      {/* 导出选项模态框 */}
      <Modal
        title="选择导出字段"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setExportModalVisible(false)}>
            取消
          </Button>,
          <Button key="exportAll" onClick={selectAllExportFields}>
            全�?          </Button>,
          <Button key="deselectAll" onClick={deselectAllExportFields}>
            取消全�?          </Button>,
          <Button key="export" type="primary" loading={exportLoading} onClick={handleExportWithFields}>
            导出
          </Button>,
        ]}
        width={700}
      >
        <div style={{ maxHeight: '60vh', overflow: 'auto', padding: '10px 0' }}>
          <Row gutter={[16, 8]}>
            {Object.keys(exportFields).map(field => (
              <Col span={8} key={field}>
                <Checkbox
                  checked={exportFields[field]}
                  onChange={e => handleExportFieldChange(field, e.target.checked)}
                  disabled={field === '客户姓名'} // 客户姓名字段必�?                >
                  {field}
                </Checkbox>
              </Col>
            ))}
          </Row>
        </div>
      </Modal>
      
      {/* 使用新的高级搜索模态框 */}
      <AdvancedSearchModal />
    </div>
  )
}

export default CustomerList
