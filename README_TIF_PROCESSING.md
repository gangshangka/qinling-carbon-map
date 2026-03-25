# TIF文件处理集成指南

## 概述

本系统支持管理员上传TIF格式的遥感影像文件，并通过Python脚本处理生成带图例的PNG图片，最终将处理好的图片添加到主页的图片展示容器中。

## 处理流程

1. **管理员上传TIF文件**：在管理员页面选择年份和月份，上传TIF文件
2. **TIF文件处理**：TIF文件通过Python脚本处理，生成带图例的PNG图片
3. **图片存储**：生成的PNG图片保存到云存储或本地目录
4. **图片映射更新**：更新图片映射表，将新图片添加到主页展示

## 文件说明

### 1. Python处理脚本
- 位置：`data/shapefile/tif2png_with_legend_top_left.py`
- 功能：将TIF文件转换为PNG图片，并在左上角添加图例
- 支持模式：
  - 批量处理：处理当前目录下所有 `nep*.tif` 文件
  - 单文件处理：处理指定TIF文件，可指定输出路径或年份月份

### 2. 微信小程序端代码
- **管理员页面**：`pages/admin-upload/`
  - 新增TIF文件上传界面
  - 模拟TIF处理流程
  - 更新图片映射表到本地存储
- **主页**：`pages/index/`
  - 从本地存储加载图片映射表
  - 监听存储变化，实时更新图片显示

## 部署方式

### 方案一：模拟处理（开发环境）
在开发环境中，TIF处理过程被模拟：
1. 上传TIF文件后，前端模拟处理进度
2. 生成模拟的图片路径（假设图片已存在）
3. 更新本地存储中的图片映射表
4. 主页从本地存储加载映射表并显示图片

### 方案二：云函数处理（生产环境）
在生产环境中，建议使用云函数处理TIF文件：

#### 云函数配置
1. 在云开发控制台创建云函数 `processTif`
2. 将Python脚本及其依赖打包部署到云函数
3. 云函数接收参数：TIF文件URL、年份、月份
4. 云函数处理TIF文件，生成PNG图片并上传到云存储
5. 返回PNG图片的云存储URL

#### 微信小程序端修改
在 `uploadTifFile` 函数中，将模拟处理替换为云函数调用：

```javascript
// 调用云函数处理TIF文件
wx.cloud.callFunction({
  name: 'processTif',
  data: {
    tifFileId: res.fileID, // 云存储中的TIF文件ID
    year: selectedYear,
    month: selectedMonth
  },
  success: (cloudRes) => {
    // 获取生成的PNG图片URL
    const pngUrl = cloudRes.result.pngUrl;
    // 更新图片映射表
    this.updateImageMap(selectedYear, selectedMonth, pngUrl);
    // 更新状态
    this.setData({ 
      'uploadStatus.tif': '处理完成',
      'uploadProgress.tif': 100 
    });
  },
  fail: (err) => {
    // 处理失败
  }
});
```

## Python脚本使用示例

### 批量处理模式
```bash
python tif2png_with_legend_top_left.py --batch
```

### 单文件处理模式（指定输出文件）
```bash
python tif2png_with_legend_top_left.py --input input.tif --output output.png
```

### 单文件处理模式（自动命名）
```bash
python tif2png_with_legend_top_left.py --input input.tif --year 2020 --month 1
```

### 自定义参数
```bash
python tif2png_with_legend_top_left.py --input input.tif --output output.png --vmin -1200 --vmax 1000 --scale 0.8
```

## 注意事项

1. **依赖库**：Python脚本需要以下库：
   - numpy
   - rasterio
   - Pillow
   - 可通过 `pip install numpy rasterio Pillow` 安装

2. **图片命名规则**：系统默认使用 `nep{年份}{月份:02d}.png` 的命名规则

3. **图片存储路径**：
   - 模拟环境：`/images/nep202001.png`（相对路径）
   - 生产环境：云存储URL

4. **兼容性**：
   - 微信小程序基础库需支持 `wx.chooseMessageFile`
   - 云函数需支持Python 3.7+

5. **性能考虑**：
   - TIF文件可能较大，建议在上传前压缩
   - 处理过程可能耗时，建议使用异步处理
   - 可考虑使用云开发的触发器自动处理

## 故障排除

1. **TIF文件无法选择**：检查微信小程序基础库版本，确保支持 `wx.chooseMessageFile`

2. **图片无法显示**：
   - 检查图片映射表是否正确更新
   - 检查图片路径是否正确
   - 检查图片文件是否存在

3. **Python脚本运行失败**：
   - 检查依赖库是否安装
   - 检查TIF文件格式是否支持
   - 检查文件路径是否正确

4. **云函数调用失败**：
   - 检查云函数是否部署成功
   - 检查云函数权限配置
   - 检查参数传递是否正确

## 后续优化建议

1. **进度实时显示**：在云函数处理过程中实时返回处理进度
2. **批量处理**：支持同时上传多个TIF文件批量处理
3. **处理历史**：保存TIF处理历史记录，支持重新处理
4. **参数自定义**：允许管理员自定义颜色映射、数据范围等处理参数
5. **自动检测**：自动检测TIF文件中的年份月份信息，减少手动输入