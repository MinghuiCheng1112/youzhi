import React, { useState } from 'react';
import { message } from 'antd';
import { useSupabase } from '../contexts/SupabaseContext';

const NewCustomerForm = () => {
  const supabase = useSupabase();
  const [form] = useState(null);
  const [userData] = useState(null);
  const [userRole] = useState('salesman');
  const [setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      
      setSubmitting(true);

      // 确保必填字段存在
      if (!values.customer_name) {
        message.error('客户名称不能为空');
        return;
      }

      // 处理业务员信息
      if (userData?.email) {
        // 如果当前用户是业务员，自动关联到该客户
        if (userRole === 'salesman') {
          values.salesman = userData.name || userData.email;
          values.salesman_email = userData.email;
          
          // 获取业务员电话号码
          try {
            const { data: salesmanData } = await supabase
              .from('user_roles')
              .select('phone')
              .eq('user_id', userData.id)
              .eq('role', 'salesman')
              .single();
            
            if (salesmanData && salesmanData.phone) {
              values.salesman_phone = salesmanData.phone;
              console.log('添加业务员电话到客户信息:', salesmanData.phone);
            }
          } catch (err) {
            console.error('获取业务员电话失败:', err);
          }
        }
      }

      // 处理勘察员信息
      if (values.surveyor_id) {
        try {
          const { data: surveyor } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', values.surveyor_id)
            .single();
          
          if (surveyor) {
            values.surveyor = surveyor.name || surveyor.email;
            values.surveyor_email = surveyor.email;
            
            // 获取勘察员电话
            const { data: surveyorData } = await supabase
              .from('user_roles')
              .select('phone')
              .eq('user_id', values.surveyor_id)
              .eq('role', 'surveyor')
              .single();
            
            if (surveyorData && surveyorData.phone) {
              values.surveyor_phone = surveyorData.phone;
            }
          }
        } catch (error) {
          console.error('获取勘察员信息失败:', error);
        }
      }

      // ... existing code ...
    } catch (error) {
      console.error('表单提交失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* ... existing form elements ... */}
    </div>
  );
};

export default NewCustomerForm; 