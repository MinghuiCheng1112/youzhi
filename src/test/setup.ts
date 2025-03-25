import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 用于模拟环境变量
(window as any).process = { env: { NODE_ENV: 'test' } };

// 模拟 import.meta.env
(window as any).import = { 
  meta: { 
    env: {
      VITE_SUPABASE_URL: 'https://test-url.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-key'
    } 
  } 
};

// 模拟 supabase 请求
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({ 
          data: [], 
          error: null,
          eq: () => ({ data: [], error: null, single: () => ({ data: null, error: null }) }),
          is: () => ({ data: [], error: null, order: () => ({ data: [], error: null }) }),
          not: () => ({ data: [], error: null, is: () => ({ data: [], error: null }) }),
          or: () => ({ data: [], error: null, is: () => ({ data: [], error: null }) }),
          order: () => ({ data: [], error: null }),
          single: () => ({ data: null, error: null })
        }),
        insert: () => ({ 
          data: null, 
          error: null,
          select: () => ({ single: () => ({ data: null, error: null }) })
        }),
        update: () => ({ 
          data: null, 
          error: null,
          eq: () => ({ data: null, error: null, select: () => ({ single: () => ({ data: null, error: null }) }) })
        })
      })
    })
  };
}); 