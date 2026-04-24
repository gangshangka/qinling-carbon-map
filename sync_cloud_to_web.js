#!/usr/bin/env node
/**
 * 从 CloudBase 数据库同步碳汇数据到 GitHub Pages
 * 
 * 用法：node sync_cloud_to_web.js
 * 
 * 流程：
 * 1. 从 CloudBase 数据库读取 carbon_data 集合的所有记录
 * 2. 合并到本地 carbonData2.json
 * 3. 复制到 GitHub Pages 仓库
 */

const cloudbase = require('@cloudbase/node-sdk')
const fs = require('fs')
const path = require('path')

// CloudBase 环境配置
const ENV_ID = 'cloudbase-8gdof83j7fdc6094'

// 路径配置
const BASE_DIR = path.dirname(__filename)
const CARBON_DATA_JSON = path.join(BASE_DIR, 'data', 'carbonData2.json')
const GITHUB_PAGES_DIR = path.resolve(BASE_DIR, '..', 'qinling-carbon-3d')
const GITHUB_CARBON_JSON = path.join(GITHUB_PAGES_DIR, 'carbonData2.json')

// 39个县区名称
const COUNTY_NAMES = [
  "宁陕县", "丹凤县", "柞水县", "长安区", "鄠邑区",
  "蓝田县", "周至县", "渭滨区", "陈仓区", "岐山县",
  "眉县", "凤县", "太白县", "临渭区", "华州区",
  "潼关县", "华阴市", "城固县", "洋县", "勉县",
  "略阳县", "留坝县", "佛坪县", "汉滨区", "汉阴县",
  "石泉县", "商州区", "洛南县", "商南县", "山阳县",
  "镇安县", "灞桥区", "临潼区", "汉台区", "西乡县",
  "宁强县", "紫阳县", "岚皋县", "旬阳县"
]

async function main() {
  console.log('=' .repeat(60))
  console.log('从 CloudBase 数据库同步碳汇数据到 GitHub Pages')
  console.log('=' .repeat(60))

  // Step 1: 初始化 CloudBase SDK
  console.log('\n[1/5] 连接 CloudBase 数据库...')
  
  // 尝试使用云开发环境连接
  // 注意：本地运行需要登录态，可能需要通过云函数调用
  let app
  try {
    app = cloudbase.init({
      env: ENV_ID
    })
    
    // 尝试获取数据库引用
    const db = app.database()
    
    // 尝试匿名登录
    const auth = app.auth()
    try {
      const loginState = await auth.getLoginState()
      if (!loginState) {
        console.log('尝试匿名登录...')
        await auth.anonymousAuthProvider().signIn()
        console.log('匿名登录成功')
      }
    } catch (authErr) {
      console.log('匿名登录失败，尝试直接访问:', authErr.message)
    }
    
    // Step 2: 从数据库读取数据
    console.log('\n[2/5] 从 carbon_data 集合读取数据...')
    
    let allRecords = []
    let batch = 0
    const limit = 100
    
    try {
      while (true) {
        const query = batch === 0 
          ? db.collection('carbon_data').limit(limit)
          : db.collection('carbon_data').skip(batch * limit).limit(limit)
        
        const result = await query.get()
        const records = result.data || []
        allRecords = allRecords.concat(records)
        
        console.log(`  第${batch + 1}批: 获取 ${records.length} 条记录`)
        
        if (records.length < limit) break
        batch++
        
        // 最多读取10批
        if (batch >= 10) {
          console.log('  已达到最大读取批次，停止')
          break
        }
      }
    } catch (dbErr) {
      console.error('数据库读取失败:', dbErr.message)
      console.log('\n提示：CloudBase 数据库不能直接从外部访问。')
      console.log('请使用以下替代方案：')
      console.log('  1. 在微信开发者工具中查看数据库，手动导出数据')
      console.log('  2. 在小程序管理页面添加"同步到网页"功能')
      console.log('  3. 部署一个云函数API来暴露数据')
      process.exit(1)
    }
    
    console.log(`  共读取 ${allRecords.length} 条碳汇数据记录`)
    
    if (allRecords.length === 0) {
      console.log('数据库中没有碳汇数据记录，无需同步')
      process.exit(0)
    }
    
    // Step 3: 合并数据
    console.log('\n[3/5] 合并数据到 carbonData2.json...')
    
    // 读取现有的 carbonData2.json
    let existingData = {}
    if (fs.existsSync(CARBON_DATA_JSON)) {
      existingData = JSON.parse(fs.readFileSync(CARBON_DATA_JSON, 'utf-8'))
      console.log(`  已有 ${Object.keys(existingData).length} 个年份的静态数据`)
    }
    
    // 合并云数据库的记录
    let updatedCount = 0
    let addedCount = 0
    
    for (const record of allRecords) {
      const year = String(record.year)
      const month = String(record.month)
      const countyData = record.countyData || {}
      
      // 跳过无效数据
      if (!year || !month || Object.keys(countyData).length === 0) continue
      
      // 检查是否已有该年月数据
      const hasExisting = existingData[year] && existingData[year][month]
      
      if (hasExisting) {
        // 检查现有数据是否全为0
        const values = Object.values(existingData[year][month])
        const allZero = values.every(v => v === 0)
        
        if (!allZero) {
          // 已有有效数据，不覆盖
          continue
        }
      }
      
      // 确保数据格式正确（县区名称对齐）
      const normalizedData = {}
      for (const name of COUNTY_NAMES) {
        // 尝试精确匹配和去除空格匹配
        let value = countyData[name]
        if (value === undefined) {
          // 尝试去除空格匹配
          for (const key in countyData) {
            if (key.replace(/\s/g, '') === name) {
              value = countyData[key]
              break
            }
          }
        }
        normalizedData[name] = value !== undefined ? value : 0
      }
      
      // 合并
      if (!existingData[year]) {
        existingData[year] = {}
      }
      existingData[year][month] = normalizedData
      
      if (hasExisting) {
        updatedCount++
      } else {
        addedCount++
      }
    }
    
    console.log(`  新增 ${addedCount} 个月份数据，更新 ${updatedCount} 个月份数据`)
    
    // Step 4: 保存更新后的 carbonData2.json
    console.log('\n[4/5] 保存更新后的 carbonData2.json...')
    
    fs.writeFileSync(CARBON_DATA_JSON, JSON.stringify(existingData, null, 2), 'utf-8')
    console.log(`  已保存: ${CARBON_DATA_JSON}`)
    
    // 同时更新 carbonData2.js
    const jsContent = `// 秦岭碳汇数据（按年月组织）\nconst carbonData = ${JSON.stringify(existingData, null, 2)};\n\nmodule.exports = carbonData;`
    const jsPath = path.join(BASE_DIR, 'data', 'carbonData2.js')
    fs.writeFileSync(jsPath, jsContent, 'utf-8')
    console.log(`  已保存: ${jsPath}`)
    
    // Step 5: 复制到 GitHub Pages
    console.log('\n[5/5] 同步到 GitHub Pages...')
    
    if (fs.existsSync(GITHUB_PAGES_DIR)) {
      fs.writeFileSync(GITHUB_CARBON_JSON, JSON.stringify(existingData, null, 2), 'utf-8')
      console.log(`  已复制: ${GITHUB_CARBON_JSON}`)
      console.log('\n请手动执行以下命令推送到 GitHub:')
      console.log(`  cd ${GITHUB_PAGES_DIR}`)
      console.log('  git add carbonData2.json')
      console.log('  git commit -m "update: 同步云数据库碳汇数据"')
      console.log('  git push origin main')
    } else {
      console.log(`  GitHub Pages 目录不存在: ${GITHUB_PAGES_DIR}`)
      console.log('  请手动复制 carbonData2.json 到 GitHub Pages 仓库')
    }
    
    // 输出数据摘要
    console.log('\n' + '=' .repeat(60))
    console.log('同步完成！数据摘要:')
    console.log('=' .repeat(60))
    
    for (const year of Object.keys(existingData).sort()) {
      const months = Object.keys(existingData[year])
      const validMonths = months.filter(m => {
        const values = Object.values(existingData[year][m])
        return !values.every(v => v === 0)
      })
      console.log(`  ${year}年: ${months.length}个月份, ${validMonths.length}个有数据`)
    }
    
  } catch (err) {
    console.error('同步失败:', err)
    
    // 提供替代方案
    console.log('\n' + '=' .repeat(60))
    console.log('CloudBase 数据库无法从外部直接访问。')
    console.log('替代方案：')
    console.log('=' .repeat(60))
    console.log('方案1：在小程序管理页面添加"同步到网页"按钮')
    console.log('  - 小程序中可以访问云数据库')
    console.log('  - 读取数据后上传到云存储公开路径')
    console.log('  - 网页从云存储 URL 加载数据')
    console.log('')
    console.log('方案2：在微信开发者工具中手动导出数据库')
    console.log('  - 打开微信开发者工具 → 云开发 → 数据库')
    console.log('  - 选择 carbon_data 集合 → 导出')
    console.log('  - 将导出的数据运行此脚本合并')
    console.log('')
    console.log('方案3：部署云函数API')
    console.log('  - 部署一个公开的云函数，返回碳汇数据')
    console.log('  - 网页通过 HTTP 触发云函数获取数据')
    
    process.exit(1)
  }
}

main()
