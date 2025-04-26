import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Card, 
  Upload, 
  message, 
  Table, 
  Typography, 
  Space, 
  Spin,
  Tag,
  Alert,
  Tooltip
} from 'antd';
import { UploadOutlined, DownloadOutlined, ImportOutlined, FileExcelOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { constructionTeamApi } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

// 更新导入模板的字段定义
const IMPORT_TEMPLATE_FIELDS = [
  { key: 'register_date', label: '登记日期', required: false },
  { key: 'customer_name', label: '客户姓名', required: true },
  { key: 'phone', label: '客户电话', required: false },
  { key: 'address', label: '客户地址', required: false },
  { key: 'id_card', label: '身份证号', required: false },
  { key: 'salesman', label: '业务员', required: false },
  { key: 'filing_date', label: '备案日期', required: false },
  { key: 'meter_number', label: '电表号码', required: false },
  { key: 'designer', label: '设计师', required: false },
  { key: 'module_count', label: '组件数量', required: false },
  { key: 'construction_team', label: '施工队', required: false },
  { key: 'price', label: '价格', required: false },
  { key: 'company', label: '公司', required: false }
];

// 下载导入模板
const downloadTemplate = () => {
  // 创建表头行
  const headerRow = IMPORT_TEMPLATE_FIELDS.map(field => field.label);
  
  // 创建示例数据行
  const exampleRow = IMPORT_TEMPLATE_FIELDS.map(field => {
    if (field.key === 'register_date' || field.key === 'filing_date') {
      return '2023-01-01'; // 日期示例
    } else if (field.key === 'module_count') {
      return '32'; // 数字示例
    } else if (field.key === 'price') {
      return '10000'; // 价格示例
    } else if (field.key === 'company') {
      return '昊尘'; // 公司示例，使用已允许的值
    } else if (field.key === 'customer_name') {
      return '张三'; // 客户姓名示例
    } else if (field.key === 'phone') {
      return '13812345678'; // 电话示例
    } else {
      return ''; // 其他字段空值示例
    }
  });
  
  // 创建Excel工作簿
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
  XLSX.utils.book_append_sheet(wb, ws, "导入模板");
  
  // 下载Excel文件
  XLSX.writeFile(wb, "客户导入模板.xlsx");
};

// 验证行数据
const validateRow = (row: any) => {
  const errors = [];
  
  // 验证必填字段
  if (!row.customer_name) {
    errors.push('客户姓名不能为空');
  }
  
  // 电话不是必填，但如果填了且不为空，检查格式
  if (row.phone && row.phone.toString().trim() !== '' && !/^1[3-9]\d{9}$/.test(row.phone)) {
    errors.push('电话号码格式不正确');
  }
  
  // 验证company字段值是否有效
  if (row.company && row.company !== '昊尘' && row.company !== '祐之') {
    errors.push(`公司字段值必须为"昊尘"或"祐之"，当前值为"${row.company}"`);
  }
  
  return errors;
};

// 导入状态卡片组件
const ImportStatusCard = ({ status, isValidating }: { 
  status: { total: number; valid: number; invalid: number } | null;
  isValidating: boolean;
}) => {
  if (!status && !isValidating) return null;
  
  return (
    <Card title={<span><Text strong>导入验证状态</Text> {isValidating && <Spin size="small" />}</span>} bordered={false} style={{ marginBottom: '24px' }}>
      {isValidating ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin tip="正在验证导入数据，请稍候..." />
        </div>
      ) : status && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div>
              <Text strong>总数据：</Text>
              <Text>{status.total}</Text>
            </div>
            <div>
              <Text strong>验证通过：</Text>
              <Text type="success">{status.valid}</Text>
            </div>
            <div>
              <Text strong>验证未通过：</Text>
              <Text type="danger">{status.invalid}</Text>
            </div>
          </div>
          
          {status.invalid > 0 ? (
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Text type="warning">共有 {status.invalid} 条数据验证未通过，请修正后重新导入</Text>
            </div>
          ) : (
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Text type="success">所有数据验证通过，可以进行导入</Text>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

const ImportCustomers = () => {
  const navigate = useNavigate();
  const [importData, setImportData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string[] }>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    success: number;
    failed: number;
    failedItems: any[];
  } | null>(null);
  // 添加验证状态
  const [validationStatus, setValidationStatus] = useState<{
    total: number;
    valid: number;
    invalid: number;
  } | null>(null);
  // 添加业务员缓存状态
  const [salesmenCache, setSalesmenCache] = useState<Map<string, string>>(new Map());
  // 添加施工队缓存状态
  const [constructionTeamsCache, setConstructionTeamsCache] = useState<Map<string, string>>(new Map());

  // 字段映射（Excel列名到数据库字段的映射）
  const FIELD_MAPPING = {
    '登记日期': 'register_date',
    '客户姓名': 'customer_name',
    '客户电话': 'phone',
    '客户地址': 'address',
    '地址': 'address',
    '身份证号': 'id_card',
    '业务员': 'salesman',
    '备案日期': 'filing_date',
    '电表号码': 'meter_number',
    '设计师': 'designer',
    '组件数量': 'module_count',
    '施工队': 'construction_team',
    '价格': 'price',
    '公司': 'company'
  };

  // 获取所有业务员信息和施工队信息
  useEffect(() => {
    fetchSalesmen();
    fetchConstructionTeams();
  }, []);

  // 获取业务员信息
  const fetchSalesmen = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('name, phone')
        .eq('role', 'salesman');
      
      if (error) throw error;
      
      // 创建业务员名称->电话的映射
      const salesmenMap = new Map();
      if (data) {
        data.forEach(salesman => {
          if (salesman.name && salesman.phone) {
            salesmenMap.set(salesman.name, salesman.phone);
          }
        });
      }
      
      setSalesmenCache(salesmenMap);
      console.log('已缓存业务员信息:', Array.from(salesmenMap.entries()));
    } catch (error) {
      console.error('获取业务员信息失败:', error);
    }
  };

  // 获取施工队信息
  const fetchConstructionTeams = async () => {
    try {
      // 使用constructionTeamApi代替直接查询
      const teamsData = await constructionTeamApi.getFromUserRoles();
      
      // 创建施工队名称->电话的映射
      const teamsMap = new Map();
      if (teamsData && teamsData.length > 0) {
        teamsData.forEach(team => {
          if (team.name) {
            teamsMap.set(team.name, team.phone || '');
          }
        });
      }
      
      // 如果user_roles没有数据，从客户表中提取
      if (teamsMap.size === 0) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('construction_team, construction_team_phone')
          .not('construction_team', 'is', null);
          
        if (!customersError && customers) {
          customers.forEach(customer => {
            if (customer.construction_team && !teamsMap.has(customer.construction_team)) {
              teamsMap.set(customer.construction_team, customer.construction_team_phone || '');
            }
          });
        }
      }
      
      setConstructionTeamsCache(teamsMap);
      console.log('已缓存施工队信息:', Array.from(teamsMap.entries()));
    } catch (error) {
      console.error('获取施工队信息失败:', error);
    }
  };

  // 根据业务员名称获取电话
  const getSalesmanPhone = (salesmanName: string): string => {
    if (!salesmanName) return '';
    
    // 从缓存中获取业务员电话
    const phone = salesmenCache.get(salesmanName);
    if (phone) {
      console.log(`找到业务员 ${salesmanName} 的电话: ${phone}`);
      return phone;
    }
    
    console.log(`未找到业务员 ${salesmanName} 的电话`);
    return ''; // 如果找不到电话，返回空字符串
  };

  // 根据施工队名称获取电话
  const getConstructionTeamPhone = (teamName: string): string => {
    if (!teamName) return '';
    
    // 从缓存中获取施工队电话
    const phone = constructionTeamsCache.get(teamName);
    if (phone) {
      console.log(`找到施工队 ${teamName} 的电话: ${phone}`);
      return phone;
    }
    
    console.log(`未找到施工队 ${teamName} 的电话`);
    return ''; // 如果找不到电话，返回空字符串
  };

  // 解析上传的Excel文件
  const parseExcel = (file: File) => {
    setIsValidating(true);
    setImportData([]);
    setValidationErrors({});
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error('Excel文件中没有工作表');
        }
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 转换为JSON数据
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          setIsValidating(false);
          message.error('没有找到有效数据，请确保Excel文件包含有效内容');
          return;
        }
        
        console.log('导入的原始数据:', jsonData);
        
        // 转换字段名称
        const mappedData = jsonData.map((row: any, index) => {
          const mappedRow: any = { row_index: index + 2 }; // Excel从1开始，标题行占1行
          
          // 遍历每个字段，进行映射
          Object.keys(row).forEach(key => {
            const mappedKey = FIELD_MAPPING[key];
            if (mappedKey) {
              mappedRow[mappedKey] = row[key];
            } else {
              // 如果没有映射关系，保留原字段名
              mappedRow[key] = row[key];
            }
          });
          
          return mappedRow;
        });
        
        console.log('映射后的数据:', mappedData);
        
        // 设置导入数据并开始验证
        setImportData(mappedData);
        validateData(mappedData);
      } catch (error) {
        console.error('解析Excel出错:', error);
        message.error('解析文件失败，请检查文件格式');
        setIsValidating(false);
      }
    };
    
    reader.readAsArrayBuffer(file);
    return false;
  };

  // 验证数据
  const validateData = (data: any[]) => {
    const errors: { [key: string]: string[] } = {};
    let validCount = 0;
    let invalidCount = 0;
    
    data.forEach((row, index) => {
      const rowErrors = validateRow(row);
      if (rowErrors.length > 0) {
        errors[index] = rowErrors;
        invalidCount++;
      } else {
        validCount++;
      }
    });
    
    setValidationErrors(errors);
    setValidationStatus({
      total: data.length,
      valid: validCount,
      invalid: invalidCount
    });
    setIsValidating(false);
    
    if (Object.keys(errors).length > 0) {
      message.warning(`部分数据验证未通过: ${invalidCount}条异常，${validCount}条正常，请修正后重新导入`);
    } else {
      message.success('数据验证通过，可以导入');
    }
  };

  // 导入数据到数据库
  const importToDatabase = async () => {
    if (importData.length === 0) {
      message.error('没有数据可导入');
      return;
    }
    
    if (Object.keys(validationErrors).length > 0) {
      message.error('数据验证未通过，请修正后重新导入');
      return;
    }
    
    setIsImporting(true);
    
    const result = {
      total: importData.length,
      success: 0,
      failed: 0,
      failedItems: [] as any[]
    };
    
    for (const customer of importData) {
      try {
        // 准备插入数据，移除row_index
        const { row_index, ...customerData } = customer;
        
        // 转换日期字段
        if (customerData.register_date) {
          customerData.register_date = new Date(customerData.register_date).toISOString();
        }
        
        // 备案日期可以是日期或文字，保持原始格式
        if (customerData.filing_date) {
          // 尝试转换为日期
          const filingDate = new Date(customerData.filing_date);
          if (!isNaN(filingDate.getTime())) {
            // 如果是有效日期则转换
            customerData.filing_date = filingDate.toISOString();
          }
          // 如果不是有效日期，保持原文字格式
        }
        
        // 电话号码可以为空
        if (!customerData.phone) {
          customerData.phone = '';
        }
        
        // 转换数字字段
        if (customerData.module_count !== undefined && customerData.module_count !== null && customerData.module_count !== '') {
          customerData.module_count = Number(customerData.module_count);
        } else {
          // 如果组件数量为空，明确设置为null
          customerData.module_count = null;
        }
        
        if (customerData.price) {
          customerData.price = Number(customerData.price);
        }
        
        // 如果有业务员名称，自动匹配业务员电话
        if (customerData.salesman) {
          const salesmanPhone = getSalesmanPhone(customerData.salesman);
          if (salesmanPhone) {
            customerData.salesman_phone = salesmanPhone;
          }
          console.log(`客户 ${customerData.customer_name} 的业务员 ${customerData.salesman} 电话设置为: ${customerData.salesman_phone || '无'}`);
        }
        
        // 如果有施工队名称，自动匹配施工队电话
        if (customerData.construction_team) {
          const teamPhone = getConstructionTeamPhone(customerData.construction_team);
          if (teamPhone) {
            customerData.construction_team_phone = teamPhone;
          }
          console.log(`客户 ${customerData.customer_name} 的施工队 ${customerData.construction_team} 电话设置为: ${customerData.construction_team_phone || '无'}`);
        }
        
        // 首先检查是否存在相同客户姓名和电话的数据
        if (customerData.customer_name && customerData.phone) {
          console.log(`检查客户 ${customerData.customer_name}, 电话: ${customerData.phone} 是否存在`);
          
          // 查询数据库中是否存在相同姓名和电话的客户
          const { data: existingCustomers, error: queryError } = await supabase
            .from('customers')
            .select('*')
            .eq('customer_name', customerData.customer_name)
            .eq('phone', customerData.phone);
          
          if (queryError) {
            throw queryError;
          }
          
          console.log(`查询结果: 找到 ${existingCustomers?.length || 0} 个匹配客户`);
          
          // 如果存在相同姓名和电话的客户，则更新该客户的信息
          if (existingCustomers && existingCustomers.length > 0) {
            const existingCustomer = existingCustomers[0];
            console.log(`找到现有客户:`, existingCustomer);
            
            const updateData: any = {};
            
            // 为了调试，先记录现有客户的组件数量
            console.log(`现有客户 ${existingCustomer.id} 的组件数量: ${existingCustomer.module_count}`);
            console.log(`导入数据的组件数量(原始): ${customer.module_count}, 类型: ${typeof customer.module_count}`);
            console.log(`处理后的组件数量: ${customerData.module_count}, 类型: ${typeof customerData.module_count}`);
            
            // 遍历新数据的所有字段，仅更新非空字段
            Object.keys(customerData).forEach(key => {
              // 特殊处理组件数量字段，确保值为0也能正确更新
              if (key === 'module_count') {
                if (customerData[key] !== undefined && customerData[key] !== null && customerData[key] !== '') {
                  updateData[key] = Number(customerData[key]);
                  console.log(`将更新组件数量为: ${updateData[key]}, 类型: ${typeof updateData[key]}`);
                }
              } 
              // 处理其他字段
              else if (
                customerData[key] !== undefined && 
                customerData[key] !== null && 
                (customerData[key] !== '' || customerData[key] === 0)
              ) {
                updateData[key] = customerData[key];
                console.log(`将更新字段 ${key}: ${updateData[key]}`);
              }
            });
            
            console.log(`更新数据:`, updateData);
            console.log(`更新条件: id = ${existingCustomer.id}`);
            
            // 如果有需要更新的字段，则进行更新
            if (Object.keys(updateData).length > 0) {
              const { data: updatedData, error: updateError } = await supabase
                .from('customers')
                .update(updateData)
                .eq('id', existingCustomer.id)
                .select();
              
              if (updateError) {
                console.error(`更新失败:`, updateError);
                throw updateError;
              }
              
              console.log(`更新成功:`, updatedData);
              result.success++;
              console.log(`更新了客户: ${customerData.customer_name}, 电话: ${customerData.phone}`);
            } else {
              result.success++;
              console.log(`跳过客户: ${customerData.customer_name}, 电话: ${customerData.phone} (无需更新的字段)`);
            }
          } else {
            // 如果不存在相同姓名和电话的客户，则插入新数据
            const { error } = await supabase
              .from('customers')
              .insert(customerData);
            
            if (error) {
              throw error;
            }
            
            result.success++;
            console.log(`新增客户: ${customerData.customer_name}, 电话: ${customerData.phone}`);
          }
        } else {
          // 如果缺少客户姓名或电话，则直接插入
          const { error } = await supabase
            .from('customers')
            .insert(customerData);
          
          if (error) {
            throw error;
          }
          
          result.success++;
          console.log(`新增客户(无姓名或电话): ${customerData.customer_name || '未知姓名'}`);
        }
      } catch (error) {
        console.error('导入数据出错:', error);
        result.failed++;
        result.failedItems.push({
          ...customer,
          error: (error as any).message || '未知错误'
        });
      }
    }
    
    setImportResult(result);
    setIsImporting(false);
    
    if (result.failed === 0) {
      message.success(`成功导入 ${result.success} 条客户数据`);
    } else {
      message.warning(`导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`);
    }
  };

  // 上传组件配置
  const uploadProps = {
    name: 'file',
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload: parseExcel,
  };

  // 添加导出失败数据功能
  const exportFailedData = (failedItems: any[]) => {
    // 创建工作簿
    const wb = XLSX.utils.book_new();
    
    // 准备导出数据
    const exportData = failedItems.map(item => {
      const { error, row_index, ...rest } = item;
      return {
        ...rest,
        '失败原因': error
      };
    });
    
    // 创建工作表
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(wb, ws, "导入失败数据");
    
    // 下载文件
    XLSX.writeFile(wb, `导入失败数据_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`);
  };

  // 修改表格列定义
  const columns = [
    {
      title: '行号',
      dataIndex: 'row_index',
      key: 'row_index',
      width: 80,
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (text: string, record: any, index: number) => {
        const hasError = validationErrors[index]?.some(err => err.includes('客户姓名'));
        return (
          <Tooltip title={hasError ? validationErrors[index].find(err => err.includes('客户姓名')) : null}>
            <Text type={hasError ? 'danger' : undefined}>
              {text || ''} {hasError && <ExclamationCircleOutlined style={{ marginLeft: 4 }} />}
            </Text>
          </Tooltip>
        );
      }
    },
    {
      title: '客户电话',
      dataIndex: 'phone',
      key: 'phone',
      render: (text: string, record: any, index: number) => {
        const hasError = validationErrors[index]?.some(err => err.includes('电话'));
        return (
          <Tooltip title={hasError ? validationErrors[index].find(err => err.includes('电话')) : null}>
            <Text type={hasError ? 'danger' : undefined}>
              {text || ''} {hasError && <ExclamationCircleOutlined style={{ marginLeft: 4 }} />}
            </Text>
          </Tooltip>
        );
      }
    },
    {
      title: '客户地址',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: '业务员',
      dataIndex: 'salesman',
      key: 'salesman',
    },
    {
      title: '组件数量',
      dataIndex: 'module_count',
      key: 'module_count',
    },
    {
      title: '施工队',
      dataIndex: 'construction_team',
      key: 'construction_team',
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      render: (text: string, record: any, index: number) => {
        const hasError = validationErrors[index]?.some(err => err.includes('公司'));
        return (
          <Tooltip title={hasError ? validationErrors[index].find(err => err.includes('公司')) : null}>
            <Text type={hasError ? 'danger' : undefined}>
              {text || ''} {hasError && <ExclamationCircleOutlined style={{ marginLeft: 4 }} />}
            </Text>
          </Tooltip>
        );
      }
    },
    {
      title: '验证结果',
      key: 'validation',
      render: (_: any, record: any, index: number) => {
        if (validationErrors[index]) {
          return (
            <Tooltip title={validationErrors[index].join('\n')} placement="left">
              <Text type="danger">
                <ExclamationCircleOutlined style={{ marginRight: 8 }} />
                验证未通过
              </Text>
            </Tooltip>
          );
        }
        return <Text type="success">验证通过</Text>;
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>客户数据导入</Title>
      
      <Card style={{ marginBottom: '24px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>请先下载导入模板，按照模板格式填写数据后上传。只有客户姓名为必填字段。</Text>
          
          <Space>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              onClick={downloadTemplate}
            >
              下载导入模板
            </Button>
            
            <Button 
              onClick={() => navigate('/customers')}
            >
              返回客户列表
            </Button>
          </Space>
        </Space>
      </Card>
      
      <Card style={{ marginBottom: '24px' }}>
        <Dragger {...uploadProps} disabled={isImporting}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 .xlsx 和 .xls 格式的Excel文件
          </p>
        </Dragger>
      </Card>
      
      {/* 使用新的状态卡片组件 */}
      <ImportStatusCard status={validationStatus} isValidating={isValidating} />
      
      {importData.length > 0 && !isValidating && (
        <>
          {validationStatus && validationStatus.invalid > 0 ? (
            <Card title="验证未通过数据" style={{ marginBottom: '24px' }}>
              <Alert
                message="请修正以下验证未通过的数据"
                description="以下数据存在验证问题，请修正后重新导入。只显示验证未通过的数据。"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Table 
                dataSource={importData.filter((_, index) => validationErrors[index])} 
                columns={columns} 
                rowKey="row_index"
                pagination={{ pageSize: 10 }}
                scroll={{ x: '3000px' }}
                className="warehouse-table"
                rowClassName={() => 'validation-error-row'}
              />
            </Card>
          ) : (
            <Card title="数据预览" style={{ marginBottom: '24px' }}>
              <Alert
                message="所有数据验证通过"
                description={`共${importData.length}条数据全部验证通过，可以进行导入。`}
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            </Card>
          )}
          
          <Card>
            <Space>
              <Button 
                type="primary" 
                icon={<ImportOutlined />} 
                onClick={importToDatabase}
                loading={isImporting}
                disabled={Object.keys(validationErrors).length > 0}
              >
                开始导入
              </Button>
              
              <Button onClick={() => {
                setImportData([]);
                setValidationErrors({});
                setValidationStatus(null);
                setImportResult(null);
              }}>
                清空数据
              </Button>
            </Space>
          </Card>
        </>
      )}
      
      {/* 修改导入结果显示部分 */}
      {importResult && (
        <Card 
          title={
            <span>
              <Text strong>导入结果</Text> 
              {importResult.failed > 0 ? 
                <Tag color="error" style={{ marginLeft: 8 }}>部分失败</Tag> : 
                <Tag color="success" style={{ marginLeft: 8 }}>全部成功</Tag>
              }
            </span>
          } 
          style={{ marginTop: '24px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px' }}>
            <div>
              <Text strong>总数据：</Text>
              <Text>{importResult.total}</Text>
            </div>
            <div>
              <Text strong>成功导入：</Text>
              <Text type="success">{importResult.success}</Text>
            </div>
            <div>
              <Text strong>导入失败：</Text>
              <Text type="danger">{importResult.failed}</Text>
            </div>
          </div>
          
          {importResult.failedItems.length > 0 && (
            <>
              <Alert
                message="导入失败数据"
                description={
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>共{importResult.failed}条数据导入失败，请导出失败数据查看具体原因</Text>
                    <Button 
                      type="primary" 
                      icon={<DownloadOutlined />}
                      onClick={() => exportFailedData(importResult.failedItems)}
                    >
                      导出失败数据
                    </Button>
                  </Space>
                }
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
};

export default ImportCustomers; 