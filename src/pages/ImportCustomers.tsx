import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Card, 
  Upload, 
  message, 
  Table, 
  Typography, 
  Space, 
  Spin 
} from 'antd';
import { UploadOutlined, DownloadOutlined, ImportOutlined } from '@ant-design/icons';
import { InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { constructionTeamApi } from '../services/api';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// 查找导入模板相关代码，修改导入字段定义
// ... existing code ...

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

// ... existing code ...

// 修改downloadTemplate函数
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

// ... existing code ...

// 修改handleImport函数，只验证客户姓名是否存在
const validateRow = (row: any) => {
  const errors = [];
  
  // 验证必填字段
  if (!row.customer_name) {
    errors.push('客户姓名不能为空');
  }
  
  if (!row.phone) {
    errors.push('客户电话不能为空');
  }
  
  // 验证company字段值是否有效
  if (row.company && row.company !== '昊尘' && row.company !== '祐之') {
    errors.push(`公司字段值必须为"昊尘"或"祐之"，当前值为"${row.company}"`);
  }
  
  return errors;
};

// ... existing code ...

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
        
        // 获取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 将工作表转换为JSON
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        if (json.length === 0) {
          message.error('文件内容为空');
          setIsValidating(false);
          return;
        }

        // 映射字段名称
        const mappedData = json.map((row: any, index) => {
          const mappedRow: any = { row_index: index + 2 }; // Excel从1开始，标题行是1，数据从2开始
          
          Object.keys(row).forEach(key => {
            const dbField = FIELD_MAPPING[key as keyof typeof FIELD_MAPPING];
            if (dbField) {
              mappedRow[dbField] = row[key];
            }
          });
          
          return mappedRow;
        });
        
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
    
    data.forEach((row, index) => {
      const rowErrors = validateRow(row);
      if (rowErrors.length > 0) {
        errors[index] = rowErrors;
      }
    });
    
    setValidationErrors(errors);
    setIsValidating(false);
    
    if (Object.keys(errors).length > 0) {
      message.warning('部分数据验证未通过，请修正后重新导入');
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
        
        if (customerData.filing_date) {
          customerData.filing_date = new Date(customerData.filing_date).toISOString();
        }
        
        // 转换数字字段
        if (customerData.module_count) {
          customerData.module_count = Number(customerData.module_count);
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
        
        // 处理公司字段
        if (customerData.company) {
          // 确保公司字段值符合数据库约束 - 必须是'昊尘'或'祐之'
          if (customerData.company !== '昊尘' && customerData.company !== '祐之') {
            // 使用默认值
            customerData.company = '昊尘';
          }
          console.log(`客户 ${customerData.customer_name} 的公司设置为: ${customerData.company}`);
        } else {
          // 默认为昊尘
          customerData.company = '昊尘';
        }
        
        // 插入数据
        const { error } = await supabase
          .from('customers')
          .insert(customerData);
        
        if (error) {
          throw error;
        }
        
        result.success++;
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

  // 表格列定义
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
    },
    {
      title: '客户电话',
      dataIndex: 'phone',
      key: 'phone',
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
      render: (text: string) => text || '',
    },
    {
      title: '验证结果',
      key: 'validation',
      render: (_: any, record: any, index: number) => {
        if (validationErrors[index]) {
          return (
            <Text type="danger">
              {validationErrors[index].join('；')}
            </Text>
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
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 .xlsx 和 .xls 格式的Excel文件
          </p>
        </Dragger>
      </Card>
      
      {isValidating && (
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <Spin tip="数据验证中..." />
        </div>
      )}
      
      {importData.length > 0 && !isValidating && (
        <>
          <Card title="数据预览" style={{ marginBottom: '24px' }}>
            <Table 
              dataSource={importData} 
              columns={columns} 
              rowKey="row_index"
              pagination={false}
              scroll={{ x: '3000px' }}
              className="warehouse-table"
            />
          </Card>
          
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
                setImportResult(null);
              }}>
                清空数据
              </Button>
            </Space>
          </Card>
        </>
      )}
      
      {importResult && (
        <Card title="导入结果" style={{ marginTop: '24px' }}>
          <div>
            <p>总数据: {importResult.total}</p>
            <p>成功导入: {importResult.success}</p>
            <p>导入失败: {importResult.failed}</p>
          </div>
          
          {importResult.failedItems.length > 0 && (
            <>
              <Title level={4}>失败数据详情</Title>
              <Table 
                dataSource={importResult.failedItems} 
                columns={[
                  ...columns.filter(col => col.key !== 'validation'),
                  {
                    title: '错误信息',
                    dataIndex: 'error',
                    key: 'error',
                  },
                ]}
                rowKey="row_index"
                pagination={false}
                scroll={{ x: '3000px' }}
                className="warehouse-table"
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
};

export default ImportCustomers; 