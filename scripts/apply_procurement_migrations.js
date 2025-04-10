const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

// Supabase连接信息
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey)

// 迁移文件路径
const migrationsPath = path.join(__dirname, '..', 'database', 'migrations')

// 要应用的迁移脚本
const migrationFiles = [
  'create_procurement_materials.sql',
  'create_batch_update_materials_function.sql'
]

async function applyMigrations() {
  console.log('===================================')
  console.log('  应用采购相关数据库迁移')
  console.log('===================================')

  for (const file of migrationFiles) {
    try {
      console.log(`[信息] 正在应用迁移: ${file}`)
      
      // 读取SQL脚本
      const filePath = path.join(migrationsPath, file)
      const sqlScript = fs.readFileSync(filePath, 'utf8')
      
      // 执行SQL脚本
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sqlScript })
      
      if (error) {
        console.error(`[错误] 应用迁移 ${file} 失败:`, error)
        continue
      }
      
      console.log(`[成功] 迁移 ${file} 已成功应用`)
    } catch (error) {
      console.error(`[错误] 处理迁移 ${file} 时发生错误:`, error)
    }
  }

  console.log('===================================')
  console.log('  迁移完成')
  console.log('===================================')
}

applyMigrations() 