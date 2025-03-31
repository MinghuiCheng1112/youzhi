// 自动更新施工队电话脚本 - 确保相同名称的施工队电话信息保持一致
const { createClient } = require('@supabase/supabase-js');

// 创建Supabase客户端 - 使用硬编码的URL和Key
const supabaseUrl = "https://rkkkicdabwqtjzsoaxty.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJra2tpY2RhYndxdGp6c29heHR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQzNDEyNzgsImV4cCI6MjAxOTkxNzI3OH0.pVdXrW4K8PO7XnHs7lZPO6v-H70SZoWbh4sm7wlnPBM";

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 更新相同名称施工队的电话号码，确保一致性
 */
async function updateConstructionTeamPhones() {
  try {
    console.log('开始更新施工队电话信息...\n');

    // 步骤1: 获取所有施工队及其电话信息
    console.log('步骤1: 查询所有施工队信息...');
    
    // 直接从customers表查询数据
    const { data: teamsResult, error: teamsError } = await supabase
      .from('customers')
      .select('construction_team, construction_team_phone')
      .not('construction_team', 'is', null)
      .not('construction_team', 'eq', '');
    
    if (teamsError) {
      console.error('查询施工队信息失败:', teamsError);
      return;
    }
    
    // 如果没有记录，则退出
    if (!teamsResult || teamsResult.length === 0) {
      console.log('没有找到施工队信息，无需更新');
      return;
    }
    
    console.log(`找到 ${teamsResult.length} 条客户记录`);
    
    // 步骤2: 统计每个施工队名称和电话的组合出现次数
    const teamPhoneCounts = new Map();
    
    for (const row of teamsResult) {
      if (!row.construction_team) continue;
      
      const key = `${row.construction_team}|${row.construction_team_phone || ''}`;
      teamPhoneCounts.set(key, (teamPhoneCounts.get(key) || 0) + 1);
    }
    
    // 步骤3: 整理数据，找出每个施工队最常用的电话号码
    const teamPhoneMap = new Map();
    const teamsToUpdate = [];
    
    // 处理统计结果，找出每个施工队最常用的电话号码
    for (const [key, count] of teamPhoneCounts.entries()) {
      const [teamName, phone] = key.split('|');
      
      if (!teamPhoneMap.has(teamName) || count > teamPhoneMap.get(teamName).count) {
        teamPhoneMap.set(teamName, { phone, count });
      }
    }
    
    console.log('施工队最常用电话号码:');
    for (const [team, data] of teamPhoneMap.entries()) {
      console.log(`${team}: ${data.phone || '(无电话)'} (使用次数: ${data.count})`);
      
      // 确保电话号码有值，否则不更新
      if (data.phone) {
        teamsToUpdate.push({ team, phone: data.phone });
      }
    }
    
    if (teamsToUpdate.length === 0) {
      console.log('没有需要更新的施工队电话信息');
      return;
    }
    
    // 步骤4: 更新每个施工队的电话号码，确保一致
    console.log(`\n步骤4: 开始更新 ${teamsToUpdate.length} 个施工队的电话信息...`);
    
    let successCount = 0;
    let errorCount = 0;
    let totalUpdatedRows = 0;
    
    for (const { team, phone } of teamsToUpdate) {
      try {
        // 更新客户电话信息
        const { data, error: updateError, count } = await supabase
          .from('customers')
          .update({ 
            construction_team_phone: phone,
            updated_at: new Date().toISOString()
          })
          .eq('construction_team', team)
          .not('construction_team_phone', 'eq', phone);
        
        if (updateError) {
          console.error(`更新 ${team} 的电话时出错:`, updateError.message);
          errorCount++;
        } else {
          console.log(`已更新 ${team} 的电话为 ${phone}`);
          successCount++;
          // 注意：Supabase JS客户端不直接返回affected rows数量
        }
      } catch (error) {
        console.error(`更新 ${team} 的电话时出错:`, error.message);
        errorCount++;
      }
    }
    
    // 步骤5: 验证结果
    console.log('\n步骤5: 验证更新结果...');
    
    // 重新查询以检查是否所有施工队都有一致的电话
    const { data: verifyData, error: verifyError } = await supabase
      .from('customers')
      .select('construction_team, construction_team_phone')
      .not('construction_team', 'is', null)
      .not('construction_team', 'eq', '');
    
    if (verifyError) {
      console.error('验证结果失败:', verifyError);
    } else {
      // 检查每个施工队是否有一致的电话号码
      const teamPhones = new Map();
      const inconsistentTeams = [];
      
      for (const row of verifyData) {
        const team = row.construction_team;
        const phone = row.construction_team_phone;
        
        if (!teamPhones.has(team)) {
          teamPhones.set(team, new Set());
        }
        teamPhones.get(team).add(phone || '');
      }
      
      // 找出仍有多个不同电话号码的施工队
      for (const [team, phones] of teamPhones.entries()) {
        if (phones.size > 1) {
          inconsistentTeams.push({ team, count: phones.size });
        }
      }
      
      if (inconsistentTeams.length > 0) {
        console.log('警告: 以下施工队仍有多个不同的电话号码:');
        for (const { team, count } of inconsistentTeams) {
          console.log(`${team}: ${count} 个不同电话号码`);
        }
      } else {
        console.log('验证成功: 所有施工队的电话号码已统一');
      }
    }
    
    console.log('\n更新完成！');
    console.log(`成功更新: ${successCount} 个施工队`);
    if (errorCount > 0) {
      console.log(`失败: ${errorCount} 个施工队`);
    }
  } catch (err) {
    console.error('执行更新时出错:', err);
  }
}

// 执行更新
updateConstructionTeamPhones()
  .then(() => {
    console.log('施工队电话更新操作完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('执行更新时出错:', err);
    process.exit(1);
  }); 