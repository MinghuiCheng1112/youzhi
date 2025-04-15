import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp, theme, message, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useAuth } from '../contexts/AuthContext'
import { fixRoleConstraint, createFixRoleConstraintFunction } from '../services/supabase'

// 布局组件

// 在应用启动时尝试修复角色约束
useEffect(() => {
  // 尝试修复数据库角色约束
  const fixDatabaseConstraints = async () => {
    try {
      console.log('应用启动：检查并修复数据库角色约束...');
      
      // 先创建修复函数，再执行修复
      try {
        await createFixRoleConstraintFunction();
      } catch (createError) {
        console.warn('创建修复函数失败，尝试直接执行修复:', createError);
      }
      
      // 执行修复
      await fixRoleConstraint();
    } catch (error) {
      console.error('修复数据库角色约束失败:', error);
    }
  };
  
  fixDatabaseConstraints();
}, []); 