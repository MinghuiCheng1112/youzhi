import React, { createContext, useContext } from 'react';
import { supabase } from '../services/supabase';

// 创建Supabase上下文
const SupabaseContext = createContext(null);

// 提供Supabase Provider组件
export const SupabaseProvider = ({ children }) => {
  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
};

// 提供useSupabase钩子以方便访问Supabase实例
export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase必须在SupabaseProvider内部使用');
  }
  return context;
};

export default SupabaseContext; 