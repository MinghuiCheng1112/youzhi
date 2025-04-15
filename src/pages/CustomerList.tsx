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
import TableHeaderFilter from '../components/dashboard/TableHeaderFilter';
import tableHeaderConfigs from '../components/dashboard/tableHeaderConfig';

const { Title } = Typography
const { confirm } = Modal
const { Dragger } = Upload
const { RangePicker } = DatePicker

// 扩展Window接口，添加scrollTimer属性
declare global {
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
  // 添加分页相关状态
  const [pageSize, setPageSize] = useState<number>(100)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  // 添加缓存页面数据的状态
  const [cachedPageData, setCachedPageData] = useState<{[key: number]: Customer[]}>({})
  // 添加是否正在后台加载数据的状态
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false)
  // 添加上一次的页面大小
  const [previousPageSize, setPreviousPageSize] = useState<number>(100)
  // 添加用于存储预渲染数据的状态
  const [preRenderedData, setPreRenderedData] = useState<Customer[]>([])
  // 用于控制编辑时的性能优化
  const editingRef = useRef<boolean>(false)
  // 添加强制刷新表格的计数器
  const [forceUpdate, setForceUpdate] = useState<number>(0)
  
  // 添加高级搜索相关状态
  const [advancedSearchVisible, setAdvancedSearchVisible] = useState(false)
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
    salesman: '业务员',
    id_card: '身份证号',
    meter_number: '电表号码',
    designer: '设计师',
    surveyor: '踏勘员',
    construction_team: '施工队',
    remarks: '备注',
  }
  
  // 限制每次最大加载记录数以提高性能
  const MAX_RECORDS_PER_LOAD = 5000; // 增加到5000，确保能加载所有数据
  // 添加虚拟滚动页大小常量
  const VIRTUAL_PAGE_SIZE = 100; // 在大页面模式下使用虚拟滚动分页
  
  // 获取方钢出库状态的辅助函数
  const getSquareSteelStatus = (customer: Customer): string => {
    if (customer.square_steel_outbound_date && customer.square_steel_inbound_date) {
      return '已回库';
    } else if (customer.square_steel_outbound_date) {
      return '已出库';
    } else {
      return '未出库';
    }
  };

  // 获取组件出库状态的辅助函数
  const getComponentStatus = (customer: Customer): string => {
    if (customer.component_outbound_date && customer.component_inbound_date) {
      return '已回库';
    } else if (customer.component_outbound_date) {
      return '已出库';
    } else {
      return '未出库';
    }
  };
  
  const STATION_MANAGEMENT_OPTIONS = [
    { value: '房产证', label: '房产证', color: 'blue' },
    { value: '授权书', label: '授权书', color: 'purple' },
    { value: '银行卡', label: '银行卡', color: 'cyan' },
    { value: '航拍', label: '航拍', color: 'green' },
    { value: '结构照', label: '结构照', color: 'magenta' },
    { value: '门头照', label: '门头照', color: 'orange' },
    { value: '合同', label: '合同', color: 'red' },
    { value: '日期', label: '日期', color: 'cyan' }
  ];

  // 定义图纸变更选项
  const DRAWING_CHANGE_OPTIONS = [
    { value: '未出图', label: '未出图', color: 'default' },
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

  // 在组件开始处添加状态
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFields, setExportFields] = useState<{[key: string]: boolean}>({
    '登记日期': true,
    '客户姓名': true,
    '客户电话': true,
    '地址': true,
    '身份证号': true,
    '业务员': true,
    '业务员电话': true,
    '业务员邮箱': false,
    '踏勘员': true,
    '踏勘员电话': true,
    '踏勘员邮箱': false,
    '补充资料': true,
    '备案日期': true,
    '电表号码': true,
    '设计师': true,
    '设计师电话': true,
    '图纸变更': true,
    '催单': true,
    '容量(KW)': true,
    '投资金额': true,
    '用地面积(m²)': true,
    '组件数量': true,
    '逆变器': true,
    '铜线': true,
    '铝线': true,
    '配电箱': true,
    '方钢出库日期': true,
    '组件出库日期': true,
    '派工日期': true,
    '施工队': true,
    '施工队电话': true,
    '施工状态': true,
    '大线': true,
    '技术审核': true,
    '上传国网': true,
    '建设验收': true,
    '挂表日期': true,
    '购售电合同': true,
    '状态': true,
    '价格': true,
    '公司': true,
    '备注': true,
    '创建时间': false,
    '最后更新': false,
  });

  // 添加日期筛选相关状态
  const [registerDateRange, setRegisterDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [filingDateRange, setFilingDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

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
      console.log('开始获取所有客户数据...');
      // 获取所有客户
      const data = await customerApi.getAll()
      console.log(`成功获取到 ${data.length} 条客户数据`);
      
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
        
        // 将从user_roles表获取的业务员信息合并到映射中
        if (salesmenData) {
          salesmenData.forEach(salesman => {
            if (salesman.name && salesman.name.trim() !== '') {
              // 只有当salesmen中不存在此业务员或电话为空时才更新
              if (!salesmen.has(salesman.name) || !salesmen.get(salesman.name)) {
                salesmen.set(salesman.name, salesman.phone || '');
              }
            }
          });
        }
      } catch (error) {
        console.error('获取业务员信息失败:', error);
      }
      
      // 转换为数组并更新业务员列表
      const salesmenArray = Array.from(salesmen).map(([name, phone]) => ({
        name,
        phone
      }));
      
      // 更新业务员列表
      setSalesmenList(salesmenArray);
      
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
              
        // 更新状态，保留之前处理的数据
        setCustomers(prev => [...prev, ...processedBatch]);
        setFilteredCustomers(prev => [...prev, ...processedBatch]);
            
        // 检查是否还有更多数据需要处理
        if (endIndex < data.length) {
          // 使用setTimeout避免阻塞UI
          setTimeout(() => {
            processData(endIndex, batchSize);
          }, 0);
        } else {
          // 所有数据处理完成
          console.log('所有客户数据处理完成');
          setTotalPages(Math.ceil(data.length / pageSize)); // 更新总页数
          setLoading(false);
        }
      };
      
      // 重置状态并开始处理第一批数据
      setCustomers([]);
      setFilteredCustomers([]);
      processData(0, MAX_RECORDS_PER_LOAD);
      
    } catch (error) {
      message.error('获取客户数据失败')
      console.error(error)
      setLoading(false)
    }
  };

  // 获取施工队列表
  const fetchConstructionTeams = async () => {
    try {
      console.log('开始获取施工队数据...');
      
      // 使用新的getAll方法获取所有来源的施工队数据
      const teamList = await constructionTeamApi.getAll();
      console.log('获取到的施工队数据:', teamList);
      
      if (teamList && teamList.length > 0) {
        setConstructionTeams(teamList);
        return;
      }
      
      // 如果getAll仍然获取不到数据，使用空列表
      console.log('无法获取施工队数据，使用空列表');
      setConstructionTeams([]);
    } catch (error) {
      console.error('获取施工队列表失败:', error);
      message.error('获取施工队列表失败');
      
      // 发生错误时使用空数组
      setConstructionTeams([]);
    }
  };

  // 获取踏勘员列表
  const fetchSurveyors = async () => {
    try {
      console.log('开始获取踏勘员数据...');
      
      // 使用新的getAll方法获取所有来源的踏勘员数据
      const surveyorList = await surveyorApi.getAll();
      console.log('获取到的踏勘员数据:', surveyorList);
      
      if (surveyorList && surveyorList.length > 0) {
        setSurveyors(surveyorList);
        return;
      }
      
      // 如果getAll仍然获取不到数据，回退到从customers表中查询（这是一个额外的保障）
      console.log('无法获取踏勘员数据，使用空列表');
      setSurveyors([]);
    } catch (error) {
      console.error('获取踏勘员列表失败:', error);
      message.error('获取踏勘员列表失败');
      
      // 发生错误时使用空数组
      setSurveyors([]);
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
    const isSearching = true;
    
    try {
      const trimmed = value.trim();
      
      // 检查是否有任何筛选条件
      if (trimmed === '' && !registerDateRange && !filingDateRange) {
        // 如果没有搜索关键词和日期筛选，恢复全部数据
      setFilteredCustomers(customers);
      setTotalPages(Math.ceil(customers.length / pageSize));
      setCurrentPage(1); // 重置到第一页
      return;
    }
      
      // 先按日期范围筛选客户
      let dateFilteredCustomers = [...customers];
      
      // 按登记日期筛选
      if (registerDateRange && registerDateRange[0] && registerDateRange[1]) {
        const startDate = registerDateRange[0].startOf('day');
        const endDate = registerDateRange[1].endOf('day');
        
        dateFilteredCustomers = dateFilteredCustomers.filter(customer => {
          if (!customer.register_date) return false;
          const customerDate = dayjs(customer.register_date);
          return customerDate.isAfter(startDate) && customerDate.isBefore(endDate);
        });
      }
      
      // 按备案日期筛选
      if (filingDateRange && filingDateRange[0] && filingDateRange[1]) {
        const startDate = filingDateRange[0].startOf('day');
        const endDate = filingDateRange[1].endOf('day');
        
        dateFilteredCustomers = dateFilteredCustomers.filter(customer => {
          if (!customer.filing_date) return false;
          const customerDate = dayjs(customer.filing_date);
          return customerDate.isAfter(startDate) && customerDate.isBefore(endDate);
        });
      }
      
      // 如果没有搜索关键词，只进行日期筛选
      if (trimmed === '') {
        setFilteredCustomers(dateFilteredCustomers);
        setTotalPages(Math.ceil(dateFilteredCustomers.length / pageSize));
      setCurrentPage(1); // 重置到第一页
      return;
    }

    // 支持空格或逗号分隔的多关键词搜索
      const keywords = trimmed.split(/[\s,，]+/)
      .filter(keyword => keyword.trim() !== ''); // 过滤掉空字符串
    
      if (keywords.length === 0) {
        setFilteredCustomers(dateFilteredCustomers);
        setTotalPages(Math.ceil(dateFilteredCustomers.length / pageSize));
        setCurrentPage(1); // 重置到第一页
        return;
      }
    
    // 获取启用的搜索字段
    const enabledFields = Object.entries(searchFields)
      .filter(([_, enabled]) => enabled)
      .map(([field]) => field);
    
    // 如果没有启用任何字段，使用默认字段
    if (enabledFields.length === 0) {
      enabledFields.push('customer_name', 'phone', 'address', 'salesman', 'id_card', 'meter_number');
    }
    
      // 在日期筛选结果的基础上进行关键词筛选
      const filtered = dateFilteredCustomers.filter(customer => {
      // 检查启用的每个字段
      return keywords.some(keyword => 
        enabledFields.some(field => {
            const fieldValue = ((customer as any)[field] || '').toString().toLowerCase();
            return fieldValue.includes(keyword.toLowerCase());
        })
      );
    });
    
    setFilteredCustomers(filtered);
    setTotalPages(Math.ceil(filtered.length / pageSize));
    setCurrentPage(1); // 重置到第一页
    } catch (error) {
      console.error('搜索出错:', error);
      message.error('搜索过程中出现错误');
    }
  };
  
  // 处理日期范围变化
  const handleRegisterDateChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    setRegisterDateRange(dates);
  };
  
  const handleFilingDateChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    setFilingDateRange(dates);
  };
  
  // 清除所有筛选条件
  const clearAllFilters = () => {
    setRegisterDateRange(null);
    setFilingDateRange(null);
    setSearchText('');
    performSearch('');
  };
  
  // 添加日期筛选组件
  const renderDateFilters = () => (
    <div style={{ marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderRadius: 4 }}>
      <Row gutter={[16, 8]} align="middle">
        <Col xs={24} sm={24} md={7} lg={7} xl={7}>
          <Space>
            <span style={{ whiteSpace: 'nowrap' }}>登记日期:</span>
            <RangePicker 
              value={registerDateRange} 
              onChange={handleRegisterDateChange} 
              style={{ width: '100%' }}
              allowClear={true}
              placeholder={['开始日期', '结束日期']}
              format="YYYY-MM-DD"
            />
          </Space>
        </Col>
        <Col xs={24} sm={24} md={7} lg={7} xl={7}>
          <Space>
            <span style={{ whiteSpace: 'nowrap' }}>备案日期:</span>
            <RangePicker 
              value={filingDateRange} 
              onChange={handleFilingDateChange} 
              style={{ width: '100%' }}
              allowClear={true}
              placeholder={['开始日期', '结束日期']}
              format="YYYY-MM-DD"
            />
          </Space>
        </Col>
        <Col xs={24} sm={24} md={10} lg={10} xl={10} style={{ textAlign: 'right' }}>
          <Space size="small">
            <Button 
              type="primary" 
              onClick={() => performSearch(searchText)}
              icon={<SearchOutlined />}
              disabled={loading}
            >
              应用筛选
            </Button>
            <Button 
              onClick={clearAllFilters}
              icon={<CloseCircleOutlined />}
              disabled={loading}
            >
              清除筛选
            </Button>
          </Space>
        </Col>
      </Row>
    </div>
  );
  
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
    
    // 标记正在编辑状态，避免虚拟滚动重新计算
    editingRef.current = true;
    
    // 在大页面模式下，确保在状态更新前先设置表单值，避免延迟
    if (pageSize >= 500) {
      // 先设置表单值，再设置编辑状态
      editForm.setFieldsValue({
        [dataIndex]: record[dataIndex as keyof Customer]
      });
      
      // 针对特定字段的处理
      if (dataIndex === 'construction_team') {
        const currentTeam = record.construction_team;
        const currentPhone = record.construction_team_phone;
        console.log('编辑施工队:', currentTeam, '当前电话:', currentPhone);
        
        editForm.setFieldsValue({
          construction_team: currentTeam,
          construction_team_phone: currentPhone
        });
      } else if (dataIndex === 'salesman') {
        // 同时设置业务员电话
        editForm.setFieldsValue({
          salesman_phone: record.salesman_phone
        });
      } else if (dataIndex === 'designer') {
        // 同时设置设计师电话
        editForm.setFieldsValue({
          designer_phone: record.designer_phone
        });
      } else if (dataIndex === 'surveyor') {
        // 同时设置踏勘员电话
        editForm.setFieldsValue({
          surveyor_phone: record.surveyor_phone
        });
      }
      
      // 使用requestAnimationFrame确保在下一帧渲染
      requestAnimationFrame(() => {
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
      // 常规页面模式的编辑流程
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
    }
  };

  // 取消编辑
  const cancel = () => {
    setEditingCell(null);
    // 编辑结束时重置标记
    editingRef.current = false;
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
      
      // 处理tags模式下的数组值
      if (['salesman', 'designer', 'surveyor', 'construction_team'].includes(dataIndex)) {
        // 如果是空数组，则设置为null
        if (Array.isArray(values[dataIndex]) && values[dataIndex].length === 0) {
          updateData[dataIndex] = null;
          console.log(`${dataIndex}字段为空数组，将其转换为null`);
        } 
        // 如果是只有一个元素的数组，则取第一个元素
        else if (Array.isArray(values[dataIndex]) && values[dataIndex].length === 1) {
          updateData[dataIndex] = values[dataIndex][0];
          console.log(`${dataIndex}字段为单元素数组，取第一个元素:`, values[dataIndex][0]);
        }
        // 如果数组有多个元素，只取第一个元素（因为我们设置了maxTagCount=1）
        else if (Array.isArray(values[dataIndex]) && values[dataIndex].length > 1) {
          updateData[dataIndex] = values[dataIndex][0];
          console.log(`${dataIndex}字段有多个元素，只保留第一个:`, values[dataIndex][0]);
        }
      }
      
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
        } else {
          // 如果设计师被清空，也清空设计师电话
          updateData.designer_phone = null;
          console.log('设计师被清空，同时清空设计师电话');
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
        } else {
          // 如果踏勘员被清空，也清空踏勘员电话
          updateData.surveyor_phone = null;
          console.log('踏勘员被清空，同时清空踏勘员电话');
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
        
        // 注意: 当组件数量大于0时，数据库会自动将图纸变更状态从"未出图"设置为"已出图"
        // 这是由数据库触发器auto_update_drawing_change实现的，只有当图纸变更状态为"已出图"后，前端才能修改该状态
        
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
          updateData.drawing_change = '未出图';
        }
      }
      
      // 处理补充资料字段中的"日期"选项
      if (dataIndex === 'station_management') {
        // 检查是否选择了"日期"选项
        if (Array.isArray(values.station_management) && values.station_management.includes('日期')) {
          // 创建当前时间戳
          const currentTimestamp = new Date().toISOString();
          
          // 从选项中移除"日期"
          const optionsWithoutDate = values.station_management.filter(item => item !== '日期');
          
          // 将其他选项和时间戳一起保存在station_management字段中
          // 保存格式：[选项1, 选项2, ..., 时间戳]
          updateData[dataIndex] = [...optionsWithoutDate, currentTimestamp];
          
          console.log('检测到"日期"选项，添加时间戳:', currentTimestamp);
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
      
      // 在500条/页和1000条/页模式下，确保更新页面缓存
      if (pageSize >= 500 && cachedPageData) {
        // 更新页面缓存中的数据
        const updatedCachedData = { ...cachedPageData };
        
        // 遍历所有缓存页查找并更新数据
        Object.keys(updatedCachedData).forEach(pageKey => {
          const page = parseInt(pageKey);
          const pageData = updatedCachedData[page];
          const cachedIndex = pageData.findIndex(customer => customer.id === id);
          
          if (cachedIndex > -1) {
            // 更新缓存中的客户数据
            pageData[cachedIndex] = { ...pageData[cachedIndex], ...updateData };
            console.log(`已更新页面缓存 ${page} 中的客户数据`);
          }
        });
        
        // 保存更新后的缓存
        setCachedPageData(updatedCachedData);
        
        // 强制重新渲染分页数据
        setForceUpdate(prev => prev + 1);
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
          // 使用数据缓存服务删除客户
          const success = await customerApi.deleteWithCache(id);
          
          if (success) {
          // 更新本地状态
          setCustomers(prev => prev.filter(customer => customer.id !== id));
          setFilteredCustomers(prev => prev.filter(customer => customer.id !== id));
          
          message.success('客户删除成功');
          } else {
            message.error('删除客户失败，请刷新页面后重试');
          }
        } catch (error) {
          message.error('删除客户失败，系统出现异常');
          console.error('删除客户时发生错误:', error);
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
  
  // 全选所有导出字段
  const selectAllExportFields = () => {
    const allFields = { ...exportFields };
    Object.keys(allFields).forEach(field => {
      allFields[field] = true;
    });
    setExportFields(allFields);
  };
  
  // 取消全选导出字段
  const deselectAllExportFields = () => {
    const allFields = { ...exportFields };
    Object.keys(allFields).forEach(field => {
      allFields[field] = false;
    });
    // 至少保留客户姓名字段
    allFields['客户姓名'] = true;
    setExportFields(allFields);
  };
  
  // 带选择字段的导出客户数据
  const handleExportWithFields = () => {
    setExportLoading(true);
    try {
      // 防止大数据量导出时阻塞UI
      setTimeout(() => {
        try {
          // 获取用户选择的字段
          const selectedFields = Object.keys(exportFields).filter(field => exportFields[field]);
          
      // 准备要导出的数据
          const exportData = filteredCustomers.map(customer => {
            const row: {[key: string]: any} = {};
            
            // 只添加用户选择的字段
            if (exportFields['登记日期']) 
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
            if (exportFields['业务员'])
              row['业务员'] = customer.salesman || '';
            if (exportFields['业务员电话'])
              row['业务员电话'] = customer.salesman_phone || '';
            if (exportFields['业务员邮箱'])
              row['业务员邮箱'] = customer.salesman_email || '';
            if (exportFields['踏勘员'])
              row['踏勘员'] = customer.surveyor || '';
            if (exportFields['踏勘员电话'])
              row['踏勘员电话'] = customer.surveyor_phone || '';
            if (exportFields['踏勘员邮箱'])
              row['踏勘员邮箱'] = customer.surveyor_email || '';
            if (exportFields['补充资料'])
              row['补充资料'] = Array.isArray(customer.station_management) 
                ? customer.station_management.join('、') 
                : (typeof customer.station_management === 'string' ? customer.station_management : '');
            if (exportFields['备案日期']) {
              // 处理备案日期格式
              if (customer.filing_date && customer.filing_date !== '') {
                if (dayjs(customer.filing_date).isValid()) {
                  row['备案日期'] = dayjs(customer.filing_date).format('YYYY-MM-DD');
                } else {
                  row['备案日期'] = customer.filing_date; // 如果不是有效日期，直接使用原始值
                }
              } else {
                row['备案日期'] = '';
              }
            }
            if (exportFields['电表号码'])
              row['电表号码'] = customer.meter_number || '';
            if (exportFields['设计师'])
              row['设计师'] = customer.designer || '';
            if (exportFields['设计师电话'])
              row['设计师电话'] = customer.designer_phone || '';
            if (exportFields['图纸变更'])
              row['图纸变更'] = customer.drawing_change || '未出图';
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
            if (exportFields['逆变器'])
              row['逆变器'] = customer.inverter || '';
            if (exportFields['铜线'])
              row['铜线'] = customer.copper_wire || '';
            if (exportFields['铝线'])
              row['铝线'] = customer.aluminum_wire || '';
            if (exportFields['配电箱'])
              row['配电箱'] = customer.distribution_box || '';
            if (exportFields['方钢出库日期']) {
              if (customer.square_steel_outbound_date === 'RETURNED') {
                row['方钢出库日期'] = '退单';
              } else if (customer.square_steel_outbound_date && dayjs(customer.square_steel_outbound_date).isValid()) {
                row['方钢出库日期'] = dayjs(customer.square_steel_outbound_date).format('YYYY-MM-DD');
              } else {
                row['方钢出库日期'] = '';
              }
            }
            if (exportFields['组件出库日期']) {
              if (customer.component_outbound_date === 'RETURNED') {
                row['组件出库日期'] = '退单';
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
            if (exportFields['施工队'])
              row['施工队'] = customer.construction_team || '';
            if (exportFields['施工队电话'])
              row['施工队电话'] = customer.construction_team_phone || '';
            if (exportFields['施工状态']) {
              if (customer.construction_status && dayjs(customer.construction_status).isValid()) {
                row['施工状态'] = dayjs(customer.construction_status).format('YYYY-MM-DD');
              } else {
                row['施工状态'] = '';
              }
            }
            if (exportFields['大线'])
              row['大线'] = customer.main_line || '';
            if (exportFields['技术审核']) {
              // 技术审核特殊处理
              if (customer.technical_review_status === 'approved') {
                row['技术审核'] = customer.technical_review && dayjs(customer.technical_review).isValid() 
                  ? dayjs(customer.technical_review).format('YYYY-MM-DD HH:mm') 
                  : '已通过';
              } else if (customer.technical_review_status === 'rejected') {
                row['技术审核'] = '已拒绝';
              } else if (customer.technical_review && dayjs(customer.technical_review).isValid()) {
                row['技术审核'] = dayjs(customer.technical_review).format('YYYY-MM-DD HH:mm');
              } else {
                row['技术审核'] = '';
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
              // 建设验收简化处理
              if (customer.construction_acceptance_date && dayjs(customer.construction_acceptance_date).isValid()) {
                row['建设验收'] = dayjs(customer.construction_acceptance_date).format('YYYY-MM-DD HH:mm');
              } else {
                row['建设验收'] = '未推到';
              }
            }
            if (exportFields['挂表日期']) {
              if (customer.meter_installation_date && dayjs(customer.meter_installation_date).isValid()) {
                row['挂表日期'] = dayjs(customer.meter_installation_date).format('YYYY-MM-DD HH:mm');
              } else {
                row['挂表日期'] = '';
              }
            }
            if (exportFields['购售电合同']) {
              if (customer.power_purchase_contract && dayjs(customer.power_purchase_contract).isValid()) {
                row['购售电合同'] = dayjs(customer.power_purchase_contract).format('YYYY-MM-DD HH:mm');
              } else {
                row['购售电合同'] = '';
              }
            }
            if (exportFields['状态'])
              row['状态'] = customer.status || '';
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
            if (exportFields['最后更新']) {
              if (customer.updated_at && dayjs(customer.updated_at).isValid()) {
                row['最后更新'] = dayjs(customer.updated_at).format('YYYY-MM-DD HH:mm:ss');
              } else {
                row['最后更新'] = '';
              }
            }
            
            return row;
          });

          // 添加工作表样式
          const workbook = XLSX.utils.book_new();
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          
          // 设置列宽（自动调整为内容宽度）
          const colWidths = [];
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

          // 生成文件名（包含搜索条件）
          let fileName = `客户数据_${dayjs().format('YYYY-MM-DD_HH-mm')}`;
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
          console.error('导出数据时出错:', error);
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
        // 移除客户电话必填验证
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
          phone: row['客户电话'] || '', // 允许电话为空
          address: row['地址'] || '',
          id_card: row['身份证号'] || '',
          salesman: row['业务员'] || '',
          salesman_phone: row['业务员电话'] || '',
          filing_date: row['备案日期'] ? row['备案日期'] : null, // 直接使用原始值，不转换
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
  const EditableCell = React.memo(({ value, record, dataIndex, title, required = true }: { value: any; record: Customer; dataIndex: string; title: string; required?: boolean }) => {
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
    // 1. 值变化
    // 2. 编辑状态变化 (从查看切换到编辑，或者从编辑切换到查看)
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
          required: dataIndex !== 'salesman' && dataIndex !== 'designer' && dataIndex !== 'surveyor' && dataIndex !== 'construction_team', 
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
          filterOption={(input, option) => 
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: '100%' }}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          dropdownMatchSelectWidth={false}
          listHeight={256}
          virtual={options.length > 30}
          showArrow={true}
          notFoundContent="无匹配结果"
          {...(dataIndex === 'salesman' || dataIndex === 'designer' || dataIndex === 'surveyor' || dataIndex === 'construction_team' ? { 
            mode: "tags", 
            maxTagCount: 1,
            showSearch: true, 
            allowClear: true
          } : {})}
          onBlur={() => record.id && saveEditedCell(record.id)}
          onSelect={(value) => {
            // 处理数组情况（tags模式）
            const selectedValue = Array.isArray(value) ? value[0] : value;
            
            // 针对不同类型的字段进行不同处理
            switch(dataIndex) {
              case 'salesman':
                const salesmanPhone = options.find(o => o.value === selectedValue)?.phone || '';
                editForm.setFieldsValue({ salesman_phone: salesmanPhone });
                break;
              case 'designer':
                const designerPhone = options.find(o => o.value === selectedValue)?.phone || '';
                editForm.setFieldsValue({ designer_phone: designerPhone });
                break;
              case 'surveyor':
                const surveyorPhone = options.find(o => o.value === selectedValue)?.phone || '';
                editForm.setFieldsValue({ surveyor_phone: surveyorPhone });
                break;
              case 'construction_team':
                const teamPhone = options.find(o => o.value === selectedValue)?.phone || '';
                editForm.setFieldsValue({ construction_team_phone: teamPhone });
                break;
              case 'drawing_change':
              // 如果为空，设置为默认值
                if (value === null || value === undefined || value === '' || 
                    (Array.isArray(value) && value.length === 0)) {
                editForm.setFieldsValue({ drawing_change: '未出图' });
              }
                break;
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
          {value && (Array.isArray(value) ? value.length > 0 : true) ? (
            <span>{Array.isArray(value) ? value.join(', ') : value}</span>
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
    // 1. 值变化
    // 2. 编辑状态变化
    const valueChanged = prevProps.value !== nextProps.value;
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
      
      // 如果是数组，检查是否有任意元素是时间戳
      if (Array.isArray(val)) {
        return val.some(item => typeof item === 'string' && dayjs(item).isValid() && item.includes('T'));
      }
      
      // 字符串格式：检查是否是时间戳(ISO格式带T的字符串)
      if (typeof val === 'string') {
        return dayjs(val).isValid() && val.includes('T');
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
            // 如果是时间戳（没有选择任何选项），显示时间戳
            <Tag color="green">
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
            // 如果没有值，显示未设置
            <span style={{ color: '#999', fontStyle: 'italic' }}>未设置</span>
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
    // 1. 值变化
    // 2. 编辑状态变化
    const valueChanged = prevProps.value !== nextProps.value;
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
  }, (prevProps, nextProps) => {
    // 仅在以下情况重新渲染:
    // 1. 值变化
    // 2. 编辑状态变化
    const valueChanged = prevProps.value !== nextProps.value;
    const wasEditing = isEditing(prevProps.record, prevProps.dataIndex);
    const isEditingNow = isEditing(nextProps.record, nextProps.dataIndex);
    const editingStateChanged = wasEditing !== isEditingNow;
    
    return !(valueChanged || editingStateChanged);
  });

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
      title: (
        <TableHeaderFilter
          title="客户姓名"
          dataIndex="customer_name"
          values={Array.from(new Set(customers.map(item => item.customer_name || ''))).sort()}
          allValues={customers.map(item => item.customer_name || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
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
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选客户姓名
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
      fixed: 'left',
      width: 120,
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
      title: (
        <TableHeaderFilter
          title="客户地址"
          dataIndex="address"
          values={Array.from(new Set(customers.map(item => item.address || ''))).sort()}
          allValues={customers.map(item => item.address || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.address || '').localeCompare(b.address || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.address || '').localeCompare(a.address || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选客户地址
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.address || '')
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
      dataIndex: 'address',
      key: 'address',
      width: 200,
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
      title: (
        <TableHeaderFilter
          title="业务员"
          dataIndex="salesman"
          values={Array.from(new Set(customers.map(item => item.salesman || ''))).sort()}
          allValues={customers.map(item => item.salesman || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.salesman || '').localeCompare(b.salesman || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.salesman || '').localeCompare(a.salesman || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选业务员
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.salesman || '')
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
      dataIndex: 'salesman',
      key: 'salesman',
      width: 120,
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
      title: (
        <TableHeaderFilter
          title="设计师"
          dataIndex="designer"
          values={Array.from(new Set(customers.map(item => item.designer || ''))).sort()}
          allValues={customers.map(item => item.designer || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.designer || '').localeCompare(b.designer || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.designer || '').localeCompare(a.designer || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选设计师
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.designer || '')
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
      dataIndex: 'designer',
      key: 'designer',
      width: 120,
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
      title: (
        <TableHeaderFilter
          title="踏勘员"
          dataIndex="surveyor"
          values={Array.from(new Set(customers.map(item => item.surveyor || ''))).sort()}
          allValues={customers.map(item => item.surveyor || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.surveyor || '').localeCompare(b.surveyor || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.surveyor || '').localeCompare(a.surveyor || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选踏勘员
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.surveyor || '')
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
      dataIndex: 'surveyor',
      key: 'surveyor',
      width: 120,
      ellipsis: true,
      render: (value, record) => <SurveyorCell value={value} record={record} />
    },
    {
      title: '踏勘员电话',
      dataIndex: 'surveyor_phone',
      key: 'surveyor_phone',
      width: 150,
      ellipsis: true,
      render: (value, record) => <SurveyorPhoneCell value={value} record={record} />
    },
    {
      title: (
        <TableHeaderFilter
          title="补充资料"
          dataIndex="station_management"
          values={Array.from(new Set(customers.map(item => {
            if (Array.isArray(item.station_management)) {
              return item.station_management.join(',');
            }
            return item.station_management || '';
          }))).sort()}
          allValues={customers.map(item => {
            if (Array.isArray(item.station_management)) {
              return item.station_management.join(',');
            }
            return item.station_management || '';
          })}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const aValue = Array.isArray(a.station_management) ? a.station_management.join(',') : (a.station_management || '');
                const bValue = Array.isArray(b.station_management) ? b.station_management.join(',') : (b.station_management || '');
                return aValue.localeCompare(bValue);
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const aValue = Array.isArray(a.station_management) ? a.station_management.join(',') : (a.station_management || '');
                const bValue = Array.isArray(b.station_management) ? b.station_management.join(',') : (b.station_management || '');
                return bValue.localeCompare(aValue);
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选补充资料
            setFilteredCustomers(
              customers.filter(customer => {
                const value = Array.isArray(customer.station_management) 
                  ? customer.station_management.join(',') 
                  : (customer.station_management || '');
                return selectedValues.includes(value);
              })
            );
          }}
          onClear={() => {
            // 清除筛选
            setFilteredCustomers([...customers]);
            performSearch(searchText);
          }}
        />
      ),
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
      title: (
        <TableHeaderFilter
          title="图纸变更"
          dataIndex="drawing_change"
          values={Array.from(new Set(customers.map(item => typeof item.drawing_change === 'string' ? item.drawing_change : '未出图'))).sort()}
          allValues={customers.map(item => typeof item.drawing_change === 'string' ? item.drawing_change : '未出图')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (typeof a.drawing_change === 'string' ? a.drawing_change : '未出图')
                  .localeCompare(typeof b.drawing_change === 'string' ? b.drawing_change : '未出图')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (typeof b.drawing_change === 'string' ? b.drawing_change : '未出图')
                  .localeCompare(typeof a.drawing_change === 'string' ? a.drawing_change : '未出图')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选图纸变更
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(typeof customer.drawing_change === 'string' ? customer.drawing_change : '未出图')
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
      dataIndex: 'drawing_change',
      key: 'drawing_change',
      width: 120,
      align: 'center' as const,
      render: (value, record) => {
        // 在编辑状态下使用EditableSelectCell
        if (isEditing(record, 'drawing_change')) {
          return (
            <EditableSelectCell 
              value={value || '未出图'} 
              record={record} 
              dataIndex="drawing_change" 
              title="图纸变更" 
              options={DRAWING_CHANGE_OPTIONS}
            />
          );
        }
        
        // 获取当前选项，默认为"未出图"
        const option = DRAWING_CHANGE_OPTIONS.find(o => o.value === value) || DRAWING_CHANGE_OPTIONS[0];
        
        // 显示图纸变更选项下拉菜单
        const menu = (
          <Menu onClick={({ key }) => handleDrawingChangeClick(record.id as string, key)}>
            {DRAWING_CHANGE_OPTIONS.map(option => (
              <Menu.Item key={option.value}>
                <Tag 
                  color={option.color === 'default' ? undefined : option.color} 
                  style={{ margin: 0 }}
                >
                  {option.label}
                </Tag>
              </Menu.Item>
            ))}
          </Menu>
        );
        
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Dropdown menu={{ items: DRAWING_CHANGE_OPTIONS.map(option => ({
              key: option.value,
              label: (
                <Tag color={option.color === 'default' ? undefined : option.color}>{option.label}</Tag>
              )
            })), onClick: ({ key }) => handleDrawingChangeClick(record.id as string, key) }} trigger={['click']}>
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
      ellipsis: true,
    },
    {
      title: (
        <TableHeaderFilter
          title="催单"
          dataIndex="urge_order"
          values={Array.from(new Set(customers.map(item => item.urge_order ? dayjs(item.urge_order).format('MM-DD HH:mm') : ''))).sort()}
          allValues={customers.map(item => item.urge_order ? dayjs(item.urge_order).format('MM-DD HH:mm') : '')}
          totalRows={customers.length}
          onSort={(direction) => {
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
        if (!a.urge_order && !b.urge_order) return 0;
                if (!a.urge_order) return -1;
                if (!b.urge_order) return 1;
                return new Date(a.urge_order).getTime() - new Date(b.urge_order).getTime();
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                if (!a.urge_order && !b.urge_order) return 0;
        if (!a.urge_order) return 1;
        if (!b.urge_order) return -1;
        return new Date(b.urge_order).getTime() - new Date(a.urge_order).getTime();
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选催单日期
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.urge_order ? dayjs(customer.urge_order).format('MM-DD HH:mm') : '')
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
      dataIndex: 'urge_order',
      key: 'urge_order',
      width: 120,
      align: 'center' as const,
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
      title: (
        <TableHeaderFilter
          title="组件数量"
          dataIndex="module_count"
          values={Array.from(new Set(customers.map(item => item.module_count ? item.module_count.toString() : ''))).sort((a, b) => {
            // 数字排序
            const numA = a === '' ? 0 : parseInt(a, 10);
            const numB = b === '' ? 0 : parseInt(b, 10);
            return numA - numB;
          })}
          allValues={customers.map(item => item.module_count ? item.module_count.toString() : '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 数值排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => (a.module_count || 0) - (b.module_count || 0)));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => (b.module_count || 0) - (a.module_count || 0)));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选组件数量
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.module_count ? customer.module_count.toString() : '')
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
      dataIndex: 'module_count',
      key: 'module_count',
      width: 120,
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="module_count" title="组件数量" required={false} />
    },
    {
      title: (
        <TableHeaderFilter
          title="容量"
          dataIndex="capacity"
          values={Array.from(new Set(customers.map(item => item.capacity ? item.capacity.toString() : ''))).sort((a, b) => {
            // 数字排序
            const numA = a === '' ? 0 : parseFloat(a);
            const numB = b === '' ? 0 : parseFloat(b);
            return numA - numB;
          })}
          allValues={customers.map(item => item.capacity ? item.capacity.toString() : '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 数值排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => (a.capacity || 0) - (b.capacity || 0)));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => (b.capacity || 0) - (a.capacity || 0)));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选容量
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.capacity ? customer.capacity.toString() : '')
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
      dataIndex: 'capacity',
      key: 'capacity',
      render: (text) => text ? `${text} KW` : '-',
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
      title: (
        <TableHeaderFilter 
          title="逆变器"
          dataIndex="inverter"
          values={Array.from(new Set(customers.map(item => item.inverter || ''))).sort()}
          allValues={customers.map(item => item.inverter || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.inverter || '').localeCompare(b.inverter || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.inverter || '').localeCompare(a.inverter || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选逆变器
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.inverter || '')
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
      dataIndex: 'inverter',
      key: 'inverter',
      width: 120,
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
      title: (
        <TableHeaderFilter 
          title="铜线"
          dataIndex="copper_wire"
          values={Array.from(new Set(customers.map(item => item.copper_wire || ''))).sort()}
          allValues={customers.map(item => item.copper_wire || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.copper_wire || '').localeCompare(b.copper_wire || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.copper_wire || '').localeCompare(a.copper_wire || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选铜线
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.copper_wire || '')
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
      }
    },
    {
      title: (
        <TableHeaderFilter 
          title="铝线"
          dataIndex="aluminum_wire"
          values={Array.from(new Set(customers.map(item => item.aluminum_wire || ''))).sort()}
          allValues={customers.map(item => item.aluminum_wire || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.aluminum_wire || '').localeCompare(b.aluminum_wire || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.aluminum_wire || '').localeCompare(a.aluminum_wire || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选铝线
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.aluminum_wire || '')
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
      }
    },
    {
      title: (
        <TableHeaderFilter 
          title="配电箱"
          dataIndex="distribution_box"
          values={Array.from(new Set(customers.map(item => item.distribution_box || ''))).sort()}
          allValues={customers.map(item => item.distribution_box || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.distribution_box || '').localeCompare(b.distribution_box || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.distribution_box || '').localeCompare(a.distribution_box || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选配电箱
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.distribution_box || '')
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
      }
    },
    {
      title: (
        <TableHeaderFilter
          title="方钢出库"
          dataIndex="square_steel_status"
          values={Array.from(new Set(customers.map(item => {
            if (item.square_steel_outbound_date && item.square_steel_inbound_date) {
              return '已回库';
            } else if (item.square_steel_outbound_date) {
              return '已出库';
            } else {
              return '未出库';
            }
          }))).sort()}
          allValues={customers.map(item => {
            if (item.square_steel_outbound_date && item.square_steel_inbound_date) {
              return '已回库';
            } else if (item.square_steel_outbound_date) {
              return '已出库';
            } else {
              return '未出库';
            }
          })}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const aStatus = getSquareSteelStatus(a);
                const bStatus = getSquareSteelStatus(b);
                return aStatus.localeCompare(bStatus);
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const aStatus = getSquareSteelStatus(a);
                const bStatus = getSquareSteelStatus(b);
                return bStatus.localeCompare(aStatus);
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选方钢状态
            setFilteredCustomers(
              customers.filter(customer => {
                const status = getSquareSteelStatus(customer);
                return selectedValues.includes(status);
              })
            );
          }}
          onClear={() => {
            // 清除筛选
            setFilteredCustomers([...customers]);
            performSearch(searchText);
          }}
        />
      ),
      dataIndex: 'square_steel_status',
      key: 'square_steel_status',
      width: 100,
      align: 'center' as const,
      render: (_, record: Customer) => {
        // 判断方钢和组件的出库状态 - 实现新需求逻辑
        // 1. 如果方钢出库日期和回库日期都有数据，显示回库状态
        // 2. 如果只有出库日期有数据，显示出库状态  
        // 3. 如果出库日期和回库日期都为空，显示按钮状态
        
        if (record.square_steel_outbound_date && record.square_steel_inbound_date) {
          // 回库状态 - 显示回库标签和时间戳
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
          // 出库状态 - 显示出库时间戳
          const outboundDate = dayjs(record.square_steel_outbound_date).format('YYYY-MM-DD');
          
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
    },
    {
      title: (
        <TableHeaderFilter
          title="组件出库"
          dataIndex="component_status"
          values={Array.from(new Set(customers.map(item => getComponentStatus(item)))).sort()}
          allValues={customers.map(item => getComponentStatus(item))}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const aStatus = getComponentStatus(a);
                const bStatus = getComponentStatus(b);
                return aStatus.localeCompare(bStatus);
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const aStatus = getComponentStatus(a);
                const bStatus = getComponentStatus(b);
                return bStatus.localeCompare(aStatus);
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选组件状态
            setFilteredCustomers(
              customers.filter(customer => {
                const status = getComponentStatus(customer);
                return selectedValues.includes(status);
              })
            );
          }}
          onClear={() => {
            // 清除筛选
            setFilteredCustomers([...customers]);
            performSearch(searchText);
          }}
        />
      ),
      dataIndex: 'component_status',
      key: 'component_status',
      width: 100,
      align: 'center' as const,
      render: (_, record: Customer) => {
        // 判断组件的出库状态 - 实现新需求逻辑
        // 1. 如果组件出库日期和回库日期都有数据，显示回库状态
        // 2. 如果只有出库日期有数据，显示出库状态  
        // 3. 如果出库日期和回库日期都为空，显示按钮状态
        
        if (record.component_outbound_date && record.component_inbound_date) {
          // 回库状态 - 显示回库标签和时间戳
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
          // 出库状态 - 显示出库时间戳
          const outboundDate = dayjs(record.component_outbound_date).format('YYYY-MM-DD');
          
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
      title: (
        <TableHeaderFilter
          title="施工队"
          dataIndex="construction_team"
          values={Array.from(new Set(customers.map(item => item.construction_team || ''))).sort()}
          allValues={customers.map(item => item.construction_team || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.construction_team || '').localeCompare(b.construction_team || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.construction_team || '').localeCompare(a.construction_team || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选施工队
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.construction_team || '')
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
      dataIndex: 'construction_team',
      key: 'construction_team',
      ellipsis: true,
      render: (value, record) => {
        console.log('渲染施工队字段:', record.id, value);
        return <ConstructionTeamCell 
          value={value} 
          record={record}
          onChange={(newValue) => {
            // 当施工队字段变更时，同步处理派工日期
            if (!newValue || newValue.trim() === '') {
              // 如果施工队清空，也清空派工日期
              customerApi.update(record.id, { 
                construction_team: newValue,
                dispatch_date: null 
              });
              console.log('施工队清空，派工日期设置为null');
            } else if (!record.construction_team && newValue) {
              // 如果施工队从无到有，设置派工日期为当前日期
              const currentDate = new Date().toISOString().split('T')[0];
              customerApi.update(record.id, { 
                construction_team: newValue,
                dispatch_date: currentDate
              });
              console.log('施工队从无到有，派工日期设置为当前日期:', currentDate);
            } else {
              // 仅更新施工队
              customerApi.update(record.id, { construction_team: newValue });
              console.log('仅更新施工队值:', newValue);
            }
          }}
        />;
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
      title: (
        <TableHeaderFilter
          title="施工状态"
          dataIndex="construction_status"
          values={Array.from(new Set(customers.map(item => 
            item.construction_status ? '已完工' : '未完工'
          ))).sort()}
          allValues={customers.map(item => 
            item.construction_status ? '已完工' : '未完工'
          )}
          totalRows={customers.length}
          onSort={(direction) => {
            // 处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                // 未完工排在前面，已完工排在后面
                const aStatus = a.construction_status ? 1 : 0;
                const bStatus = b.construction_status ? 1 : 0;
                return aStatus - bStatus;
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                // 已完工排在前面，未完工排在后面
                const aStatus = a.construction_status ? 1 : 0;
                const bStatus = b.construction_status ? 1 : 0;
                return bStatus - aStatus;
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选施工状态
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.construction_status ? '已完工' : '未完工')
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
      dataIndex: 'construction_status',
      key: 'construction_status',
      width: 130,
      align: 'center' as const,
      render: (_, record: Customer) => {
        // 如果有施工状态（已完工）
        if (record.construction_status) {
          // 只有管理员可以将已完工恢复为未完工
          const canReset = userRole === 'admin';
          
          return (
            <Tag 
              color="green" 
              style={{ cursor: canReset ? 'pointer' : 'default' }}
              onClick={() => canReset && record.id && handleConstructionStatusChange(record.id, record.construction_status)}
            >
              <ClockCircleOutlined /> {dayjs(record.construction_status).format('YYYY-MM-DD HH:mm')}
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
      ellipsis: true,
    },
    {
      title: (
        <TableHeaderFilter
          title="大线"
          dataIndex="main_line"
          values={Array.from(new Set(customers.map(item => item.main_line || ''))).sort()}
          allValues={customers.map(item => item.main_line || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.main_line || '').localeCompare(b.main_line || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.main_line || '').localeCompare(a.main_line || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选大线
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.main_line || '')
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
      dataIndex: 'main_line',
      key: 'main_line',
      width: 120,
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="main_line" title="大线" required={false} />
    },
    {
      title: (
        <TableHeaderFilter
          title="技术审核"
          dataIndex="technical_review_status"
          values={Array.from(new Set(customers.map(item => {
            if (item.technical_review_status === 'approved') return '审核通过';
            if (item.technical_review_status === 'rejected') return '技术驳回';
            return '待审核';
          }))).sort()}
          allValues={customers.map(item => {
            if (item.technical_review_status === 'approved') return '审核通过';
            if (item.technical_review_status === 'rejected') return '技术驳回';
            return '待审核';
          })}
          totalRows={customers.length}
          onSort={(direction) => {
            // 处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const statusOrder = {'approved': 2, 'rejected': 1, null: 0, undefined: 0};
                const aStatus = statusOrder[a.technical_review_status] || 0;
                const bStatus = statusOrder[b.technical_review_status] || 0;
                return aStatus - bStatus;
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const statusOrder = {'approved': 2, 'rejected': 1, null: 0, undefined: 0};
                const aStatus = statusOrder[a.technical_review_status] || 0;
                const bStatus = statusOrder[b.technical_review_status] || 0;
                return bStatus - aStatus;
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选技术审核状态
            setFilteredCustomers(
              customers.filter(customer => {
                const status = customer.technical_review_status === 'approved' ? '审核通过' : 
                               customer.technical_review_status === 'rejected' ? '技术驳回' : 
                               '待审核';
                return selectedValues.includes(status);
              })
            );
          }}
          onClear={() => {
            // 清除筛选
            setFilteredCustomers([...customers]);
            performSearch(searchText);
          }}
        />
      ),
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
              console.warn(`无效的技术审核日期: ${record.technical_review_date}`);
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
        } else if (text === 'rejected') {
          // 如果被驳回
          let rejectionTime = '未知时间';
          
          try {
            if (record.technical_review_date && dayjs(record.technical_review_date).isValid()) {
              rejectionTime = dayjs(record.technical_review_date).format('YYYY-MM-DD HH:mm');
            }
          } catch (error) {
            console.error('驳回日期格式化错误:', error);
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
      ellipsis: true,
    },
    {
      title: (
        <TableHeaderFilter
          title="上传国网"
          dataIndex="upload_to_grid"
          values={Array.from(new Set(customers.map(item => 
            item.upload_to_grid ? '已上传' : '未上传'
          ))).sort()}
          allValues={customers.map(item => 
            item.upload_to_grid ? '已上传' : '未上传'
          )}
          totalRows={customers.length}
          onSort={(direction) => {
            // 处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                // 未上传排在前面，已上传排在后面
                const aStatus = a.upload_to_grid ? 1 : 0;
                const bStatus = b.upload_to_grid ? 1 : 0;
                return aStatus - bStatus;
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                // 已上传排在前面，未上传排在后面
                const aStatus = a.upload_to_grid ? 1 : 0;
                const bStatus = b.upload_to_grid ? 1 : 0;
                return bStatus - aStatus;
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选上传国网状态
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.upload_to_grid ? '已上传' : '未上传')
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
      ellipsis: true,
    },
    {
      title: (
        <TableHeaderFilter
          title="建设验收"
          dataIndex="construction_acceptance_date"
          values={Array.from(new Set(customers.map(item => 
            item.construction_acceptance_date ? '已推到' : '未推到'
          ))).sort()}
          allValues={customers.map(item => 
            item.construction_acceptance_date ? '已推到' : '未推到'
          )}
          totalRows={customers.length}
          onSort={(direction) => {
            // 处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                // 未推到排在前面，已推到排在后面
                const aStatus = a.construction_acceptance_date ? 1 : 0;
                const bStatus = b.construction_acceptance_date ? 1 : 0;
                return aStatus - bStatus;
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                // 已推到排在前面，未推到排在后面
                const aStatus = a.construction_acceptance_date ? 1 : 0;
                const bStatus = b.construction_acceptance_date ? 1 : 0;
                return bStatus - aStatus;
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选建设验收状态
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.construction_acceptance_date ? '已推到' : '未推到')
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
      dataIndex: 'construction_acceptance_date',
      key: 'construction_acceptance_date',
      width: 130,
      align: 'center' as const,
      render: (text, record) => {
        // 如果已验收（有时间戳）
        if (text) {
          return (
            <Tooltip title='点击恢复为未推到状态'>
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
          // 未验收状态（未推到），显示按钮
          return (
            <Button 
              type="primary" 
              size="small"
              danger
              ghost
              onClick={() => record.id && handleConstructionAcceptanceChange(record.id, null)}
            >
              未推到
            </Button>
          );
        }
      },
      ellipsis: true,
    },
    {
      title: (
        <TableHeaderFilter
          title="挂表日期"
          dataIndex="meter_installation_date"
          values={Array.from(new Set(customers.map(item => 
            item.meter_installation_date ? '已挂表' : '未挂表'
          ))).sort()}
          allValues={customers.map(item => 
            item.meter_installation_date ? '已挂表' : '未挂表'
          )}
          totalRows={customers.length}
          onSort={(direction) => {
            // 处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                // 未挂表排在前面，已挂表排在后面
                const aStatus = a.meter_installation_date ? 1 : 0;
                const bStatus = b.meter_installation_date ? 1 : 0;
                return aStatus - bStatus;
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                // 已挂表排在前面，未挂表排在后面
                const aStatus = a.meter_installation_date ? 1 : 0;
                const bStatus = b.meter_installation_date ? 1 : 0;
                return bStatus - aStatus;
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选挂表状态
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.meter_installation_date ? '已挂表' : '未挂表')
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
      ellipsis: true,
    },
    {
      title: (
        <TableHeaderFilter
          title="购售电合同"
          dataIndex="power_purchase_contract"
          values={Array.from(new Set(customers.map(item => 
            item.power_purchase_contract ? '已出合同' : '待出'
          ))).sort()}
          allValues={customers.map(item => 
            item.power_purchase_contract ? '已出合同' : '待出'
          )}
          totalRows={customers.length}
          onSort={(direction) => {
            // 处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                // 待出排在前面，已出合同排在后面
                const aStatus = a.power_purchase_contract ? 1 : 0;
                const bStatus = b.power_purchase_contract ? 1 : 0;
                return aStatus - bStatus;
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                // 已出合同排在前面，待出排在后面
                const aStatus = a.power_purchase_contract ? 1 : 0;
                const bStatus = b.power_purchase_contract ? 1 : 0;
                return bStatus - aStatus;
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选购售电合同状态
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.power_purchase_contract ? '已出合同' : '待出')
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
      ellipsis: true,
    },
    {
      title: (
        <TableHeaderFilter
          title="状态"
          dataIndex="status"
          values={Array.from(new Set(customers.map(item => 
            item.status || '待处理'
          ))).sort()}
          allValues={customers.map(item => 
            item.status || '待处理'
          )}
          totalRows={customers.length}
          onSort={(direction) => {
            // 处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const statusOrder = {'已完成': 4, '商务驳回': 3, '技术驳回': 2, '提交资料': 1, '待处理': 0};
                const aStatus = statusOrder[a.status || '待处理'] || 0;
                const bStatus = statusOrder[b.status || '待处理'] || 0;
                return aStatus - bStatus;
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const statusOrder = {'已完成': 4, '商务驳回': 3, '技术驳回': 2, '提交资料': 1, '待处理': 0};
                const aStatus = statusOrder[a.status || '待处理'] || 0;
                const bStatus = statusOrder[b.status || '待处理'] || 0;
                return bStatus - aStatus;
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选状态
            setFilteredCustomers(
              customers.filter(customer => {
                const status = customer.status || '待处理';
                return selectedValues.includes(status);
              })
            );
          }}
          onClear={() => {
            // 清除筛选
            setFilteredCustomers([...customers]);
            performSearch(searchText);
          }}
        />
      ),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value, record) => {
        if (value === "已完成") {
          return <Tag color="success">{value}</Tag>;
        } else if (value === "技术驳回" || value === "商务驳回") {
          return <Tag color="error">{value}</Tag>;
        } else if (value === "提交资料") {
          return <Tag color="processing">{value}</Tag>;
        } else {
          return (
            <Button
              type="text" 
              className="status-button"
              size="small"
              onClick={() => record.id && showStatusOptions(record.id, '待处理')}
            >
              待处理
            </Button>
          );
        }
      },
      // filters和onFilter属性已删除
    },
    {
      title: (
        <TableHeaderFilter
          title="价格"
          dataIndex="price"
          values={Array.from(new Set(customers.map(item => item.price != null ? String(item.price) : ''))).sort()}
          allValues={customers.map(item => item.price != null ? String(item.price) : '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const aVal = a.price != null ? Number(a.price) : 0;
                const bVal = b.price != null ? Number(b.price) : 0;
                return aVal - bVal;
              }));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => {
                const aVal = a.price != null ? Number(a.price) : 0;
                const bVal = b.price != null ? Number(b.price) : 0;
                return bVal - aVal;
              }));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选价格
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.price != null ? String(customer.price) : '')
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
      dataIndex: 'price',
      key: 'price',
      width: 120,
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="price" title="价格" required={false} />,
    },
    {
      title: (
        <TableHeaderFilter
          title="公司"
          dataIndex="company"
          values={Array.from(new Set(customers.map(item => item.company || ''))).sort()}
          allValues={customers.map(item => item.company || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.company || '').localeCompare(b.company || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.company || '').localeCompare(a.company || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选公司
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.company || '')
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
      ellipsis: true,
    },
    {
      title: (
        <TableHeaderFilter
          title="备注"
          dataIndex="remarks"
          values={Array.from(new Set(customers.map(item => item.remarks || ''))).sort()}
          allValues={customers.map(item => item.remarks || '')}
          totalRows={customers.length}
          onSort={(direction) => {
            // 在这里处理排序逻辑
            if (direction === 'ascend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (a.remarks || '').localeCompare(b.remarks || '')
              ));
            } else if (direction === 'descend') {
              setFilteredCustomers([...filteredCustomers].sort((a, b) => 
                (b.remarks || '').localeCompare(a.remarks || '')
              ));
            } else {
              // 重置排序
              setFilteredCustomers([...customers]);
              performSearch(searchText);
            }
          }}
          onFilter={(selectedValues) => {
            if (selectedValues.length === 0) {
              // 重置筛选
              setFilteredCustomers([...customers]);
              performSearch(searchText);
              return;
            }
            
            // 筛选备注
            setFilteredCustomers(
              customers.filter(customer => 
                selectedValues.includes(customer.remarks || '')
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
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      render: (value, record) => <EditableCell value={value} record={record} dataIndex="remarks" title="备注" required={false} />,
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
            onClick={(e) => {
              e.stopPropagation();
              edit(record, 'construction_team_phone');
            }}
            style={{ padding: '0 4px' }}
            title="编辑施工队电话"
          />
        )}
      </div>
    );
  };

  // 创建施工队可编辑单元格
  const ConstructionTeamCell = ({ 
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
          placeholder="请选择施工队"
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={constructionTeamOptions}
          mode="tags"
          maxTagCount={1}
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
            console.log('选择施工队:', value, option);
            // 如果选择了施工队，自动填充电话
            if (value) {
              // 处理数组情况（tags模式）
              const selectedValue = Array.isArray(value) && value.length > 0 ? value[0] : value;
              
              if (Array.isArray(option) && option.length > 0 && typeof option[0] === 'object' && 'phone' in option[0]) {
                // 从option数组中获取电话
                editForm.setFieldsValue({ construction_team_phone: option[0].phone });
              } else {
                // 尝试从施工队列表中找到匹配的电话
                const teamInfo = constructionTeams.find(t => t.name === selectedValue);
                if (teamInfo && teamInfo.phone) {
                  editForm.setFieldsValue({ construction_team_phone: teamInfo.phone });
                }
              }
            } else if (!value || (Array.isArray(value) && value.length === 0)) {
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
        
        updateObj = {
          technical_review_status: 'approved', // 使用枚举值
          technical_review_date: now.toISOString(),
          technical_review_notes: '已通过技术审核'
        };
      } else if (status === 'rejected') {
        const now = dayjs();
        
        updateObj = {
          technical_review_status: 'rejected', // 使用枚举值
          technical_review_date: now.toISOString(),
          technical_review_notes: '技术审核不通过'
        };
      } else {
        // 重置状态
        updateObj = {
          technical_review_status: 'pending', // 使用枚举值
          technical_review_date: null,
          technical_review_notes: null
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

  // 处理建设验收状态变更 - 简化版本，使用安全API
  const handleConstructionAcceptanceChange = async (id: string | undefined, currentDate: string | null) => {
    if (!id) {
      message.error('客户ID无效');
      return;
    }
    
    try {
      // 切换建设验收状态，当前有值则清空，无值则设置为当前日期
      const updateObj: Record<string, any> = {
        construction_acceptance_date: currentDate ? null : new Date().toISOString()
      };
      
      console.log(`[建设验收] 更新客户(${id})的建设验收状态，${currentDate ? '恢复为未推到状态' : '设置为已推到状态'}`);
      
      // 使用数据缓存服务更新数据，UI立即响应
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状态
      setCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      setFilteredCustomers(prev => 
        prev.map(c => (c.id === id ? { ...c, ...updatedCustomer } : c))
      );
      
      // 显示成功消息
      const successMsg = currentDate ? '已恢复为未推到状态' : '已标记为已推到';
      message.success(successMsg);
    } catch (error) {
      console.error('[建设验收] 操作过程出错:', error);
      
      if (error instanceof Error) {
        message.error(`更新失败: ${error.message}`);
      } else {
      message.error('操作失败，请重试');
    }
      
      // 失败时重新获取数据
      fetchCustomers();
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
      // 如果当前有状态（已出合同），则恢复为待出状态
      // 如果当前没有状态（待出），则标记为已出合同
      const updateObj = {
        power_purchase_contract: currentStatus ? null : new Date().toISOString()
      };
      
      console.log(`[购售电合同] 更新客户(${id})的购售电合同状态，采用缓存+异步模式`);
      
      // 获取客户当前数据，确保不会影响其他字段
      const currentCustomer = customers.find(c => c.id === id);
      if (!currentCustomer) {
        throw new Error('找不到客户信息');
      }
      
      // 使用数据缓存服务更新数据，UI立即响应
      const updatedCustomer = customerApi.updateWithCache(id, updateObj);
      
      // 更新本地状态 - 只更新power_purchase_contract字段，保留其他字段不变
      setCustomers(prev => 
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
      
      message.success(currentStatus ? '已恢复为待出状态' : '已标记为已出合同');
    } catch (error) {
      console.error('[购售电合同] 更新状态失败:', error);
      message.error('操作失败，请重试');
      
      // 失败时重新获取数据
      fetchCustomers();
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
          loading={loading && pageSize === 100}
        >
          100条/页
        </Button>
        <Button 
          size="small"
          type={pageSize === 500 ? "primary" : "default"}
          onClick={() => handlePageSizeChange(500)}
          loading={loading && pageSize === 500}
        >
          500条/页
        </Button>
        <Button 
          size="small"
          type={pageSize === 1000 ? "primary" : "default"}
          onClick={() => handlePageSizeChange(1000)}
          loading={loading && pageSize === 1000}
        >
          1000条/页
        </Button>
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
        <div style={{ marginLeft: 16 }}>
          显示 {filteredCustomers.length} 条记录，共 {filteredCustomers.length} 条
        </div>
      </Space>
      <Space>
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
    
    console.log('渲染踏勘员单元格:', value, '可用踏勘员选项:', surveyorOptions);
    
    return editable ? (
      <Form.Item
        name="surveyor"
        style={{ margin: 0 }}
        initialValue={value}
      >
        <Select
          placeholder="请选择踏勘员"
          autoFocus
          allowClear
          showSearch
          optionFilterProp="label"
          options={surveyorOptions}
          mode="tags"
          maxTagCount={1}
          onBlur={() => record.id ? saveEditedCell(record.id) : undefined}
          onChange={(value, option) => {
            console.log('选择踏勘员:', value, option);
            // 如果选择了踏勘员，自动填充电话
            if (value) {
              // 处理数组情况（tags模式）
              const selectedValue = Array.isArray(value) && value.length > 0 ? value[0] : value;
              
              if (Array.isArray(option) && option.length > 0 && typeof option[0] === 'object' && 'phone' in option[0]) {
                // 从option数组中获取电话
                editForm.setFieldsValue({ surveyor_phone: option[0].phone });
              } else {
                // 尝试从踏勘员列表中找到匹配的电话
                const surveyorInfo = surveyors.find(s => s.name === selectedValue);
                if (surveyorInfo && surveyorInfo.phone) {
                  editForm.setFieldsValue({ surveyor_phone: surveyorInfo.phone });
                }
              }
            } else if (!value || (Array.isArray(value) && value.length === 0)) {
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
          placeholder="踏勘员电话" 
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
    // 如果正在切换到相同大小，直接返回
    if (size === pageSize) return;
    
    // 立即清除搜索状态，重置UI
    setIsSearching(false);
    
    // 从大页面切换到小页面时的特殊处理
    if ((pageSize === 500 || pageSize === 1000) && size === 100) {
      // 立即更新UI相关状态
    setPageSize(size);
      setCurrentPage(1);
      setIsBackgroundLoading(true);
      
      // 使用一个最小数据集先渲染界面
      const minimalDataset = filteredCustomers.slice(0, size);
      const minimalCache = { 1: minimalDataset };
      setCachedPageData(minimalCache);
      
      // 重新计算总页数
      const newTotalPages = Math.ceil(filteredCustomers.length / size);
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
    
    // 立即更新页面大小，这样UI会立即响应
    setPageSize(size);
    setCurrentPage(1);
    setIsBackgroundLoading(true);
    
    // 使用requestAnimationFrame确保UI先更新
    requestAnimationFrame(() => {
      // 使用Web Worker或setTimeout优化大数据处理
      if (size >= 500 && filteredCustomers.length > 1000) {
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
            console.error('Web Worker处理失败，回退到同步处理:', error);
            handleSyncCaching();
          }
        } else {
          // 没有Web Worker支持，使用异步处理
          handleSyncCaching();
        }
      } else {
        // 对于较小的数据集，直接处理
        handleSyncCaching();
      }
    });
    
    // 同步处理缓存的辅助函数
    function handleSyncCaching() {
      // 更新总页数
      const newTotalPages = Math.ceil(filteredCustomers.length / size);
      setTotalPages(newTotalPages);
      
      // 为提高性能，仅先缓存当前页和下一页
      const tempCache: {[key: number]: Customer[]} = {};
      
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
            
            // 如果还有更多页面，继续处理下一批
            if (endPage < newTotalPages) {
              // 更新当前已处理的缓存
              setCachedPageData({...fullCache});
              
              // 在下一帧处理下一批
              setTimeout(() => {
                processBatch(endPage + 1, endPage + 3, fullCache);
              }, 50);
            } else {
              // 所有页面都已缓存完成
              setCachedPageData({...fullCache});
              
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
    
    // 完成数据处理的辅助函数
    function finishDataProcessing(size: number, totalPages: number) {
      // 重置缓存，释放内存
      setCachedPageData({});
      
      // 只缓存第一页数据
      const newCache: {[key: number]: Customer[]} = {
        1: filteredCustomers.slice(0, size)
      };
      
      // 如果有第二页，也预加载
      if (totalPages > 1) {
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
  
  // 修改为普通分页函数
  const getPagedCustomers = () => {
    // 尝试从缓存获取当前页数据
    if (cachedPageData[currentPage]) {
      return cachedPageData[currentPage];
    }
    
    // 如果缓存中没有，则计算当前页的数据
    const pageStartIndex = (currentPage - 1) * pageSize;
    const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredCustomers.length);
    
    // 返回当前页的数据
    return filteredCustomers.slice(pageStartIndex, pageEndIndex);
  };

  // 虚拟滚动优化函数用于大数据量分页
  const getVirtualCustomers = () => {
    // 在分页小于500时，使用普通分页方式
    if (pageSize < 500) {
      return getPagedCustomers();
    }
    
    // 大页面模式下，首次加载可以直接使用预渲染数据
    if (preRenderedData.length > 0 && pageSize !== previousPageSize) {
      // 清除预渲染数据，只使用一次
      setTimeout(() => setPreRenderedData([]), 0);
      return preRenderedData;
    }
    
    // 获取所有数据，不使用虚拟滚动
    // 返回全部当前页数据，不做任何裁剪
    return getPagedCustomers();
  };

  // 更新计算当前页显示的数据函数
  const paginatedCustomers = useMemo(() => {
    // 如果正在编辑，避免重新计算以提高性能
    if (editingRef.current) {
      return getPagedCustomers();
    }
    
    // 大页面模式使用虚拟滚动
    if (pageSize >= 500) {
      return getVirtualCustomers();
    }
    
    // 普通模式使用标准分页
    return getPagedCustomers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCustomers, currentPage, pageSize, editingCell, preRenderedData, forceUpdate]);

  // 监听表格滚动以支持虚拟滚动
  useEffect(() => {
    // 仅在大页面模式下启用
    if (pageSize < 500) return;
    
    const handleScroll = () => {
      // 如果正在编辑，不要触发重新渲染
      if (editingRef.current) return;
      
      // 防抖处理滚动事件
      if (window.scrollTimer) {
        clearTimeout(window.scrollTimer);
      }
      
      window.scrollTimer = setTimeout(() => {
        // 手动触发重新渲染以更新虚拟列表
        setFilteredCustomers([...filteredCustomers]);
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

  // 修改handleSearch函数，用于按钮点击和Enter键触发搜索
  const handleSearch = useCallback((value: string) => {
    setIsSearching(true); // 设置搜索中状态
    setCurrentPage(1); // 搜索时重置到第一页
    
    // 使用requestAnimationFrame延迟搜索执行，减少UI阻塞
    requestAnimationFrame(() => {
      // 执行搜索操作
      performSearch(value);
      
      // 在搜索结果为空时，仅显示一次提示消息
      if (value.trim().length > 0 && filteredCustomers.length === 0 && customers.length > 0) {
        message.info(`未找到匹配"${value}"的客户记录`);
      }
      
      setIsSearching(false); // 搜索完成
    });
  }, [customers, performSearch, filteredCustomers]);

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
        drawing_change: newValue || '未出图'
      };
      
      // 使用updateWithCache方法异步更新，绕过类型检查
      await customerApi.updateWithCache(recordId, updateData);
      
      // 本地更新状态，使用类型断言
      setCustomers(prev => 
        prev.map(customer => {
          if (customer.id === recordId) {
            const updatedCustomer = { ...customer } as any;
            updatedCustomer.drawing_change = newValue || '未出图';
            return updatedCustomer;
          }
          return customer;
        })
      );
      
      setFilteredCustomers(prev => 
        prev.map(customer => {
          if (customer.id === recordId) {
            const updatedCustomer = { ...customer } as any;
            updatedCustomer.drawing_change = newValue || '未出图';
            return updatedCustomer;
          }
          return customer;
        })
      );
      
      // 显示操作结果
      message.success(`图纸变更状态已更新为"${newValue || '未出图'}"`);
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
          mode="tags"
          maxTagCount={1}
          onBlur={() => record.id ? saveEditedCell(record.id) : undefined}
          onChange={(value, option) => {
            // 如果选择了设计师，自动填充电话
            if (value) {
              // 处理数组情况（tags模式）
              const selectedValue = Array.isArray(value) && value.length > 0 ? value[0] : value;
              
              if (Array.isArray(option) && option.length > 0 && typeof option[0] === 'object' && 'phone' in option[0]) {
                // 从option数组中获取电话
                editForm.setFieldsValue({ designer_phone: option[0].phone });
              } else {
                // 尝试从设计师列表中找到匹配的电话
                const designerInfo = designers.find(d => d.name === selectedValue);
                if (designerInfo && designerInfo.phone) {
                  editForm.setFieldsValue({ designer_phone: designerInfo.phone });
                }
              }
            } else if (!value || (Array.isArray(value) && value.length === 0)) {
              // 如果清空了设计师，也清空设计师电话
              editForm.setFieldsValue({ designer_phone: '' });
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
          placeholder="设计师电话" 
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
            title="编辑设计师电话"
          />
        )}
      </div>
    );
  };

  // 预填充页面缓存
  const populatePageCache = (data: Customer[], size: number) => {
    const newCache: {[key: number]: Customer[]} = {};
    
    const pages = Math.ceil(data.length / size);
    for (let page = 1; page <= pages; page++) {
      const startIndex = (page - 1) * size;
      const endIndex = Math.min(startIndex + size, data.length);
      newCache[page] = data.slice(startIndex, endIndex);
    }
    
    setCachedPageData(newCache);
  };

  // 使用useCallback优化setSearchFields，避免不必要的重新渲染
  const handleSearchFieldsChange = useCallback((newFields: {[key: string]: boolean}) => {
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
    // 使用本地状态，不会触发父组件重新渲染
    const [localFields, setLocalFields] = useState<{[key: string]: boolean}>(() => ({...searchFields}));
    
    // 使用useEffect同步searchFields到localFields，仅在Modal打开时
    useEffect(() => {
      if (advancedSearchVisible) {
        setLocalFields({...searchFields});
      }
    }, [advancedSearchVisible]);
    
    // 单个字段状态变更，只更新本地状态
    const handleFieldChange = (field: string, checked: boolean) => {
      setLocalFields(prev => ({...prev, [field]: checked}));
    };
    
    // 计算选中的字段数
    const selectedCount = Object.values(localFields).filter(Boolean).length;
    
    // 确认按钮处理函数
    const onOk = () => {
      // 仅在确认时更新父组件状态，避免中间状态引起不必要的渲染
      setSearchFields(localFields);
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
          <p>请选择要搜索的字段：</p>
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
            <p>当前搜索内容：{searchText || '(无)'}</p>
            <p>当前将在{selectedCount}个字段中进行搜索</p>
          </div>
        </div>
      </Modal>
    );
  };

  // 在组件顶部添加搜索状态
  const [isSearching, setIsSearching] = useState(false);

  return (
    <div className="customer-list-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderDateFilters()}
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
            onChange={(_, __, sorter) => {
              // 处理排序被禁用
            }}
            // 为所有页面添加垂直滚动配置
            scroll={{ y: 'calc(100vh - 280px)', x: 'max-content' }}
            // 大页码时启用虚拟滚动优化
            virtual={pageSize >= 500}
            rowClassName={(record, index) => {
              // 使用奇偶行样式，提高渲染性能
              const baseClass = index % 2 === 0 ? 'table-row-light' : 'table-row-dark';
              // 如果是编辑状态添加编辑样式
              const editingClass = editingCell && editingCell.id === record.id ? 'editing-row' : '';
              return `${baseClass} ${editingClass}`.trim();
            }}
            components={{
              body: {
                // 使用虚拟滚动时保持渲染的行不变
                row: React.memo((props: any) => <tr {...props} />, 
                  (prev, next) => {
                    // 只在编辑状态变化或数据变化时重新渲染行
                    const prevRecord = prev.children[0]?.props?.record;
                    const nextRecord = next.children[0]?.props?.record;
                    if (!prevRecord || !nextRecord) return false;
                    
                    // 检查ID是否相同
                    if (prevRecord.id !== nextRecord.id) return false;
                    
                    // 检查是否在编辑这一行
                    const isEditingRow = editingCell && editingCell.id === prevRecord.id;
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
              padding: 8px 12px; /* 减小表头内边距 */
              font-weight: bold;
              white-space: nowrap;
              background-color: #f0f5ff;
              text-align: center;
            }
            
            /* 奇偶行样式，避免悬停时重绘整行 */
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
              will-change: transform; /* 启用GPU加速 */
              overflow-anchor: none; /* 禁用浏览器的滚动锚定优化 */
              transform: translateZ(0); /* 强制GPU加速 */
              backface-visibility: hidden; /* 提高渲染性能 */
              perspective: 1000; /* 提高渲染性能 */
              contain: strict; /* 限制渲染区域 */
            }
            
            .customer-table .ant-table-row:not(:hover) {
              contain: layout style paint; /* 限制布局和样式计算范围 */
            }
            
            .customer-table .ant-table-tbody .ant-table-row {
              transition: none !important; /* 禁用行hover的过渡效果 */
              contain: layout style; /* 隔离布局和样式 */
            }
            
            /* 大数据量模式下减少不必要的渲染 */
            .customer-table.large-mode .ant-table-row:not(.ant-table-row-hover):not(.editing-row) {
              content-visibility: auto; /* 自动管理内容可见性 */
              contain-intrinsic-size: 0 54px; /* 预设行高，避免滚动跳动 */
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
              overscroll-behavior: contain; /* 防止iOS的弹性滚动 */
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
            全选
          </Button>,
          <Button key="deselectAll" onClick={deselectAllExportFields}>
            取消全选
          </Button>,
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
                  disabled={field === '客户姓名'} // 客户姓名字段必选
                >
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