## 代码变更摘要

### 已删除的数据库列
- construction_acceptance_waiting_start ✓
- construction_acceptance_notes ✓
- construction_acceptance_waiting_days ✓
- construction_acceptance_status ✓

### 已更新的文件
- src/types.ts - 从Customer接口中删除了不需要的字段 ✓
- src/pages/roles/GridConnectionDashboard.tsx - 简化了建设验收流程，去除了等待天数功能 ✓
- src/pages/CustomerList.tsx - 更新了建设验收栏和状态切换功能 ✓

### 优化效果
- 简化了建设验收流程，只保留了"未推到"和时间戳两种状态 ✓
- 减少了数据库表的存储空间 ✓
- 减少了前端发送到服务器的数据量 ✓
- 修复了点击"未推到"按钮时的更新失败问题 ✓

## 建设验收功能优化摘要

### 代码优化
- **简化了建设验收功能**：
  - 只保留"未推到"按钮与时间戳状态切换 ✓
  - 删除了复杂的等待状态和相关功能 ✓
  - 移除了"已验收"和"未验收"两种状态 ✓

### 数据优化
- **仅保留关键数据字段**：
  - 保留了`construction_acceptance_date`字段用于记录验收完成时间 ✓
  - 删除了`construction_acceptance_status`废弃字段 ✓
  - 删除了`construction_acceptance_notes`废弃字段 ✓
  - 删除了`construction_acceptance_waiting_days`废弃字段 ✓
  - 删除了`construction_acceptance_waiting_start`废弃字段 ✓

### 已更新的文件
- `src/types.ts` - 从Customer接口中删除了不需要的字段定义 ✓
- `src/pages/roles/GridConnectionDashboard.tsx` - 简化了建设验收栏，只使用日期字段 ✓
- `src/pages/CustomerList.tsx` - 更新了建设验收栏和相关方法，删除状态字段的使用 ✓

### 用户体验改进
- 用户操作更加简洁：
  - 点击"未推到"按钮即可标记为完成（显示时间戳） ✓
  - 点击时间戳可恢复为"未推到"状态 ✓
  - 去除了间隔状态，使工作流程更加清晰 ✓

### 解决的问题
- 修复了点击"未推到"按钮时控制台出现"静默更新失败"的问题
  - 将`customerApi.updateWithCache`方法替换为`await customerApi.update`方法 
  - 确保数据库更新操作完全同步执行
- 成功执行了SQL脚本，删除了所有废弃字段
  - 首先删除了依赖的视图`vw_construction_acceptance_status`
  - 然后删除了所有废弃字段
