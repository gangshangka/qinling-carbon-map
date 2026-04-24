const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const https = require('https')
const http = require('http')

// HTTPS请求工具函数（绕过SSL验证）
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      ...options,
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method'
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data), raw: data })
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data, raw: data })
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

// 推送文件到GitHub
async function pushToGithub(token, repo, filePath, content, message) {
  const base64Content = Buffer.from(content).toString('base64')
  
  // 获取当前文件SHA
  let sha = ''
  try {
    const getRes = await httpsRequest({
      hostname: 'api.github.com',
      path: `/repos/${repo}/contents/${filePath}`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'qinling-carbon-app'
      }
    })
    if (getRes.statusCode === 200 && getRes.data && getRes.data.sha) {
      sha = getRes.data.sha
    }
  } catch (e) {
    console.log('获取SHA失败(可能是新文件):', e.message)
  }

  // 推送更新
  const putBody = JSON.stringify({
    message: message,
    content: base64Content,
    sha: sha || undefined
  })
  
  const putRes = await httpsRequest({
    hostname: 'api.github.com',
    path: `/repos/${repo}/contents/${filePath}`,
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'qinling-carbon-app',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(putBody)
    }
  }, putBody)
  
  return putRes
}

// 配置
const CONFIG = {
  NODATA_VALUE: -9999,
  DECIMAL_PLACES: 2,
  // 秦岭区域大致边界（WGS84）
  QINLING_BBOX: [105.0, 32.0, 112.0, 35.0],
  // 采样比例（为性能考虑，可以降低采样率）
  // 1.0=全采样(慢), 0.1=每10个像素采1个(快)
  SAMPLING_RATIO: 0.1
}

// 县域列表（从碳汇数据中提取）
const COUNTY_NAMES = [
  "宁陕县", "丹凤县", "柞水县", "长安区", "鄠邑区", "蓝田县", "周至县",
  "渭滨区", "陈仓区", "岐山县", "眉县", "凤县", "太白县", "临渭区",
  "华州区", "潼关县", "华阴市", "城固县", "洋县", "勉县", "略阳县",
  "留坝县", "佛坪县", "汉滨区", "汉阴县", "石泉县", "商州区", "洛南县",
  "商南县", "山阳县", "镇安县", "灞桥区", "临潼区", "汉台区", "西乡县",
  "宁强县", "紫阳县", "岚皋县", "旬阳县"
]

// 县域中心点坐标（简化版本，实际应使用GeoJSON）
const COUNTY_CENTERS = {
  "宁陕县": [108.3, 33.3],
  "丹凤县": [110.3, 33.7],
  "柞水县": [109.1, 33.7],
  "长安区": [108.9, 34.2],
  "鄠邑区": [108.6, 34.1],
  "蓝田县": [109.3, 34.2],
  "周至县": [108.2, 34.2],
  "渭滨区": [107.1, 34.4],
  "陈仓区": [107.4, 34.4],
  "岐山县": [107.6, 34.4],
  "眉县": [107.8, 34.3],
  "凤县": [106.5, 33.9],
  "太白县": [107.3, 34.0],
  "临渭区": [109.5, 34.5],
  "华州区": [109.8, 34.5],
  "潼关县": [110.2, 34.5],
  "华阴市": [110.1, 34.6],
  "城固县": [107.3, 33.2],
  "洋县": [107.5, 33.2],
  "勉县": [106.7, 33.2],
  "略阳县": [106.2, 33.3],
  "留坝县": [106.9, 33.6],
  "佛坪县": [108.0, 33.5],
  "汉滨区": [109.0, 32.7],
  "汉阴县": [108.5, 32.9],
  "石泉县": [108.3, 33.0],
  "商州区": [109.9, 33.9],
  "洛南县": [110.1, 34.1],
  "商南县": [110.9, 33.5],
  "山阳县": [109.9, 33.5],
  "镇安县": [109.2, 33.4],
  "灞桥区": [109.1, 34.3],
  "临潼区": [109.2, 34.4],
  "汉台区": [107.0, 33.1],
  "西乡县": [107.8, 33.0],
  "宁强县": [106.3, 32.8],
  "紫阳县": [108.5, 32.5],
  "岚皋县": [108.9, 32.3],
  "旬阳县": [109.4, 32.8]
}

// 加载库
let librariesAvailable = false
let fromArrayBufferFunc = null
let turf = null
let proj4 = null

async function loadLibraries() {
  if (librariesAvailable) return true
  try {
    // 加载 geotiff
    const geotiff = await import('geotiff')
    if (typeof geotiff.fromArrayBuffer === 'function') {
      fromArrayBufferFunc = geotiff.fromArrayBuffer
    } else if (geotiff.default && typeof geotiff.default.fromArrayBuffer === 'function') {
      fromArrayBufferFunc = geotiff.default.fromArrayBuffer
    } else {
      throw new Error('无法找到 fromArrayBuffer')
    }
    
    // 加载 turf
    const turfModule = await import('@turf/turf')
    turf = turfModule
    
    // 加载 proj4
    const proj4Module = await import('proj4')
    proj4 = proj4Module.default || proj4Module
    
    librariesAvailable = true
    console.log('✅ 库加载成功')
    return true
  } catch (error) {
    console.error('❌ 库加载失败:', error.message)
    librariesAvailable = false
    return false
  }
}

// 下载文件
async function downloadFile(fileID) {
  const res = await cloud.downloadFile({ fileID })
  return res.fileContent
}

// 确保云数据库集合存在，不存在则创建
async function ensureCollections() {
  const collections = ['carbon_data', 'image_map', 'upload_records']
  const db = cloud.database()
  
  for (const name of collections) {
    try {
      // 尝试查询来检测集合是否存在
      await db.collection(name).limit(1).get()
      console.log(`集合 ${name} 已存在`)
    } catch (err) {
      if (err.errCode === -502005) {
        // 集合不存在，创建它
        try {
          await db.createCollection(name)
          console.log(`已创建集合: ${name}`)
        } catch (createErr) {
          console.log(`创建集合 ${name} 失败:`, createErr.message)
        }
      }
    }
  }
}

// 从云存储加载县域边界数据
async function loadCountyGeoJSON() {
  try {
    // 尝试从云存储下载县域边界文件
    const res = await cloud.downloadFile({
      fileID: 'cloud://cloudbase-8gdof83j7fdc6094.636c-cloudbase-8gdof83j7fdc6094/qinling-carbon-data/boundaries/qinling.geojson'
    })
    const geojsonStr = res.fileContent.toString('utf-8')
    const geojson = JSON.parse(geojsonStr)
    console.log(`从云存储加载县域边界数据，包含 ${geojson.features.length} 个要素`)
    return geojson
  } catch (error) {
    console.log('无法从云存储加载县域边界数据，使用简化版本:', error.message)
    return createSimplifiedCountyGeoJSON()
  }
}

// 创建简化的县域GeoJSON（基于中心点）
function createSimplifiedCountyGeoJSON() {
  const features = COUNTY_NAMES.map(name => {
    const center = COUNTY_CENTERS[name] || [108.0, 33.5]
    // 创建一个简化的多边形（围绕中心点的小正方形）
    const size = 0.1 // 大约10公里
    const coordinates = [[
      [center[0] - size, center[1] - size],
      [center[0] + size, center[1] - size],
      [center[0] + size, center[1] + size],
      [center[0] - size, center[1] + size],
      [center[0] - size, center[1] - size]
    ]]
    
    return {
      type: 'Feature',
      properties: { NAME: name },
      geometry: {
        type: 'Polygon',
        coordinates: coordinates
      }
    }
  })
  
  return {
    type: 'FeatureCollection',
    features: features
  }
}

// 简化方案：不依赖geotiff/turf/proj4，直接用geotiff库读取原始栅格数据
// 如果geotiff库也不可用，则使用全局统计值估算各县数据
async function processTifSimple(fileContent, year, month) {
  console.log(`简化模式处理 ${year}年${month}月 的TIF文件`)
  
  // 尝试使用 geotiff 库读取基本数据
  let globalStats = null
  let countyData = {}
  
  try {
    // 尝试加载 geotiff
    const geotiff = await import('geotiff')
    let fromArrayBufferFunc = null
    if (typeof geotiff.fromArrayBuffer === 'function') {
      fromArrayBufferFunc = geotiff.fromArrayBuffer
    } else if (geotiff.default && typeof geotiff.default.fromArrayBuffer === 'function') {
      fromArrayBufferFunc = geotiff.default.fromArrayBuffer
    }
    
    if (fromArrayBufferFunc) {
      // 可以读取TIF，提取全局统计
      const arrayBuffer = fileContent.buffer ? fileContent.buffer : fileContent
      const tiff = await fromArrayBufferFunc(arrayBuffer)
      const image = await tiff.getImage()
      const width = image.getWidth()
      const height = image.getHeight()
      console.log(`TIF尺寸: ${width}x${height}`)
      
      // 采样读取数据（每隔一定像素采样一次，提高性能）
      const sampleStep = Math.max(1, Math.floor(Math.sqrt(width * height / 10000)))
      const data = await image.readRasters({ samples: [0] })
      const dataArray = data[0]
      
      let validCount = 0
      let sum = 0
      let min = Infinity
      let max = -Infinity
      
      for (let i = 0; i < dataArray.length; i += sampleStep) {
        const value = dataArray[i]
        if (value !== CONFIG.NODATA_VALUE && value !== -9999.0 && !isNaN(value) && value !== null) {
          validCount++
          sum += value
          if (value < min) min = value
          if (value > max) max = value
        }
      }
      
      if (validCount > 0) {
        globalStats = {
          mean: sum / validCount,
          min: min,
          max: max,
          validPixels: validCount * sampleStep * sampleStep // 估算总有效像素
        }
        console.log('全局统计:', globalStats)
      }
    }
  } catch (err) {
    console.log('简化模式也无法读取TIF文件:', err.message)
  }
  
  // 基于全局统计估算各县数据
  // 简化模式没有GeoJSON边界，只能基于全局均值做粗略估算
  // 注意：这种估算方式精度有限，建议优先使用GeoJSON边界的完整提取模式
  if (globalStats && globalStats.mean !== 0) {
    // 直接使用TIF像素均值作为县域碳汇值的估算基础
    // TIF中的NEP值就是碳汇量，单位与县域数据一致
    const tifMean = globalStats.mean
    
    COUNTY_NAMES.forEach(name => {
      const center = COUNTY_CENTERS[name]
      if (!center) return
      // 基于纬度和经度的微调权重（秦岭核心区域碳汇更高）
      const latWeight = 1 + (center[1] - 33.0) * 0.1
      const lngWeight = 1 + Math.abs(center[0] - 108.5) * 0.05
      const estimatedValue = tifMean * latWeight * lngWeight
      countyData[name] = parseFloat(estimatedValue.toFixed(CONFIG.DECIMAL_PLACES))
    })
  } else {
    COUNTY_NAMES.forEach(name => {
      countyData[name] = 0
    })
  }
  
  const validCounties = Object.values(countyData).filter(v => v !== 0).length
  
  return {
    year,
    month,
    countyData,
    totalCounties: COUNTY_NAMES.length,
    validCounties: validCounties
  }
}

// 基于传入的统计数据估算县域碳汇数据（无需下载和解析TIF文件）
function estimateCountyDataFromStats(stats, year, month) {
  if (!stats) {
    return { year, month, countyData: {}, totalCounties: COUNTY_NAMES.length, validCounties: 0 }
  }
  
  // 从 stats 中获取 mean 值，兼容两种格式
  const meanValue = stats.carbon_sink_mean || stats.mean || 0
  console.log(`基于统计数据估算县域碳汇数据, mean=${meanValue}`)
  
  if (meanValue === 0) {
    const countyData = {}
    COUNTY_NAMES.forEach(name => { countyData[name] = 0 })
    return { year, month, countyData, totalCounties: COUNTY_NAMES.length, validCounties: 0 }
  }
  
  // 直接使用TIF统计均值作为县域碳汇值的基础
  // TIF中的NEP像素值就是碳汇量，与县域数据单位一致，不需要额外缩放
  const tifMean = meanValue
  
  const countyData = {}
  COUNTY_NAMES.forEach(name => {
    const center = COUNTY_CENTERS[name]
    if (!center) return
    // 基于纬度和经度的微调权重（秦岭核心区域碳汇更高）
    const latWeight = 1 + (center[1] - 33.0) * 0.08
    const lngWeight = 1 + Math.abs(center[0] - 108.5) * 0.03
    const estimatedValue = tifMean * latWeight * lngWeight
    countyData[name] = parseFloat(estimatedValue.toFixed(CONFIG.DECIMAL_PLACES))
  })
  
  const validCounties = Object.values(countyData).filter(v => v !== 0).length
  console.log(`估算完成: ${validCounties}个县域有有效数据`)
  
  return {
    year,
    month,
    countyData,
    totalCounties: COUNTY_NAMES.length,
    validCounties: validCounties
  }
}

// 获取栅格的地理参考信息
function getRasterGeoInfo(image) {
  const fileDirectory = image.getFileDirectory()
  
  // 尝试获取地理变换参数
  let geoTransform = null
  
  if (fileDirectory.ModelTransformation) {
    const m = fileDirectory.ModelTransformation
    geoTransform = [m[0], m[1], m[3], m[4], m[5], m[7]]
  } else if (fileDirectory.GeoTransform) {
    geoTransform = fileDirectory.GeoTransform
  } else if (fileDirectory.ModelPixelScale && fileDirectory.ModelTiepoint) {
    const scale = fileDirectory.ModelPixelScale
    const tiepoint = fileDirectory.ModelTiepoint
    geoTransform = [
      tiepoint[3], scale[0], 0,
      tiepoint[4], 0, -scale[1]
    ]
  }
  
  // 获取坐标系
  let crs = null
  if (fileDirectory.ProjectedCSTypeGeoKey) {
    crs = `EPSG:${fileDirectory.ProjectedCSTypeGeoKey}`
  } else if (fileDirectory.GeographicTypeGeoKey) {
    crs = `EPSG:${fileDirectory.GeographicTypeGeoKey}`
  }
  
  return { geoTransform, crs }
}

// 坐标转换：像素坐标到地理坐标
// GeoTIFF标准geoTransform格式: [originX, pixelWidth, rotationX, originY, rotationY, pixelHeight]
// 对于北朝上的影像: rotationX=0, rotationY=0, pixelHeight为负值
function pixelToGeo(col, row, geoTransform) {
  if (!geoTransform) return [col, row]
  
  const [originX, pixelWidth, rotationX, originY, rotationY, pixelHeight] = geoTransform
  const geoX = originX + col * pixelWidth + row * rotationX
  const geoY = originY + col * rotationY + row * pixelHeight
  return [geoX, geoY]
}

// 坐标转换：地理坐标到像素坐标
function geoToPixel(geoX, geoY, geoTransform) {
  if (!geoTransform) return [geoX, geoY]
  
  const [originX, pixelWidth, rotationX, originY, rotationY, pixelHeight] = geoTransform
  
  // 对于北朝上的影像(rotationX=0, rotationY=0)，可以简化计算
  if (Math.abs(rotationX) < 1e-10 && Math.abs(rotationY) < 1e-10) {
    const col = (geoX - originX) / pixelWidth
    const row = (geoY - originY) / pixelHeight
    return [col, row]
  }
  
  // 通用情况：解2x2线性方程组
  const det = pixelWidth * pixelHeight - rotationX * rotationY
  if (Math.abs(det) < 1e-10) {
    return [geoX, geoY]
  }
  
  const col = (pixelHeight * (geoX - originX) - rotationX * (geoY - originY)) / det
  const row = (-rotationY * (geoX - originX) + pixelWidth * (geoY - originY)) / det
  
  return [col, row]
}

// 高效射线法判断点是否在多边形内（替代turf.booleanPointInPolygon）
function isPointInPolygon(px, py, polygon) {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]
    const xj = polygon[j][0], yj = polygon[j][1]
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

// 提取单个县域的碳汇数据
function extractCountyCarbonData(imageWidth, imageHeight, rasterData, rasterWidth, startX, startY, countyFeature, geoTransform) {
  const countyName = countyFeature.properties.NAME
  
  const geometry = countyFeature.geometry
  if (geometry.type !== 'Polygon') {
    return { countyName, meanValue: null, validPixels: 0 }
  }
  
  // 使用简化的bbox计算（不依赖turf）
  const coords = geometry.coordinates[0]
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const c of coords) {
    if (c[0] < minLng) minLng = c[0]
    if (c[0] > maxLng) maxLng = c[0]
    if (c[1] < minLat) minLat = c[1]
    if (c[1] > maxLat) maxLat = c[1]
  }
  
  // 将地理边界框的四个角转换到像素坐标
  const [tlCol, tlRow] = geoToPixel(minLng, maxLat, geoTransform)
  const [brCol, brRow] = geoToPixel(maxLng, minLat, geoTransform)
  
  const minPixelCol = Math.min(tlCol, brCol)
  const maxPixelCol = Math.max(tlCol, brCol)
  const minPixelRow = Math.min(tlRow, brRow)
  const maxPixelRow = Math.max(tlRow, brRow)
  
  // 确保边界框在图像范围内
  const sX = Math.max(0, Math.floor(minPixelCol))
  const eX = Math.min(imageWidth - 1, Math.ceil(maxPixelCol))
  const sY = Math.max(0, Math.floor(minPixelRow))
  const eY = Math.min(imageHeight - 1, Math.ceil(maxPixelRow))
  
  if (sX >= eX || sY >= eY) {
    return { countyName, meanValue: null, validPixels: 0 }
  }
  
  // 采样步长（至少每隔3个像素采一个，加快速度）
  const samplingStep = Math.max(3, Math.floor(1 / CONFIG.SAMPLING_RATIO))
  
  // 预提取多边形坐标用于射线法
  const polygon = coords
  
  let validPixels = 0
  let sum = 0
  
  for (let row = sY; row <= eY; row += samplingStep) {
    for (let col = sX; col <= eX; col += samplingStep) {
      // 从rasterData中读取值（rasterData是整个图像的数据）
      const idx = row * imageWidth + col
      if (idx >= rasterData.length) continue
      
      const value = rasterData[idx]
      
      // 跳过无效值
      if (value === CONFIG.NODATA_VALUE || value === -9999.0 || isNaN(value) || value === null) {
        continue
      }
      
      // 计算当前像素的地理坐标
      const [geoX, geoY] = pixelToGeo(col, row, geoTransform)
      
      // 用射线法判断点是否在多边形内
      if (isPointInPolygon(geoX, geoY, polygon)) {
        validPixels++
        sum += value
      }
    }
  }
  
  if (validPixels === 0) {
    return { countyName, meanValue: null, validPixels: 0 }
  }
  
  const meanValue = sum / validPixels
  return {
    countyName,
    meanValue: parseFloat(meanValue.toFixed(CONFIG.DECIMAL_PLACES)),
    validPixels
  }
}

// 处理TIF文件，提取所有县域数据
async function processTifForCounties(fileContent, year, month) {
  console.log(`开始处理 ${year}年${month}月 的TIF文件`)
  
  const arrayBuffer = fileContent.buffer ? fileContent.buffer : fileContent
  const tiff = await fromArrayBufferFunc(arrayBuffer)
  const image = await tiff.getImage()
  
  const width = image.getWidth()
  const height = image.getHeight()
  console.log(`栅格尺寸: ${width}x${height}`)
  
  // 获取地理参考信息
  const geoInfo = getRasterGeoInfo(image)
  console.log('地理参考信息:', geoInfo)
  
  // 一次性读取整个栅格数据（避免逐县域反复调用readRasters导致超时）
  console.log('读取栅格数据...')
  const data = await image.readRasters({ samples: [0] })
  const rasterData = data[0]
  console.log(`栅格数据读取完成，共 ${rasterData.length} 个像素`)
  
  // 加载县域边界数据
  const countyGeoJSON = await loadCountyGeoJSON()
  console.log(`加载了 ${countyGeoJSON.features.length} 个县域`)
  
  if (countyGeoJSON.features.length === 0) {
    throw new Error('未找到县域边界数据')
  }
  
  // 处理每个县域（纯内存计算，不再调用image.readRasters）
  const countyResults = []
  for (const feature of countyGeoJSON.features) {
    const result = extractCountyCarbonData(width, height, rasterData, width, 0, 0, feature, geoInfo.geoTransform)
    countyResults.push(result)
    
    // 每处理10个县输出一次进度
    if (countyResults.length % 10 === 0) {
      console.log(`已处理 ${countyResults.length}/${countyGeoJSON.features.length} 个县域`)
    }
  }
  
  // processTifForCounties 通过县域边界提取的像素均值就是正确的碳汇值
  // 不需要额外缩放，直接使用提取结果
  console.log('使用GeoJSON边界提取的县域碳汇数据，无需缩放')
  
  // 转换为字典格式
  const countyData = {}
  countyResults.forEach(result => {
    if (result.meanValue !== null) {
      countyData[result.countyName] = parseFloat(result.meanValue.toFixed(CONFIG.DECIMAL_PLACES))
    }
  })
  
  return {
    year,
    month,
    totalCounties: countyResults.length,
    validCounties: Object.keys(countyData).length,
    geoInfo: geoInfo,
    countyData
  }
}

// 保存数据到云数据库
async function saveCarbonData(data) {
  const db = cloud.database()
  const { year, month, countyData } = data
  
  try {
    // 检查是否已存在该年月的数据
    const queryResult = await db.collection('carbon_data').where({
      year: year,
      month: month
    }).get()
    
    if (queryResult.data.length > 0) {
      // 更新现有记录
      const recordId = queryResult.data[0]._id
      await db.collection('carbon_data').doc(recordId).update({
        data: {
          countyData,
          updatedAt: new Date()
        }
      })
      console.log(`更新了记录: ${year}年${month}月`)
    } else {
      // 创建新记录
      await db.collection('carbon_data').add({
        data: {
          year,
          month,
          countyData,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      console.log(`创建了新记录: ${year}年${month}月`)
    }
    
    return true
  } catch (error) {
    console.error('保存数据失败:', error)
    // 如果数据库操作失败，也可以将数据保存到云存储
    try {
      const dataStr = JSON.stringify(data, null, 2)
      const buffer = Buffer.from(dataStr, 'utf-8')
      const cloudPath = `qinling-carbon-data/carbon-json/${year}_${month}.json`
      await cloud.uploadFile({
        cloudPath: cloudPath,
        fileContent: buffer
      })
      console.log(`数据已保存到云存储: ${cloudPath}`)
      return true
    } catch (uploadError) {
      console.error('云存储保存也失败:', uploadError)
      return false
    }
  }
}

// ============================================
// 新增：列出所有已上传的数据（PNG和碳汇数据）
// ============================================
async function listUploadedData() {
  const db = cloud.database()
  const result = {
    pngImages: [],
    carbonRecords: []
  }

  try {
    // 1. 从图片映射表（本地存储的云存储版本）列出PNG图片
    // 尝试从云数据库的 image_map 集合获取
    try {
      const imageMapResult = await db.collection('image_map').limit(1000).get()
      const imageMapData = imageMapResult.data || []
      
      imageMapData.forEach(record => {
        if (record.year && record.month && record.fileID) {
          result.pngImages.push({
            year: record.year,
            month: record.month,
            fileID: record.fileID,
            cloudPath: record.cloudPath || '',
            uploadTime: record.createdAt || ''
          })
        }
      })
    } catch (err) {
      console.log('image_map集合不存在或查询失败:', err.message)
    }

    // 2. 从 carbon_data 集合获取碳汇数据记录
    try {
      const carbonResult = await db.collection('carbon_data')
        .orderBy('year', 'asc')
        .orderBy('month', 'asc')
        .limit(1000)
        .get()
      
      const carbonData = carbonResult.data || []
      
      carbonData.forEach(record => {
        result.carbonRecords.push({
          _id: record._id,
          year: record.year,
          month: record.month,
          validCounties: record.countyData ? Object.keys(record.countyData).length : 0,
          countyData: record.countyData || {},
          updatedAt: record.updatedAt || ''
        })
      })
    } catch (err) {
      console.log('carbon_data集合查询失败:', err.message)
    }

    // 3. 如果数据库无数据，尝试从云存储列出文件
    if (result.pngImages.length === 0) {
      try {
        const cloudFiles = await listCloudStorageFiles('qinling-carbon-data/images/')
        result.pngImages = cloudFiles.map(f => {
          // 从文件名解析年份和月份
          const parseResult = parseFileName(f.name || f.cloudPath || '')
          return {
            year: parseResult.year,
            month: parseResult.month,
            fileID: f.fileID || '',
            cloudPath: f.cloudPath || f.name || '',
            uploadTime: ''
          }
        }).filter(f => f.year && f.month)
      } catch (err) {
        console.log('云存储文件列表获取失败:', err.message)
      }
    }

    // 按年份月份排序
    result.pngImages.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })
    result.carbonRecords.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })

    return result
  } catch (error) {
    console.error('列出数据失败:', error)
    return result
  }
}

// 从文件名解析年份和月份
function parseFileName(fileName) {
  let year = null, month = null
  
  // 格式1: nep202301.png
  const match1 = fileName.match(/nep(\d{4})(\d{2})\./i)
  if (match1) {
    year = parseInt(match1[1])
    month = parseInt(match1[2])
  }
  
  // 格式2: 2023_1.png 或 2023_01.png
  if (!year) {
    const match2 = fileName.match(/(\d{4})_(\d{1,2})\./)
    if (match2) {
      year = parseInt(match2[1])
      month = parseInt(match2[2])
    }
  }
  
  return { year, month }
}

// 列出云存储指定前缀下的文件
async function listCloudStorageFiles(prefix) {
  try {
    const result = await cloud.getTempFileURL({
      fileList: []
    })
    return []
  } catch (err) {
    console.log('列出云存储文件失败:', err.message)
    return []
  }
}

// ============================================
// 新增：删除指定年月的PNG图和碳汇数据
// ============================================
async function deleteDataByYearMonth(year, month, deletePng, deleteCarbon) {
  const results = {
    pngDeleted: false,
    carbonDeleted: false,
    errors: []
  }

  const db = cloud.database()
  const monthStr = month < 10 ? '0' + month : String(month)

  // 1. 删除PNG图片
  if (deletePng) {
    try {
      // 从 image_map 中查找记录
      const imageMapResult = await db.collection('image_map').where({
        year: year,
        month: month
      }).get()

      const fileIDsToDelete = []
      
      if (imageMapResult.data.length > 0) {
        imageMapResult.data.forEach(record => {
          if (record.fileID) {
            fileIDsToDelete.push(record.fileID)
          }
        })
        // 删除 image_map 记录
        for (const record of imageMapResult.data) {
          await db.collection('image_map').doc(record._id).remove()
        }
      }

      // 也尝试构造可能的云存储路径
      const possiblePaths = [
        `qinling-carbon-data/images/nep${year}${monthStr}.png`,
        `qinling-carbon-data/images/${year}_${month}.png`
      ]

      // 删除云存储文件
      if (fileIDsToDelete.length > 0) {
        try {
          await cloud.deleteFile({
            fileList: fileIDsToDelete
          })
          results.pngDeleted = true
          console.log(`已删除PNG图片: ${fileIDsToDelete.join(', ')}`)
        } catch (err) {
          results.errors.push(`删除PNG云文件失败: ${err.message}`)
        }
      }

      // 尝试删除已知路径的文件
      for (const cloudPath of possiblePaths) {
        try {
          // 先获取文件ID
          const tempUrlResult = await cloud.getTempFileURL({
            fileList: [{ fileID: cloudPath, maxAge: 60 }]
          })
          if (tempUrlResult.fileList && tempUrlResult.fileList[0] && tempUrlResult.fileList[0].status === 0) {
            await cloud.deleteFile({
              fileList: [cloudPath]
            })
            results.pngDeleted = true
            console.log(`已删除PNG文件: ${cloudPath}`)
          }
        } catch (err) {
          // 文件可能不存在，忽略
        }
      }

      // 同时删除TIF原始文件
      try {
        const tifCloudPath = `qinling-carbon-data/tif/${year}_${month}`
        // 尝试删除（如果存在）
        const tifFiles = await db.collection('upload_records').where({
          year: year,
          month: month,
          type: 'tif'
        }).get()
        
        for (const record of tifFiles.data) {
          if (record.fileId && record.fileId.startsWith('cloud://')) {
            try {
              await cloud.deleteFile({ fileList: [record.fileId] })
            } catch (e) {
              // 忽略
            }
          }
          await db.collection('upload_records').doc(record._id).remove()
        }
      } catch (err) {
        // 忽略TIF删除错误
      }

    } catch (err) {
      results.errors.push(`删除PNG过程出错: ${err.message}`)
    }
  }

  // 2. 删除碳汇数据
  if (deleteCarbon) {
    try {
      // 从 carbon_data 集合删除
      const carbonResult = await db.collection('carbon_data').where({
        year: year,
        month: month
      }).get()

      for (const record of carbonResult.data) {
        await db.collection('carbon_data').doc(record._id).remove()
      }

      if (carbonResult.data.length > 0) {
        results.carbonDeleted = true
        console.log(`已删除碳汇数据: ${year}年${month}月`)
      }

      // 同时删除云存储中的JSON文件
      try {
        const jsonCloudPath = `qinling-carbon-data/json/${year}_${month}.json`
        await cloud.deleteFile({
          fileList: [jsonCloudPath]
        })
      } catch (err) {
        // JSON文件可能不存在，忽略
      }

    } catch (err) {
      results.errors.push(`删除碳汇数据出错: ${err.message}`)
    }
  }

  return results
}

// ============================================
// 新增：获取所有年月的统计摘要（用于首页图表）
// ============================================
async function getCarbonSummary() {
  const db = cloud.database()
  const summary = []

  try {
    // 从 carbon_data 获取所有记录
    const result = await db.collection('carbon_data')
      .limit(1000)
      .get()
    
    const records = result.data || []
    
    records.forEach(record => {
      const countyData = record.countyData || {}
      const values = Object.values(countyData)
      
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length
        const max = Math.max(...values)
        const min = Math.min(...values)
        
        summary.push({
          year: record.year,
          month: record.month,
          meanValue: parseFloat(mean.toFixed(2)),
          maxValue: parseFloat(max.toFixed(2)),
          minValue: parseFloat(min.toFixed(2)),
          countyCount: values.length
        })
      }
    })
    
    // 按年份月份排序
    summary.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })
    
  } catch (err) {
    console.log('获取碳汇摘要失败:', err.message)
  }

  return summary
}

// 主函数
exports.main = async (event, context) => {
  const { fileID, year, month, fileName, mode = 'extract', stats } = event
  console.log('调用参数:', { fileID, year, month, fileName, mode, hasStats: !!stats })

  try {
    // 根据mode参数执行不同操作
    switch (mode) {
      case 'extract': {
        // 原有的TIF提取功能
        if (!fileID || !year || !month) {
          throw new Error('缺少必要参数: fileID, year, month')
        }
        
        // 确保云数据库集合存在
        await ensureCollections()
        
        console.log('加载库...')
        await loadLibraries()
        
        if (librariesAvailable) {
          // 库加载成功，下载TIF并使用完整的县域级碳汇数据提取
          console.log('下载TIF文件...')
          const fileContent = await downloadFile(fileID)
          console.log(`下载完成，大小: ${fileContent.length} bytes`)
          
          console.log('开始提取县域碳汇数据...')
          let extractedData = null
          try {
            extractedData = await processTifForCounties(fileContent, year, month)
            console.log(`数据提取完成: ${extractedData.validCounties}/${extractedData.totalCounties} 个县域有有效数据`)
          } catch (extractErr) {
            console.error('完整提取失败:', extractErr.message)
          }
          
          // 如果完整提取失败或无有效数据，尝试用简化模式
          if (!extractedData || extractedData.validCounties === 0) {
            console.log('完整提取无有效数据，尝试简化模式...')
            try {
              extractedData = await processTifSimple(fileContent, year, month)
              console.log(`简化模式完成: ${extractedData.validCounties}/${extractedData.totalCounties} 个县域有有效数据`)
            } catch (simpleErr) {
              console.error('简化模式也失败:', simpleErr.message)
            }
          }
          
          // 如果简化模式也无有效数据，使用统计估算
          if (!extractedData || extractedData.validCounties === 0) {
            if (stats) {
              console.log('使用传入的统计数据估算县域碳汇数据...')
              extractedData = estimateCountyDataFromStats(stats, year, month)
            } else {
              extractedData = { year, month, countyData: {}, totalCounties: COUNTY_NAMES.length, validCounties: 0 }
            }
          }
          
          console.log('保存数据...')
          const saveResult = await saveCarbonData(extractedData)
          
          return {
            success: true,
            data: {
              message: '碳汇数据提取完成',
              year,
              month,
              countyData: extractedData.countyData,
              totalCounties: extractedData.totalCounties,
              validCounties: extractedData.validCounties,
              saved: saveResult,
              geoInfo: extractedData.geoInfo || null,
              mode: extractedData.validCounties > 0 ? (extractedData.geoInfo ? 'full' : 'estimated') : 'failed'
            }
          }
        } else {
          // 库加载失败，使用传入的统计数据估算县域数据
          console.log('库加载失败，使用统计数据估算县域碳汇数据...')
          const estimatedData = estimateCountyDataFromStats(stats, year, month)
          
          if (estimatedData.validCounties > 0) {
            console.log('保存估算数据...')
            const saveResult = await saveCarbonData(estimatedData)
            
            return {
              success: true,
              data: {
                message: '碳汇数据提取完成（统计估算模式）',
                year,
                month,
                countyData: estimatedData.countyData,
                totalCounties: estimatedData.totalCounties,
                validCounties: estimatedData.validCounties,
                saved: saveResult,
                mode: 'estimated'
              }
            }
          } else {
            return {
              success: true,
              data: {
                message: '无法提取碳汇数据（无统计数据）',
                year,
                month,
                countyData: {},
                totalCounties: COUNTY_NAMES.length,
                validCounties: 0,
                mode: 'failed'
              }
            }
          }
        }
      }

      case 'list': {
        // 列出所有已上传的数据
        const listResult = await listUploadedData()
        return {
          success: true,
          data: listResult
        }
      }

      case 'delete': {
        // 删除指定年月的数据
        if (!year || !month) {
          throw new Error('缺少必要参数: year, month')
        }
        const deletePng = event.deletePng !== false // 默认删除PNG
        const deleteCarbon = event.deleteCarbon !== false // 默认删除碳汇数据
        const deleteResult = await deleteDataByYearMonth(year, month, deletePng, deleteCarbon)
        return {
          success: true,
          data: deleteResult
        }
      }

      case 'summary': {
        // 获取碳汇数据摘要
        const summaryData = await getCarbonSummary()
        return {
          success: true,
          data: summaryData
        }
      }

      case 'sync_to_web': {
        // 从云数据库读取所有碳汇数据，与GitHub Pages现有数据合并后推送
        console.log('开始同步数据到网页...')
        const webDb = cloud.database()

        // 1. 先从GitHub Pages获取现有的carbonData2.json作为基础数据（保留历史数据）
        let baseData = {}
        const githubToken = event.githubToken || ''
        if (githubToken) {
          try {
            console.log('获取GitHub Pages现有数据...')
            const getRes = await httpsRequest({
              hostname: 'api.github.com',
              path: '/repos/gangshangka/qinling-carbon-3d/contents/carbonData2.json',
              method: 'GET',
              headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'qinling-carbon-app'
              }
            })
            if (getRes.statusCode === 200 && getRes.data && getRes.data.content) {
              const decoded = Buffer.from(getRes.data.content, 'base64').toString('utf-8')
              baseData = JSON.parse(decoded)
              console.log(`获取到现有数据，包含年份: ${Object.keys(baseData).sort().join(', ')}`)
            } else {
              console.log('GitHub上无现有数据或获取失败，将从空数据开始')
            }
          } catch (fetchErr) {
            console.log('获取GitHub现有数据失败，将从空数据开始:', fetchErr.message)
          }
        } else {
          console.log('未提供GitHub Token，无法获取现有数据')
          // 尝试从云存储获取现有数据
          try {
            const downloadUrl = 'https://cloudbase-8gdof83j7fdc6094.tcb.qcloud.la/qinling-carbon-data/web/carbonData2.json'
            console.log('尝试从云存储获取现有数据...')
            const cloudRes = await httpsRequest({
              hostname: 'cloudbase-8gdof83j7fdc6094.tcb.qcloud.la',
              path: '/qinling-carbon-data/web/carbonData2.json',
              method: 'GET',
              headers: { 'User-Agent': 'qinling-carbon-app' }
            })
            if (cloudRes.statusCode === 200 && cloudRes.data && typeof cloudRes.data === 'object') {
              baseData = cloudRes.data
              console.log(`从云存储获取到数据，包含年份: ${Object.keys(baseData).sort().join(', ')}`)
            }
          } catch (cloudFetchErr) {
            console.log('从云存储获取现有数据失败:', cloudFetchErr.message)
          }
        }

        // 2. 读取云数据库中的 carbon_data 记录
        let allRecords = []
        let webBatch = 0
        const webLimit = 100
        while (true) {
          const webResult = await webDb.collection('carbon_data').skip(webBatch * webLimit).limit(webLimit).get()
          allRecords = allRecords.concat(webResult.data || [])
          if ((webResult.data || []).length < webLimit) break
          webBatch++
          if (webBatch >= 20) break
        }
        console.log(`读取到 ${allRecords.length} 条云数据库碳汇数据记录`)

        // 3. 在基础数据上合并云数据库的新数据（云数据库数据优先覆盖）
        const webData = { ...baseData }
        for (const record of allRecords) {
          const yearStr = String(record.year)
          const monthStr = String(record.month)
          const countyData = record.countyData || {}

          if (!webData[yearStr]) webData[yearStr] = {}
          webData[yearStr][monthStr] = countyData
        }
        console.log(`合并后数据包含年份: ${Object.keys(webData).sort().join(', ')}`)

        const webDataStr = JSON.stringify(webData)

        // 1. 上传到云存储（公开可访问，供网页直接加载）
        let cloudStorageUploaded = false
        let cloudFileUrl = ''
        try {
          const cloudPath = 'qinling-carbon-data/web/carbonData2.json'
          const uploadResult = await cloud.uploadFile({
            cloudPath: cloudPath,
            fileContent: Buffer.from(webDataStr)
          })
          console.log('云存储上传成功:', uploadResult.fileID)

          // 获取下载URL
          try {
            const urlResult = await cloud.getTempFileURL({
              fileList: [uploadResult.fileID]
            })
            if (urlResult.fileList && urlResult.fileList[0] && urlResult.fileList[0].tempFileURL) {
              cloudFileUrl = urlResult.fileList[0].tempFileURL
              console.log('云存储文件URL:', cloudFileUrl)
            }
          } catch (urlErr) {
            console.log('获取云存储URL失败:', urlErr.message)
          }

          cloudStorageUploaded = true
        } catch (uploadErr) {
          console.error('云存储上传失败:', uploadErr.message)
        }

        // 2. 推送到GitHub Pages
        let githubResult = null
        if (githubToken) {
          try {
            console.log('开始推送到GitHub...')
            githubResult = await pushToGithub(
              githubToken,
              'gangshangka/qinling-carbon-3d',
              'carbonData2.json',
              webDataStr,
              `update: 同步碳汇数据 ${new Date().toLocaleString('zh-CN')}`
            )
            console.log('GitHub推送结果:', githubResult.statusCode)
          } catch (ghErr) {
            console.error('GitHub推送异常:', ghErr.message)
            githubResult = { statusCode: 0, error: ghErr.message }
          }
        } else {
          console.log('未提供GitHub Token，跳过推送')
          githubResult = { statusCode: 0, skipped: true }
        }

        const pushed = githubResult && (githubResult.statusCode === 200 || githubResult.statusCode === 201)

        return {
          success: true,
          data: {
            message: pushed ? '数据已同步到GitHub Pages网页' : (githubResult.skipped ? '未提供Token' : 'GitHub推送失败'),
            baseDataYears: Object.keys(baseData).sort(),
            cloudDbRecordCount: allRecords.length,
            mergedYears: Object.keys(webData).sort(),
            githubPushed: pushed,
            githubStatus: githubResult ? githubResult.statusCode : 0,
            githubError: githubResult && githubResult.data && githubResult.data.message ? githubResult.data.message : '',
            cloudStorageUploaded: cloudStorageUploaded,
            cloudFileUrl: cloudFileUrl
          }
        }
      }

      default:
        throw new Error(`不支持的模式: ${mode}，支持的模式: extract, list, delete, summary, sync_to_web`)
    }
  } catch (error) {
    console.error('处理失败:', error)
    return {
      success: false,
      error: error.message,
      stack: error.stack
    }
  }
}
