import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Result, Button, Card, Table, Modal, Form, Input, Select, message, Space } from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { supabase } from '../../services/supabase'
import Draggable from 'react-draggable'

// 导入各角色仪表板
import AdminDashboard from './AdminDashboard'
import CustomerList from '../CustomerList'
import SalesmanDashboard from './SalesmanDashboard'
import FilingOfficerDashboard from './FilingOfficerDashboard'
import SurveyorDashboard from './SurveyorDashboard'
import WarehouseManagerDashboard from './WarehouseManagerDashboard'
import DispatchManagerDashboard from './DispatchManagerDashboard'
import ConstructionTeamDashboard from './ConstructionTeamDashboard'
import GridConnectionDashboard from './GridConnectionDashboard'
import ProcurementDashboard from './ProcurementDashboard'

const { Option } = Select

// 用户类型定义
interface UserWithRole {
  id: string
  email: string
  name: string  // 增加员工名称字段
  phone: string // 增加员工电话字段
  role: string
  role_id: number
  created_at: string
  last_sign_in: string
  isPending: boolean
}

// 可用的角色选项
const ROLE_OPTIONS = [
  { label: '管理员', value: 'admin' },
  { label: '备案员', value: 'filing_officer' },
  { label: '业务员', value: 'salesman' },
  { label: '踏勘员', value: 'surveyor' },
  { label: '仓库员', value: 'warehouse' },
  { label: '派工员', value: 'dispatch' },
  { label: '施工队', value: 'construction_team' },
  { label: '并网员', value: 'grid_connector' },
  { label: '采购员', value: 'procurement' },
  { label: '待分配角色', value: 'pending' }
];

const RoleDashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [dataLoading, setDataLoading] = useState(false)
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isUserModalVisible, setIsUserModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorDisplayed, setErrorDisplayed] = useState<{[key: string]: boolean}>({}) 
  const [errorTimestamps, setErrorTimestamps] = useState<{[key: string]: number}>({})
  const [form] = Form.useForm()
  const [nameEditForm] = Form.useForm()
  const [phoneEditForm] = Form.useForm()  // 新增电话编辑表单
  const [userForm] = Form.useForm()
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState('')
  const [editingPhoneKey, setEditingPhoneKey] = useState('')  // 新增电话编辑状态
  const [currentSalesman, setCurrentSalesman] = useState<UserWithRole | null>(null)
  const [isSubordinateModalVisible, setIsSubordinateModalVisible] = useState(false)
  const [subordinateForm] = Form.useForm()
  const [subordinates, setSubordinates] = useState<{id: string, email: string, name: string}[]>([])
  
  // 避免重复获取数据标志
  const dataLoadedRef = useRef(false)
  // 错误刷新防抖计时器
  const errorDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 判断行是否处于编辑状态
  const isEditing = (record: UserWithRole) => record.id === editingKey;
  
  // 判断电话是否处于编辑状态
  const isPhoneEditing = (record: UserWithRole) => record.id === editingPhoneKey;

  // 开始编辑
  const edit = (record: UserWithRole) => {
    nameEditForm.setFieldsValue({ 
      name: record.name,
    });
    setEditingKey(record.id);
  };
  
  // 开始编辑电话
  const editPhone = (record: UserWithRole) => {
    phoneEditForm.setFieldsValue({ 
      phone: record.phone
    });
    setEditingPhoneKey(record.id);
  };

  // 取消编辑
  const cancel = () => {
    setEditingKey('');
  };
  
  // 取消电话编辑
  const cancelPhone = () => {
    setEditingPhoneKey('');
  };

  // 获取用户列表
  const fetchUsers = async () => {
    setDataLoading(true);
    console.log('开始获取用户列表...');

    try {
      // 直接从user_roles表获取所有数据
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');

      if (error) {
        console.error('获取用户角色失败:', error);
        message.error('获取用户角色失败');
        return;
      }

      console.log('获取到user_roles数据:', data);
      
      // 获取用户登录信息
      interface UserLoginInfo {
        [key: string]: { last_sign_in: string | null };
      }
      
      let userLoginInfo: UserLoginInfo = {};
      try {
        // 使用较为安全的方法获取登录信息，通过auth.users视图
        const { data: authData, error: authError } = await supabase
          .from('auth.users')
          .select('id, last_sign_in_at');
        
        if (!authError && authData) {
          // 转换为映射
          userLoginInfo = authData.reduce((acc: UserLoginInfo, user: any) => {
            acc[user.id] = { last_sign_in: user.last_sign_in_at };
            return acc;
          }, {});
        } else {
          console.warn('获取用户登录信息失败，尝试备选方法', authError);
          
          // 备选方法：从user_sessions表获取
          const { data: sessionsData, error: sessionsError } = await supabase
            .from('user_sessions')
            .select('user_id, created_at, updated_at')
            .order('updated_at', { ascending: false });
            
          if (!sessionsError && sessionsData) {
            // 按用户分组，只保留最新的会话时间
            const userSessions: Record<string, string> = {};
            sessionsData.forEach((session: any) => {
              if (!userSessions[session.user_id] || 
                  new Date(session.updated_at) > new Date(userSessions[session.user_id])) {
                userSessions[session.user_id] = session.updated_at;
              }
            });
            
            userLoginInfo = Object.keys(userSessions).reduce((acc: UserLoginInfo, userId: string) => {
              acc[userId] = { last_sign_in: userSessions[userId] };
              return acc;
            }, {});
          } else {
            console.warn('备选方法获取登录信息也失败', sessionsError);
          }
        }
      } catch (authFetchError) {
        console.error('获取用户登录信息异常:', authFetchError);
      }
      
      // 简单处理数据
      const userDetails = data.map((userRole) => {
        const userId = userRole.user_id;
        return {
          id: userId,
          role: userRole.role || '未分配',
          role_id: userRole.id || 0,
          email: userRole.email || userId,
          name: userRole.name || '',
          phone: userRole.phone || '',
          created_at: userRole.created_at || new Date().toISOString(),
          last_sign_in: userLoginInfo[userId]?.last_sign_in || '-',
          // 添加待分配角色的标记
          isPending: userRole.role === 'pending'
        };
      });

      console.log('处理后的用户数据:', userDetails);
      setUsers(userDetails);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setDataLoading(false);
    }
  };

  // 保存员工名称
  const saveEmployeeName = async (id: string) => {
    try {
      const values = await nameEditForm.validateFields();
      setDataLoading(true);

      console.log('正在更新员工名称，用户ID:', id, '新名称:', values.name);

      // 直接更新user_roles表，无需检查表结构
      const { error } = await supabase
        .from('user_roles')
        .update({ 
          name: values.name,
        })
        .eq('user_id', id);

      if (error) {
        console.error('更新员工名称失败:', error);
        message.error(`更新员工名称失败: ${error.message}`);
        return;
      }

      message.success('员工名称更新成功');
      setEditingKey('');
      fetchUsers(); // 刷新用户列表
    } catch (errInfo) {
      console.error('验证失败:', errInfo);
    } finally {
      setDataLoading(false);
    }
  };
  
  // 保存员工电话
  const saveEmployeePhone = async (id: string) => {
    try {
      const values = await phoneEditForm.validateFields();
      setDataLoading(true);

      console.log('正在更新员工电话，用户ID:', id, '新电话:', values.phone);

      // 直接更新user_roles表，无需检查表结构
      const { error } = await supabase
        .from('user_roles')
        .update({ 
          phone: values.phone 
        })
        .eq('user_id', id);

      if (error) {
        console.error('更新员工电话失败:', error);
        message.error(`更新员工电话失败: ${error.message}`);
        return;
      }

      message.success('员工电话更新成功');
      setEditingPhoneKey('');
      fetchUsers(); // 刷新用户列表
    } catch (errInfo) {
      console.error('验证失败:', errInfo);
    } finally {
      setDataLoading(false);
    }
  };

  // 员工名称编辑组件
  const EmployeeNameCell = ({ name, record }: { name: string; record: UserWithRole }) => {
    const editable = isEditing(record);
    
    return editable ? (
      <Form form={nameEditForm} initialValues={{ name }}>
        <Form.Item
          name="name"
          style={{ margin: 0 }}
          rules={[{ required: true, message: '请输入员工名称' }]}
        >
          <Input 
            onPressEnter={() => saveEmployeeName(record.id)} 
            placeholder="请输入员工名称"
            autoFocus
          />
        </Form.Item>
      </Form>
    ) : (
      <div 
        style={{ 
          padding: '4px 0',
          borderRadius: 4,
          cursor: editingKey === '' && editingPhoneKey === '' ? 'pointer' : 'default',
        }}
        onClick={() => editingKey === '' && editingPhoneKey === '' && edit(record)}
      >
        {name ? (
          <span>{name}</span>
        ) : (
          <span style={{ color: '#999', fontStyle: 'italic' }}>未设置</span>
        )}
      </div>
    );
  };

  // 添加员工电话编辑组件
  const EmployeePhoneCell = ({ phone, record }: { phone: string; record: UserWithRole }) => {
    const editable = isPhoneEditing(record);
    
    return editable ? (
      <Form form={phoneEditForm} initialValues={{ phone }}>
        <Form.Item
          name="phone"
          style={{ margin: 0 }}
          rules={[
            { required: false, message: '请输入员工电话' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
          ]}
        >
          <Input 
            onPressEnter={() => saveEmployeePhone(record.id)} 
            placeholder="请输入员工电话"
            autoFocus
          />
        </Form.Item>
      </Form>
    ) : (
      <div 
        style={{ 
          padding: '4px 0',
          borderRadius: 4,
          cursor: editingKey === '' && editingPhoneKey === '' ? 'pointer' : 'default',
        }}
        onClick={() => editingKey === '' && editingPhoneKey === '' && editPhone(record)}
      >
        {phone ? (
          <span>{phone}</span>
        ) : (
          <span style={{ color: '#999', fontStyle: 'italic' }}>未设置</span>
        )}
      </div>
    );
  };

  // 更智能的错误显示系统
  const showErrorOnce = (key: string, errorMsg: string) => {
    // 创建唯一的错误ID，包括错误消息的哈希
    const errorHash = `${key}-${errorMsg.length}`
    
    // 检查是否已显示，以及上次显示时间（防止30秒内重复显示）
    const now = Date.now()
    const lastShown = errorTimestamps[errorHash] || 0
    const timeSinceLastError = now - lastShown
    
    if (!errorDisplayed[errorHash] || timeSinceLastError > 30000) {
      // 设置显示状态
      setErrorDisplayed(prev => ({...prev, [errorHash]: true}))
      setErrorTimestamps(prev => ({...prev, [errorHash]: now}))
      
      // 显示消息
      message.error({
        content: errorMsg,
        key: errorHash,
        duration: 3
      })
      
      // 设置5分钟后自动清除错误显示状态的定时器
      if (errorDebounceTimerRef.current) {
        clearTimeout(errorDebounceTimerRef.current)
      }
      
      errorDebounceTimerRef.current = setTimeout(() => {
        setErrorDisplayed({})
      }, 300000) // 5分钟后重置错误状态
    }
  }

  // 初始化数据加载，确保只加载一次
  useEffect(() => {
    // 只有当用户是管理员且数据未加载时才加载数据
    if (user && user.role === 'admin' && !dataLoadedRef.current) {
      dataLoadedRef.current = true // 立即标记为已加载，防止重复加载
      
      const fetchData = async () => {
        setDataLoading(true)
        
        try {
          // 只获取用户数据，不再获取角色数据
          console.log('开始获取用户数据...');
          const usersData = await fetchUsers();
          console.log('用户数据获取完成:', usersData);
        } catch (err) {
          console.error('数据加载失败:', err);
        } finally {
          setDataLoading(false);
        }
      }
      
      fetchData();
    }
  }, [user]) // 只依赖于user变化触发

  // 重置所有错误状态
  const resetErrors = () => {
    setErrorDisplayed({})
    setErrorTimestamps({})
    setErrorMessage(null)
    
    // 清除防抖计时器
    if (errorDebounceTimerRef.current) {
      clearTimeout(errorDebounceTimerRef.current)
      errorDebounceTimerRef.current = null
    }
  }

  // 监听用户变化，重置错误状态
  useEffect(() => {
    resetErrors()
    
    // 组件卸载时清理
    return () => {
      if (errorDebounceTimerRef.current) {
        clearTimeout(errorDebounceTimerRef.current)
      }
    }
  }, [user])

  // 处理创建/编辑角色
  const handleRoleSubmit = async (_: any) => {
    try {
      // 由于不再使用roles表，直接显示成功消息
      message.success(editingRoleId ? '角色更新成功' : '角色创建成功')
      
      setIsModalVisible(false)
      form.resetFields()
      setEditingRoleId(null)
    } catch (error) {
      console.error('保存角色失败:', error)
      message.error('保存角色失败')
    }
  }

  // 处理创建用户
  const handleUserSubmit = async (values: any) => {
    try {
      // 清除之前的错误消息
      setErrorMessage(null);
      
      // 创建用户
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`
        }
      });
      
      if (error) {
        // 检查是否是用户已存在的错误
        if (error.message.includes('User already registered') || 
            error.message.includes('already been registered') || 
            error.message.includes('已注册') || 
            error.message.includes('already exists')) {
          setErrorMessage('该邮箱已注册。您可以：1) 使用其他邮箱；2) 删除已有用户后再创建；3) 让用户使用已有账户登录。');
          showErrorOnce('userExists', '该邮箱已注册。您可以：1) 使用其他邮箱；2) 删除已有用户后再创建；3) 让用户使用已有账户登录。');
          return;
        } else if (error.message.includes('rate limit') || 
                  error.message.includes('exceeded') || 
                  error.message.includes('email rate limit')) {
          setErrorMessage('创建用户失败：邮件发送频率超限。您可以：1) 稍后再试；2) 使用"添加现有用户"功能；3) 联系Supabase管理员提高限制。');
          showErrorOnce('rateLimit', '创建用户失败：邮件发送频率超限。请稍后再试。');
          return;
        } else if (error.message.includes('permission') || 
                  error.message.includes('not allowed') || 
                  error.message.includes('权限不足')) {
          setErrorMessage('创建用户失败：权限不足。请确保您有管理员权限或使用服务角色密钥。');
          showErrorOnce('permissionError', '创建用户失败：权限不足。请确保您有管理员权限。');
          return;
        }
        
        // 记录详细错误信息以便调试
        console.error('创建用户详细错误:', JSON.stringify(error));
        setErrorMessage(`创建用户失败: ${error.message}`);
        showErrorOnce('createUserError', `创建用户失败: ${error.message}`);
        return;
      }
      
      // 检查用户是否创建成功
      if (!data.user || !data.user.id) {
        showErrorOnce('noUserData', '用户可能已创建，但无法获取用户ID。请使用"添加现有用户"功能手动分配角色。');
        setIsUserModalVisible(false);
        userForm.resetFields();
        return;
      }
      
      // 尝试自动为新用户创建角色并存储邮箱和名称
      try {
        const roleData = {
          user_id: data.user.id,
          email: values.email,
          name: values.name,
          phone: values.phone || '',
          role: values.role,  // 使用选择的角色值
          created_at: new Date().toISOString()
        };
        
        // 插入用户角色记录
        const { error: roleError } = await supabase.from('user_roles').insert([roleData]);
        
        if (roleError) {
          console.error('创建用户角色记录失败:', roleError);
          
          // 特殊处理角色约束错误
          if (roleError.message.includes('violates check constraint') && 
              roleError.message.includes('user_roles_role_check')) {
            // 尝试修复角色约束
            try {
              // 导入 fixRoleConstraint 函数
              const { fixRoleConstraint } = await import('../../services/supabase');
              await fixRoleConstraint();
              
              // 修复后再次尝试插入角色
              console.log('重新尝试插入角色记录...');
              const { error: retryError } = await supabase.from('user_roles').insert([roleData]);
              
              if (retryError) {
                console.error('二次尝试创建用户角色记录失败:', retryError);
                message.warning('用户创建成功，但角色分配失败。请稍后使用"添加现有用户"功能手动分配角色。');
              } else {
                message.success(`用户创建成功并分配了${roleData.role}角色，验证邮件已发送至 ${values.email}。`);
              }
            } catch (fixError) {
              console.error('修复角色约束失败:', fixError);
              message.warning('用户创建成功，但角色分配失败。请稍后使用"添加现有用户"功能手动分配角色。');
            }
          } else {
            message.warning('用户创建成功，但角色分配失败。请稍后使用"添加现有用户"功能手动分配角色。');
          }
        } else {
          message.success(`用户创建成功，验证邮件已发送至 ${values.email}。`);
        }
      } catch (roleError) {
        console.error('预创建用户角色记录失败:', roleError);
        message.warning('用户创建成功，但角色分配失败。请稍后使用"添加现有用户"功能手动分配角色。');
      }
      
      setIsUserModalVisible(false);
      userForm.resetFields();
      
      // 刷新用户列表
      fetchUsers();
    } catch (error) {
      console.error('创建用户失败:', error);
      const errMsg = error instanceof Error ? error.message : '未知错误';
      
      // 提供更明确的错误提示
      if (typeof errMsg === 'string') {
        if (errMsg.includes('network')) {
          setErrorMessage('创建用户失败: 网络连接错误，请检查您的网络连接。');
          message.error('创建用户失败: 网络连接错误，请检查您的网络连接。');
        } else if (errMsg.includes('timeout')) {
          setErrorMessage('创建用户失败: 请求超时，请稍后重试。');
          message.error('创建用户失败: 请求超时，请稍后重试。');
        } else if (errMsg.includes('rate limit') || errMsg.includes('exceeded')) {
          setErrorMessage('创建用户失败: 邮件发送频率超限。请稍后再试。');
          message.error('创建用户失败: 邮件发送频率超限。请稍后再试。');
        } else {
          setErrorMessage(`创建用户失败: ${errMsg}。如果Supabase中已创建成功，请使用"添加现有用户"功能手动分配角色。`);
          message.error(`创建用户失败: ${errMsg}。如果Supabase中已创建成功，请使用"添加现有用户"功能手动分配角色。`);
        }
      } else {
        setErrorMessage('创建用户失败: 未知错误。请检查控制台获取详细信息。');
        message.error('创建用户失败: 未知错误。请检查控制台获取详细信息。');
      }
    }
  };

  // 处理删除用户
  const handleDeleteUser = async (userId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除用户角色后无法恢复，确定要继续吗？',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 只删除user_roles表中的记录，不尝试删除用户账号
          const { error: roleError } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId);

          if (roleError) {
            console.error('删除用户角色失败:', roleError);
            message.error(`删除用户角色失败: ${roleError.message}`);
            return;
          }

          // 如果是业务员，删除相关的业务员关系
          const { error: relError } = await supabase
            .from('salesman_relationships')
            .delete()
            .or(`parent_id.eq.${userId},child_id.eq.${userId}`);
          
          if (relError) {
            console.error('删除业务员关系失败:', relError);
            // 不阻止继续执行
          }

          message.success('用户角色删除成功');
          
          // 刷新用户列表
          fetchUsers();
        } catch (error) {
          console.error('删除用户时出错:', error);
          const errMsg = error instanceof Error ? error.message : '未知错误';
          message.error(`删除用户失败: ${errMsg}`);
        }
      }
    });
  };

  // 获取业务员的下级
  const fetchSubordinates = async (salesmanId: string) => {
    try {
      const { data, error } = await supabase
        .from('view_salesman_subordinates')
        .select('*')
        .eq('parent_id', salesmanId);
      
      if (error) {
        console.error('获取下级业务员失败:', error);
        message.error(`获取下级业务员失败: ${error.message}`);
        return;
      }
      
      setSubordinates(data || []);
    } catch (error) {
      console.error('获取下级业务员失败:', error);
      message.error('获取下级业务员失败，请重试');
    }
  };

  // 处理管理下级业务员
  const handleManageSubordinates = (record: UserWithRole) => {
    setCurrentSalesman(record)
    fetchSubordinates(record.id)
    setIsSubordinateModalVisible(true)
  }

  // 添加下级业务员
  const handleAddSubordinate = async (values: { subordinate: string }) => {
    if (!currentSalesman) {
      message.error('当前业务员信息丢失，请重试');
      return;
    }
    
    try {
      console.log('开始添加下级业务员:', values.subordinate, '到上级:', currentSalesman.id);
      
      // 防止添加自己作为下级
      if (values.subordinate === currentSalesman.id) {
        message.error('不能添加自己作为下级');
        return;
      }
      
      // 检查是否已经存在该关系
      const { data: existingRelation, error: checkError } = await supabase
        .from('salesman_relationships')
        .select('id')
        .eq('parent_id', currentSalesman.id)
        .eq('child_id', values.subordinate)
        .maybeSingle();
      
      if (checkError) {
        console.error('检查业务员关系失败:', checkError);
        message.error(`检查业务员关系失败: ${checkError.message}`);
        return;
      }
      
      if (existingRelation) {
        message.warning('该业务员已经是下级，无需重复添加');
        return;
      }
      
      // 添加新关系
      const { error } = await supabase
        .from('salesman_relationships')
        .insert({
          parent_id: currentSalesman.id,
          child_id: values.subordinate
        });
      
      if (error) {
        console.error('添加下级业务员失败:', error);
        message.error(`添加下级业务员失败: ${error.message}`);
        return;
      }
      
      message.success('添加下级业务员成功');
      subordinateForm.resetFields();
      
      // 重新获取下级列表
      fetchSubordinates(currentSalesman.id);
    } catch (error) {
      console.error('添加下级业务员失败:', error);
      message.error('添加下级业务员失败，请重试');
    }
  }

  // 移除下级业务员
  const handleRemoveSubordinate = async (childId: string) => {
    if (!currentSalesman) {
      message.error('当前业务员信息丢失，请重试');
      return;
    }
    
    Modal.confirm({
      title: '确认移除',
      content: '确定要移除此下级业务员吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('salesman_relationships')
            .delete()
            .eq('parent_id', currentSalesman.id)
            .eq('child_id', childId);
          
          if (error) {
            console.error('移除下级业务员失败:', error);
            message.error(`移除下级业务员失败: ${error.message}`);
            return;
          }
          
          message.success('移除下级业务员成功');
          
          // 重新获取下级列表
          fetchSubordinates(currentSalesman.id);
        } catch (error) {
          console.error('移除下级业务员失败:', error);
          message.error('移除下级业务员失败，请重试');
        }
      }
    });
  }

  // 处理角色变更
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // 更新用户角色
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) {
        console.error('更新用户角色失败:', error);
        
        // 特殊处理角色约束错误
        if (error.message.includes('violates check constraint') && 
            error.message.includes('user_roles_role_check')) {
          // 显示正在修复的提示
          message.loading({ content: '正在修复角色约束...', key: 'roleConstraintFix' });
          
          try {
            // 导入并调用修复函数
            const { fixRoleConstraint } = await import('../../services/supabase');
            await fixRoleConstraint();
            
            // 修复后再次尝试更新角色
            const { error: retryError } = await supabase
              .from('user_roles')
              .update({ role: newRole })
              .eq('user_id', userId);
            
            if (retryError) {
              console.error('二次尝试更新用户角色失败:', retryError);
              message.error({ content: `更新用户角色失败: ${retryError.message}`, key: 'roleConstraintFix' });
            } else {
              message.success({ content: '用户角色更新成功', key: 'roleConstraintFix' });
              fetchUsers(); // 刷新用户列表
            }
          } catch (fixError) {
            console.error('修复角色约束失败:', fixError);
            message.error({ content: '修复角色约束失败，请联系系统管理员', key: 'roleConstraintFix' });
          }
        } else {
          message.error(`更新用户角色失败: ${error.message}`);
        }
        return;
      }

      message.success('用户角色更新成功');
      fetchUsers(); // 刷新用户列表
    } catch (error) {
      console.error('更新用户角色失败:', error);
      message.error('更新用户角色失败，请重试');
    }
  };

  // 用户表格列
  const userColumns = [
    {
      title: '角色名称',
      dataIndex: 'role',
      key: 'roleName',
      render: (role: string, record: UserWithRole) => {
        const roleOption = ROLE_OPTIONS.find(option => option.value === role);
        // 给待分配角色用户添加高亮
        if (role === 'pending' || record.isPending) {
          return <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
            {roleOption ? roleOption.label : role}
            <span style={{ 
              display: 'inline-block',
              marginLeft: '5px',
              padding: '0 8px', 
              fontSize: '12px', 
              lineHeight: '20px', 
              backgroundColor: '#fff1f0', 
              border: '1px solid #ffccc7', 
              borderRadius: '4px',
              color: '#ff4d4f' 
            }}>新注册用户</span>
          </span>;
        }
        return roleOption ? roleOption.label : role;
      },
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <span style={{ wordBreak: 'break-all' }}>{email}</span>
      ),
    },
    {
      title: '员工名称',
      dataIndex: 'name',
      key: 'name',
      editable: true,
      render: (name: string, record: UserWithRole) => (
        <EmployeeNameCell name={name} record={record} />
      ),
    },
    {
      title: '员工电话',
      dataIndex: 'phone',
      key: 'phone',
      editable: true,
      render: (phone: string, record: UserWithRole) => (
        <EmployeePhoneCell phone={phone} record={record} />
      ),
    },
    {
      title: '分配角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record: UserWithRole) => (
        <Select
          defaultValue={role}
          style={{ width: 120 }}
          onChange={(value) => handleRoleChange(record.id, value)}
        >
          {ROLE_OPTIONS.map(option => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: UserWithRole) => {
        const editable = isEditing(record);
        const phoneEditable = isPhoneEditing(record);
        return (
          <Space size="small">
            {editable ? (
              <>
                <Button 
                  type="primary" 
                  size="small"
                  onClick={() => saveEmployeeName(record.id)}
                  icon={<CheckOutlined />}
                >
                  保存
                </Button>
                <Button 
                  type="default" 
                  size="small"
                  onClick={cancel}
                  icon={<CloseOutlined />}
                >
                  取消
                </Button>
              </>
            ) : phoneEditable ? (
              <>
                <Button 
                  type="primary" 
                  size="small"
                  onClick={() => saveEmployeePhone(record.id)}
                  icon={<CheckOutlined />}
                >
                  保存
                </Button>
                <Button 
                  type="default" 
                  size="small"
                  onClick={cancelPhone}
                  icon={<CloseOutlined />}
                >
                  取消
                </Button>
              </>
            ) : (
              <>
                {record.role === 'salesman' && (
                  <Button 
                    type="link" 
                    onClick={() => handleManageSubordinates(record)}
                    title="管理下级业务员"
                  >
                    管理下级
                  </Button>
                )}
                <Button 
                  type="link" 
                  onClick={() => Modal.info({
                    title: '重置密码',
                    content: (
                      <div>
                        <p>暂不支持直接重置密码。</p>
                        <p>请删除此用户并创建新用户。</p>
                      </div>
                    ),
                  })}
                  title="重置用户密码"
                >
                  重置密码
                </Button>
                <Button 
                  type="link" 
                  danger 
                  onClick={() => handleDeleteUser(record.id)} 
                  disabled={editable || phoneEditable}
                  title="删除此用户"
                >
                  删除
                </Button>
              </>
            )}
          </Space>
        );
      }
    },
  ]

  // 加载中显示加载动画
  if (dataLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  // 未登录
  if (!user) {
    return null // 会被重定向到登录页
  }

  // 根据角色渲染对应的仪表板
  switch (user.role) {
    case 'admin':
      return (
        <div>
          <Card title="用户管理中心">
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Space>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => {
                      userForm.resetFields();
                      setIsUserModalVisible(true);
                    }}
                  >
                    新建用户
                  </Button>
                </Space>
              </div>
            </div>
            
            <Table 
              columns={userColumns} 
              dataSource={users} 
              rowKey="id"
              loading={dataLoading}
              pagination={false}
              locale={{ emptyText: '暂无数据' }}
              rowClassName={(record: UserWithRole) => record.role === 'pending' || record.isPending ? 'pending-user-row' : ''}
            />
            
            {/* 自定义行样式 */}
            <style>{`
              .pending-user-row {
                background-color: rgba(255, 77, 79, 0.05);
              }
              .pending-user-row:hover td {
                background-color: rgba(255, 77, 79, 0.1) !important;
              }
            `}</style>
        
            {users.length === 0 && !dataLoading && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <Button type="primary" onClick={() => fetchUsers()}>
                  重新加载用户数据
                </Button>
              </div>
            )}
          </Card>
          
          {/* 用户表单模态框 */}
          <Modal
            title="新建用户"
            open={isUserModalVisible}
            onCancel={() => {
              setIsUserModalVisible(false)
              userForm.resetFields()
              setErrorMessage(null)
            }}
            footer={null}
            width={900}
            modalRender={(modal) => (
              <Draggable handle=".ant-modal-header">
                {modal}
              </Draggable>
            )}
          >
            {errorMessage && (
              <div style={{ marginBottom: 16, padding: 10, backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
                <p style={{ color: '#ff4d4f' }}><strong>错误：</strong>{errorMessage}</p>
              </div>
            )}
            
            <Form
              form={userForm}
              layout="vertical"
              onFinish={handleUserSubmit}
              style={{ width: '100%', marginBottom: '16px' }}
            >
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input 
                  placeholder="用户邮箱" 
                  style={{ height: '40px', fontSize: '14px' }} 
                />
              </Form.Item>
              
              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少6个字符' }
                ]}
              >
                <Input.Password 
                  placeholder="密码" 
                  style={{ height: '40px', fontSize: '14px' }} 
                />
              </Form.Item>
              
              <Form.Item
                name="name"
                label="员工名称"
                rules={[{ required: true, message: '请输入员工名称' }]}
              >
                <Input 
                  placeholder="员工名称" 
                  style={{ height: '40px', fontSize: '14px' }} 
                />
              </Form.Item>
              
              <Form.Item
                name="phone"
                label="员工电话"
                rules={[
                  { required: false, message: '请输入员工电话' },
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
                ]}
              >
                <Input 
                  placeholder="员工电话" 
                  style={{ height: '40px', fontSize: '14px' }} 
                />
              </Form.Item>
              
              <Form.Item
                name="role"
                label="角色分配"
                rules={[{ required: true, message: '请选择用户角色' }]}
                initialValue="salesman"
              >
                <Select 
                  placeholder="选择角色" 
                  style={{ height: '40px', fontSize: '14px' }}
                >
                  {ROLE_OPTIONS.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              
              <Form.Item style={{ marginTop: '24px' }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  style={{ width: '100%', height: '40px', fontSize: '15px' }}
                >
                  创建用户
                </Button>
              </Form.Item>
            </Form>
              
            <div style={{ marginTop: 16, padding: 16, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
              <p style={{ color: '#52c41a', fontWeight: 'bold', marginBottom: 8 }}>重要提示：邮箱验证</p>
              <p style={{ color: '#5b8c00' }}>用户创建后，将收到验证邮件。请提醒用户及时验证邮箱以激活账号。</p>
            </div>
          </Modal>
          
          {/* 角色编辑模态框 */}
          <Modal
            title={editingRoleId ? "编辑角色" : "新建角色"}
            open={isModalVisible}
            onCancel={() => {
              setIsModalVisible(false);
              form.resetFields();
            }}
            footer={null}
            modalRender={(modal) => (
              <Draggable handle=".ant-modal-header">
                {modal}
              </Draggable>
            )}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleRoleSubmit}
            >
              <Form.Item
                name="name"
                label="角色名称"
                rules={[{ required: true, message: '请输入角色名称' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="description"
                label="描述"
                rules={[{ required: true, message: '请输入角色描述' }]}
              >
                <Input.TextArea />
              </Form.Item>
              <Form.Item
                name="permissions"
                label="权限"
                rules={[{ required: true, message: '请选择权限' }]}
              >
                <Select mode="multiple">
                  {ROLE_OPTIONS.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>
                  {editingRoleId ? "保存" : "创建"}
                </Button>
              </Form.Item>
            </Form>
          </Modal>
          
          {/* 下级业务员管理模态框 */}
          <Modal
            title={`管理 ${currentSalesman?.name ? `${currentSalesman.name} (${currentSalesman.phone || '无电话'})` : currentSalesman?.phone || currentSalesman?.email || ''} 的下级业务员`}
            open={isSubordinateModalVisible}
            onCancel={() => {
              setIsSubordinateModalVisible(false)
              setCurrentSalesman(null)
              subordinateForm.resetFields()
            }}
            footer={null}
            width={700}
            modalRender={(modal) => (
              <Draggable handle=".ant-modal-header">
                {modal}
              </Draggable>
            )}
          >
            <div style={{ marginBottom: 16 }}>
              <Form
                form={subordinateForm}
                layout="inline"
                onFinish={handleAddSubordinate}
                style={{ display: 'flex', width: '100%' }}
              >
                <Form.Item
                  name="subordinate"
                  label="选择业务员"
                  rules={[{ required: true, message: '请选择业务员' }]}
                  style={{ flex: 1, marginRight: '8px' }}
                >
                  <Select 
                    placeholder="选择要添加为下级的业务员"
                    style={{ width: '100%' }}
                    showSearch
                    optionFilterProp="children"
                  >
                    {users
                      .filter(u => 
                        u.role === 'salesman' && 
                        u.id !== currentSalesman?.id && 
                        !subordinates.some(sub => sub.id === u.id)
                      )
                      .map(u => (
                        <Option key={u.id} value={u.id}>
                          {u.name ? `${u.name} (${u.phone || '无电话'})` : u.phone || u.email || '-'}
                        </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    添加下级
                  </Button>
                </Form.Item>
              </Form>
            </div>
            
            {subordinates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
                暂无下级业务员
              </div>
            ) : (
              <Table 
                dataSource={subordinates}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: '业务员电话',
                    dataIndex: 'phone',
                    key: 'phone',
                    render: (phone, record) => {
                      const user = users.find(u => u.id === record.id);
                      return phone || user?.phone || '-';
                    }
                  },
                  {
                    title: '员工名称',
                    dataIndex: 'name',
                    key: 'name',
                    render: (name, record) => {
                      // 如果本地没有名称，尝试从users中获取
                      const user = users.find(u => u.id === record.id);
                      return name || user?.name || '-';
                    }
                  },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => {
                      const isBeingEdited = record.id === editingKey;
                      return (
                        <Space>
                          {isBeingEdited ? (
                            <>
                              <Button 
                                type="link" 
                                onClick={() => saveEmployeeName(record.id)}
                              >
                                保存
                              </Button>
                              <Button 
                                type="link" 
                                onClick={cancel}
                              >
                                取消
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="link"
                                onClick={() => {
                                  // 找到完整的用户信息
                                  const user = users.find(u => u.id === record.id);
                                  if (user) {
                                    edit(user);
                                  } else {
                                    edit({
                                      ...record,
                                      role: 'salesman',
                                      role_id: 0,
                                      created_at: '',
                                      last_sign_in: ''
                                    } as UserWithRole);
                                  }
                                }}
                                disabled={editingKey !== ''}
                              >
                                编辑
                              </Button>
                              <Button
                                type="link"
                                danger
                                onClick={() => handleRemoveSubordinate(record.id)}
                                disabled={editingKey !== ''}
                              >
                                移除
                              </Button>
                            </>
                          )}
                        </Space>
                      );
                    }
                  },
                ]}
              />
            )}
          </Modal>
        </div>
      )

    case 'dashboard':
      return <AdminDashboard />

    case 'customers':
      return <CustomerList />

    case 'salesman':
      return <SalesmanDashboard />

    case 'filing_officer':
      return <FilingOfficerDashboard />

    case 'surveyor':
      return <SurveyorDashboard />

    case 'warehouse':
      return <WarehouseManagerDashboard />

    case 'dispatch':
      return <DispatchManagerDashboard />

    case 'construction_team':
      return <ConstructionTeamDashboard />

    case 'grid_connector':
      return <GridConnectionDashboard />

    case 'procurement':
      return <ProcurementDashboard />

    default:
      // 所有其他角色显示此消息
      return (
        <Result
          status="info"
          title={`${user.role || '未知'} 角色工作台`}
          subTitle="此角色的工作台正在开发中..."
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              返回首页
            </Button>
          }
        />
      )
  }
}

export default RoleDashboard