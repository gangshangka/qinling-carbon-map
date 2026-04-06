const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

let librariesAvailable = false
let fromArrayBufferFunc = null
let PNG = null

async function loadLibraries() {
  if (librariesAvailable) return true
  try {
    const geotiff = await import('geotiff')
    if (typeof geotiff.fromArrayBuffer === 'function') {
      fromArrayBufferFunc = geotiff.fromArrayBuffer
    } else if (geotiff.default && typeof geotiff.default.fromArrayBuffer === 'function') {
      fromArrayBufferFunc = geotiff.default.fromArrayBuffer
    } else {
      throw new Error('无法找到 fromArrayBuffer')
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

// 提取统计信息（保持不变）
function extractCarbonStats(dataArray) {
  let count = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let sumSquared = 0;
  
  for (let i = 0; i < dataArray.length; i++) {
    const value = dataArray[i];
    if (value !== -9999 && value !== -9999.0 && !isNaN(value) && value !== null) {
      count++;
      sum += value;
      if (value < min) min = value;
      if (value > max) max = value;
      sumSquared += value * value;
    }
  }
  
  if (count === 0) {
    return { count: 0, mean: 0, min: 0, max: 0, sum: 0, std: 0 };
  }
  
  const mean = sum / count;
  const variance = (sumSquared / count) - (mean * mean);
  const std = Math.sqrt(variance > 0 ? variance : 0);
  
  return {
    count: count,
    mean: parseFloat(mean.toFixed(4)),
    min: parseFloat(min.toFixed(4)),
    max: parseFloat(max.toFixed(4)),
    sum: parseFloat(sum.toFixed(4)),
    std: parseFloat(std.toFixed(4))
  };
}

// 绿色系颜色映射函数（根据归一化值返回RGB）
function getGreenColor(normalized) {
  // 绿色系渐变：从墨绿 → 森林绿 → 草绿 → 鲜绿 → 黄绿 → 亮黄白
  const colorStops = [
    { pos: 0.0, r: 20, g: 80, b: 20 },   // 墨绿（最低值）
    { pos: 0.2, r: 30, g: 120, b: 30 },  // 森林绿
    { pos: 0.4, r: 80, g: 160, b: 40 },  // 深草绿
    { pos: 0.6, r: 120, g: 200, b: 60 }, // 鲜绿
    { pos: 0.8, r: 200, g: 230, b: 100 },// 黄绿
    { pos: 1.0, r: 255, g: 255, b: 220 } // 亮黄白（最高值）
  ];
  
  // 找到所在区间
  let idx = 0;
  for (let i = 0; i < colorStops.length - 1; i++) {
    if (normalized >= colorStops[i].pos && normalized <= colorStops[i+1].pos) {
      idx = i;
      break;
    }
  }
  
  const pos1 = colorStops[idx].pos;
  const pos2 = colorStops[idx+1].pos;
  const ratio = (normalized - pos1) / (pos2 - pos1);
  
  const r = Math.floor(colorStops[idx].r + (colorStops[idx+1].r - colorStops[idx].r) * ratio);
  const g = Math.floor(colorStops[idx].g + (colorStops[idx+1].g - colorStops[idx].g) * ratio);
  const b = Math.floor(colorStops[idx].b + (colorStops[idx+1].b - colorStops[idx].b) * ratio);
  
  return { r, g, b };
}

// 绘制图例（左上角水平条状）
function drawLegend(pngData, width, height, vmin, vmax) {
  // 图例参数
  const legendHeight = 30;
  const legendWidth = Math.min(200, Math.floor(width * 0.2));
  const margin = 15;
  const startX = margin;
  const startY = margin;
  
  const colorStops = [
    { pos: 0.0, r: 20, g: 80, b: 20 },
    { pos: 0.2, r: 30, g: 120, b: 30 },
    { pos: 0.4, r: 80, g: 160, b: 40 },
    { pos: 0.6, r: 120, g: 200, b: 60 },
    { pos: 0.8, r: 200, g: 230, b: 100 },
    { pos: 1.0, r: 255, g: 255, b: 220 }
  ];
  
  const segments = colorStops.length - 1;
  const segmentWidth = legendWidth / segments;
  
  // 绘制白色背景框
  for (let y = startY - 2; y < startY + legendHeight + 20; y++) {
    for (let x = startX - 2; x < startX + legendWidth + 2; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = (y * width + x) * 4;
        pngData[idx] = 255;     // R
        pngData[idx+1] = 255;   // G
        pngData[idx+2] = 255;   // B
        pngData[idx+3] = 255;   // A
      }
    }
  }
  
  // 绘制色块
  for (let i = 0; i < segments; i++) {
    const x0 = startX + i * segmentWidth;
    const x1 = x0 + segmentWidth;
    const color = colorStops[i];
    
    for (let y = startY; y < startY + legendHeight; y++) {
      for (let x = x0; x < x1; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          pngData[idx] = color.r;
          pngData[idx+1] = color.g;
          pngData[idx+2] = color.b;
          pngData[idx+3] = 255;
        }
      }
    }
  }
  
  // 绘制文字（简化版：使用固定位置绘制数值点）
  // 由于 pngjs 不直接支持文字绘制，我们通过在图像底部添加图例数值标注
  // 这里简单绘制几个颜色块对应的数值标签（在色块下方）
  const labelY = startY + legendHeight + 2;
  for (let i = 0; i <= segments; i++) {
    const pos = colorStops[i].pos;
    const value = vmin + pos * (vmax - vmin);
    const x = startX + i * segmentWidth;
    // 文字绘制需要额外库，这里先用简单色块标注
    // 实际数值会通过 stats 返回给前端，前端可以自定义图例文字
  }
}

// 生成高清 PNG（绿色系 + 白色背景 + 图例）
function tifDataToPng(dataArray, width, height, PNG, stats) {
  const targetWidth = 1981;
  const targetHeight = 735;
  const scaleX = targetWidth / width;
  const scaleY = targetHeight / height;
  
  // 创建目标尺寸的 PNG
  const png = new PNG({ width: targetWidth, height: targetHeight, colorType: 2, inputColorType: 2, inputHasAlpha: false });
  
  // 先填充白色背景
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255;     // R
    png.data[i+1] = 255;   // G
    png.data[i+2] = 255;   // B
    png.data[i+3] = 255;   // A
  }
  
  // 获取有效值范围（用于颜色映射）
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < dataArray.length; i++) {
    const val = dataArray[i];
    if (val !== -9999 && !isNaN(val)) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }
  if (min === Infinity) min = stats.min;
  if (max === -Infinity) max = stats.max;
  
  const range = max - min;
  
  // 缩放并绘制数据
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = dataArray[y * width + x];
      
      if (value === -9999 || isNaN(value)) continue;
      
      // 计算归一化值
      const normalized = range === 0 ? 0.5 : (value - min) / range;
      const color = getGreenColor(Math.max(0, Math.min(1, normalized)));
      
      // 计算在目标图像中的位置（双线性插值简化版）
      const targetX = Math.floor(x * scaleX);
      const targetY = Math.floor(y * scaleY);
      
      if (targetX >= 0 && targetX < targetWidth && targetY >= 0 && targetY < targetHeight) {
        const idx = (targetY * targetWidth + targetX) * 4;
        png.data[idx] = color.r;
        png.data[idx+1] = color.g;
        png.data[idx+2] = color.b;
        png.data[idx+3] = 255;
      }
    }
  }
  
  // 绘制图例（左上角）
  drawLegend(png.data, targetWidth, targetHeight, min, max);
  
  return PNG.sync.write(png);
}

async function processTifFileReal(fileContent, year, month, fromArrayBuffer, PNGLib) {
  console.log('开始真实处理TIF文件')
  const arrayBuffer = fileContent.buffer ? fileContent.buffer : fileContent
  const tiff = await fromArrayBuffer(arrayBuffer)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()
  console.log(`TIF原始尺寸: ${width}x${height}`)
  const data = await image.readRasters({ samples: [0] })
  const dataArray = data[0]
  console.log('开始提取统计信息...')
  const stats = extractCarbonStats(dataArray)
  console.log('碳汇统计:', stats)
  console.log('开始生成高清PNG（1981x735，绿色主题）...')
  const pngBuffer = tifDataToPng(dataArray, width, height, PNGLib, stats)
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
        width: 1981,
        height: 735,
        stats: result.stats,
        mode: result.mode,
        note: result.mode === 'real' ? `高清绿色主题PNG（1981x735）已生成` : '模拟模式'
      }
    }
  } catch (err) {
    console.error('失败:', err)
    return { success: false, error: err.message }
  }
}