const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 配置
const CONFIG = {
  NODATA_VALUE: -9999,
  DECIMAL_PLACES: 2,
  // 秦岭区域大致边界（WGS84）
  QINLING_BBOX: [105.0, 32.0, 112.0, 35.0],
  // 采样比例（为性能考虑，可以降低采样率）
  SAMPLING_RATIO: 1.0
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

// 获取栅格的地理参考信息
function getRasterGeoInfo(image) {
  const fileDirectory = image.getFileDirectory()
  
  // 尝试获取地理变换参数
  // ModelTransformation (4x4矩阵) 或 GeoTransform (6个参数)
  let geoTransform = null
  
  if (fileDirectory.ModelTransformation) {
    // 4x4变换矩阵
    const m = fileDirectory.ModelTransformation
    // 简化为仿射变换: [a, b, c, d, e, f]
    // 其中: x_geo = a * x_pixel + b * y_pixel + c
    //       y_geo = d * x_pixel + e * y_pixel + f
    geoTransform = [m[0], m[1], m[3], m[4], m[5], m[7]]
  } else if (fileDirectory.GeoTransform) {
    geoTransform = fileDirectory.GeoTransform
  } else if (fileDirectory.ModelPixelScale && fileDirectory.ModelTiepoint) {
    // 从PixelScale和Tiepoint计算
    const scale = fileDirectory.ModelPixelScale
    const tiepoint = fileDirectory.ModelTiepoint
    // tiepoint: [I, J, K, X, Y, Z]
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
function pixelToGeo(x, y, geoTransform) {
  if (!geoTransform) return [x, y] // 无地理参考
  
  const [a, b, c, d, e, f] = geoTransform
  const geoX = a * x + b * y + c
  const geoY = d * x + e * y + f
  return [geoX, geoY]
}

// 坐标转换：地理坐标到像素坐标
function geoToPixel(geoX, geoY, geoTransform) {
  if (!geoTransform) return [geoX, geoY] // 无地理参考
  
  const [a, b, c, d, e, f] = geoTransform
  // 需要解方程: geoX = a*x + b*y + c, geoY = d*x + e*y + f
  // 计算逆变换
  const det = a * e - b * d
  if (Math.abs(det) < 1e-10) {
    // 无法求逆，返回估计值
    return [geoX, geoY]
  }
  
  const x = (e * (geoX - c) - b * (geoY - f)) / det
  const y = (-d * (geoX - c) + a * (geoY - f)) / det
  
  return [x, y]
}

// 提取单个县域的碳汇数据
async function extractCountyCarbonData(image, countyFeature, geoTransform) {
  const countyName = countyFeature.properties.NAME
  console.log(`提取县域数据: ${countyName}`)
  
  const geometry = countyFeature.geometry
  if (geometry.type !== 'Polygon') {
    console.log(`跳过非多边形几何: ${geometry.type}`)
    return { countyName, meanValue: null, validPixels: 0 }
  }
  
  // 使用Turf计算多边形的边界框
  const bbox = turf.bbox(countyFeature)
  const [minLng, minLat, maxLng, maxLat] = bbox
  
  // 将边界框转换到像素坐标
  const [minPixelX, minPixelY] = geoToPixel(minLng, minLat, geoTransform)
  const [maxPixelX, maxPixelY] = geoToPixel(maxLng, maxLat, geoTransform)
  
  // 确保边界框在图像范围内
  const width = image.getWidth()
  const height = image.getHeight()
  
  const startX = Math.max(0, Math.floor(Math.min(minPixelX, maxPixelX)))
  const endX = Math.min(width - 1, Math.ceil(Math.max(minPixelX, maxPixelX)))
  const startY = Math.max(0, Math.floor(Math.min(minPixelY, maxPixelY)))
  const endY = Math.min(height - 1, Math.ceil(Math.max(minPixelY, maxPixelY)))
  
  if (startX >= endX || startY >= endY) {
    console.log(`边界框超出图像范围: ${countyName}`)
    return { countyName, meanValue: null, validPixels: 0 }
  }
  
  console.log(`边界框: 像素 [${startX}, ${startY}] 到 [${endX}, ${endY}]`)
  
  // 读取边界框区域的数据
  const window = [startX, startY, endX, endY]
  const data = await image.readRasters({ 
    samples: [0],
    window: window
  })
  const dataArray = data[0]
  const windowWidth = endX - startX
  const windowHeight = endY - startY
  
  // 处理数据
  let validPixels = 0
  let sum = 0
  
  // 创建Turf多边形对象用于空间查询
  const turfPolygon = turf.polygon(geometry.coordinates)
  
  // 采样处理：为了性能，可以跳着采样
  const samplingStep = Math.max(1, Math.floor(1 / CONFIG.SAMPLING_RATIO))
  
  for (let y = 0; y < windowHeight; y += samplingStep) {
    for (let x = 0; x < windowWidth; x += samplingStep) {
      const idx = y * windowWidth + x
      if (idx >= dataArray.length) continue
      
      const value = dataArray[idx]
      
      // 跳过无效值
      if (value === CONFIG.NODATA_VALUE || value === -9999.0 || isNaN(value) || value === null) {
        continue
      }
      
      // 计算当前像素的地理坐标
      const pixelX = startX + x
      const pixelY = startY + y
      const [geoX, geoY] = pixelToGeo(pixelX, pixelY, geoTransform)
      
      // 判断点是否在多边形内
      const point = turf.point([geoX, geoY])
      const isInside = turf.booleanPointInPolygon(point, turfPolygon)
      
      if (isInside) {
        validPixels++
        sum += value
      }
    }
  }
  
  // 估算总有效像素数（考虑采样）
  if (samplingStep > 1) {
    validPixels = validPixels * samplingStep * samplingStep
  }
  
  if (validPixels === 0) {
    return { countyName, meanValue: null, validPixels: 0 }
  }
  
  const meanValue = sum / (validPixels / (samplingStep * samplingStep))
  return {
    countyName,
    meanValue: parseFloat(meanValue.toFixed(CONFIG.DECIMAL_PLACES)),
    validPixels: validPixels
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
  
  // 加载县域边界数据
  const countyGeoJSON = await loadCountyGeoJSON()
  console.log(`加载了 ${countyGeoJSON.features.length} 个县域`)
  
  if (countyGeoJSON.features.length === 0) {
    throw new Error('未找到县域边界数据')
  }
  
  // 处理每个县域
  const countyResults = []
  for (const feature of countyGeoJSON.features) {
    const result = await extractCountyCarbonData(image, feature, geoInfo.geoTransform)
    countyResults.push(result)
    
    // 每处理5个县输出一次进度
    if (countyResults.length % 5 === 0) {
      console.log(`已处理 ${countyResults.length}/${countyGeoJSON.features.length} 个县域`)
    }
  }
  
  // 转换为字典格式
  const countyData = {}
  countyResults.forEach(result => {
    if (result.meanValue !== null) {
      countyData[result.countyName] = result.meanValue
    }
  })
  
  return {
    year,
    month,
    countyData,
    totalCounties: countyResults.length,
    validCounties: Object.keys(countyData).length,
    geoInfo: geoInfo
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

// 主函数
exports.main = async (event, context) => {
  const { fileID, year, month, fileName, mode = 'extract' } = event
  console.log('调用参数:', { fileID, year, month, fileName, mode })
  
  try {
    if (!fileID || !year || !month) {
      throw new Error('缺少必要参数: fileID, year, month')
    }
    
    console.log('下载TIF文件...')
    const fileContent = await downloadFile(fileID)
    console.log(`下载完成，大小: ${fileContent.length} bytes`)
    
    console.log('加载库...')
    await loadLibraries()
    
    if (!librariesAvailable) {
      throw new Error('库加载失败，无法处理TIF文件')
    }
    
    console.log('开始提取县域碳汇数据...')
    const extractedData = await processTifForCounties(fileContent, year, month)
    console.log(`数据提取完成: ${extractedData.validCounties}/${extractedData.totalCounties} 个县域有有效数据`)
    
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
        geoInfo: extractedData.geoInfo
      }
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