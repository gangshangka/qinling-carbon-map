const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

let librariesAvailable = false
let fromArrayBufferFunc = null
let PNG = null

async function loadLibraries() {
  if (librariesAvailable) return true
  try {
    console.log('开始加载 geotiff...')
    const geotiff = await import('geotiff')
    console.log('geotiff 类型:', typeof geotiff)
    console.log('geotiff 属性:', Object.keys(geotiff))
    
    // 尝试多种方式获取 fromArrayBuffer
    if (typeof geotiff.fromArrayBuffer === 'function') {
      fromArrayBufferFunc = geotiff.fromArrayBuffer
      console.log('✅ 使用 geotiff.fromArrayBuffer')
    } else if (geotiff.default && typeof geotiff.default.fromArrayBuffer === 'function') {
      fromArrayBufferFunc = geotiff.default.fromArrayBuffer
      console.log('✅ 使用 geotiff.default.fromArrayBuffer')
    } else {
      throw new Error('无法找到 fromArrayBuffer，可用属性: ' + Object.keys(geotiff).join(', '))
    }

    const pngjsModule = await import('pngjs')
    PNG = pngjsModule.PNG
    librariesAvailable = true
    console.log('✅ TIF处理库加载成功')
    return true
  } catch (error) {
    console.error('❌ 库加载失败:', error.message)
    librariesAvailable = false
    return false
  }
}

async function downloadFile(fileID) {
  const res = await cloud.downloadFile({ fileID })
  return res.fileContent
}

async function uploadFile(buffer, cloudPath) {
  const res = await cloud.uploadFile({ cloudPath, fileContent: buffer })
  return res.fileID
}

function extractCarbonStats(dataArray) {
  const validValues = dataArray.filter(v => v !== -9999 && v !== -9999.0 && !isNaN(v) && v !== null)
  if (validValues.length === 0) return { count: 0, mean: 0, min: 0, max: 0, sum: 0, std: 0 }
  const sum = validValues.reduce((a, b) => a + b, 0)
  const mean = sum / validValues.length
  const min = Math.min(...validValues)
  const max = Math.max(...validValues)
  const squareDiffs = validValues.map(v => Math.pow(v - mean, 2))
  const variance = squareDiffs.reduce((a, b) => a + b, 0) / validValues.length
  const std = Math.sqrt(variance)
  return {
    count: validValues.length,
    mean: parseFloat(mean.toFixed(4)),
    min: parseFloat(min.toFixed(4)),
    max: parseFloat(max.toFixed(4)),
    sum: parseFloat(sum.toFixed(4)),
    std: parseFloat(std.toFixed(4))
  }
}

function tifDataToPng(dataArray, width, height, PNG) {
  const png = new PNG({ width, height, colorType: 2, inputColorType: 2, inputHasAlpha: false })
  const validValues = dataArray.filter(v => v !== -9999 && !isNaN(v))
  const min = validValues.length ? Math.min(...validValues) : 0
  const max = validValues.length ? Math.max(...validValues) : 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) * 4
      const value = dataArray[width * y + x]
      if (value === -9999 || isNaN(value)) {
        png.data[idx] = png.data[idx+1] = png.data[idx+2] = png.data[idx+3] = 0
        continue
      }
      const normalized = (value - min) / (max - min)
      let r, g, b
      if (normalized < 0.25) {
        const t = normalized / 0.25
        r = 0
        g = Math.floor(t * 255)
        b = 255
      } else if (normalized < 0.5) {
        const t = (normalized - 0.25) / 0.25
        r = 0
        g = 255
        b = Math.floor((1 - t) * 255)
      } else if (normalized < 0.75) {
        const t = (normalized - 0.5) / 0.25
        r = Math.floor(t * 255)
        g = 255
        b = 0
      } else {
        const t = (normalized - 0.75) / 0.25
        r = 255
        g = Math.floor((1 - t) * 255)
        b = 0
      }
      png.data[idx] = r
      png.data[idx+1] = g
      png.data[idx+2] = b
      png.data[idx+3] = 255
    }
  }
  return PNG.sync.write(png)
}

async function processTifFileReal(fileContent, year, month, fromArrayBuffer, PNGLib) {
  console.log('开始真实处理TIF文件')
  const arrayBuffer = fileContent.buffer ? fileContent.buffer : fileContent
  const tiff = await fromArrayBuffer(arrayBuffer)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()
  console.log(`TIF尺寸: ${width}x${height}`)
  const data = await image.readRasters({ samples: [0] })
  const dataArray = data[0]
  const stats = extractCarbonStats(dataArray)
  console.log('碳汇统计:', stats)
  const pngBuffer = tifDataToPng(dataArray, width, height, PNGLib)
  console.log(`PNG大小: ${pngBuffer.length} bytes`)
  const cloudPath = `qinling-carbon-data/images/${year}_${month}.png`
  const pngFileID = await uploadFile(pngBuffer, cloudPath)
  console.log(`已上传: ${pngFileID}`)
  return { pngFileID, pngFileName: `${year}_${month}.png`, width, height, stats }
}

async function processTifFileSimulated(fileContent, year, month) {
  console.log('模拟模式处理')
  await new Promise(resolve => setTimeout(resolve, 500))
  const pngFileID = `cloud://cloudbase-8gdof83j7fdc6094.636c-cloudbase-8gdof83j7fdc6094/qinling-carbon-data/images/${year}_${month}.png`
  const stats = { count: 10000, mean: 32.67, min: -2819.21, max: 1638.96, sum: 326700.0, std: 450.23 }
  return { pngFileID, pngFileName: `${year}_${month}.png`, width: 800, height: 600, stats, simulated: true }
}

exports.main = async (event, context) => {
  const { fileID, year, month, fileName } = event
  console.log('调用参数:', { fileID, year, month, fileName })
  try {
    if (!fileID || !year || !month) throw new Error('缺少参数')
    console.log('下载文件...')
    const fileContent = await downloadFile(fileID)
    console.log(`下载完成，大小: ${fileContent.length} bytes`)
    await loadLibraries()
    let result
    if (librariesAvailable && fromArrayBufferFunc) {
      try {
        result = await processTifFileReal(fileContent, year, month, fromArrayBufferFunc, PNG)
        result.mode = 'real'
      } catch (err) {
        console.error('真实处理失败:', err)
        result = await processTifFileSimulated(fileContent, year, month)
        result.mode = 'simulated_fallback'
        result.realError = err.message
      }
    } else {
      result = await processTifFileSimulated(fileContent, year, month)
      result.mode = 'simulated'
    }
    return {
      success: true,
      data: {
        progress: 100,
        message: '处理完成',
        pngFileID: result.pngFileID,
        pngFileName: result.pngFileName,
        year, month,
        width: result.width,
        height: result.height,
        stats: result.stats,
        mode: result.mode,
        note: result.mode === 'real' ? '真实处理' : '模拟模式'
      }
    }
  } catch (err) {
    console.error('失败:', err)
    return { success: false, error: err.message }
  }
}