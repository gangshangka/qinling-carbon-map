# 秦岭碳汇3D立体地图部署指南

## 📁 生成的文件

1. **`3d-map-tiff.html`** - 主可视化页面（基于TIFF数据）
2. **`data/map3d_sampled.json`** - 3D地图数据（从TIFF采样）
3. **`data/carbon_samples.json`** - 原始采样数据
4. **`qinling-3d-map.zip`** - 上述文件的压缩包
5. **`sample_tiff_values.py`** - 数据处理脚本（可重新运行）

## 🚀 快速本地预览

### 方法一：直接打开
1. 双击 `3d-map-tiff.html` 在浏览器中打开
2. 确保网络可访问CDN（ECharts库）
3. 数据将自动从 `data/map3d_sampled.json` 加载

### 方法二：Python HTTP服务器
```powershell
# 进入项目目录
cd "d:\data\NEP_end\aa\qinling-carbon-app"

# 启动本地服务器（端口8000）
python -m http.server 8000

# 浏览器访问：http://localhost:8000/3d-map-tiff.html
```

## ☁️ 云端部署方案

### 方案一：腾讯云静态网站托管（推荐）
```bash
# 1. 安装COS命令行工具
pip install coscmd

# 2. 配置COS（需要腾讯云账号）
coscmd config -a <SECRET_ID> -s <SECRET_KEY> -b <BUCKET> -r <REGION>

# 3. 上传文件到根目录
coscmd upload 3d-map-tiff.html /
coscmd upload data/map3d_sampled.json /data/
coscmd upload data/carbon_samples.json /data/

# 4. 开启静态网站功能（在腾讯云控制台操作）
# 5. 获取访问域名
```

### 方案二：GitHub Pages
```bash
# 1. 创建新仓库
git init
git add 3d-map-tiff.html data/map3d_sampled.json data/carbon_samples.json
git commit -m "添加秦岭碳汇3D地图"
git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main

# 2. 在仓库设置中启用GitHub Pages
#   选择根目录，访问：https://<用户名>.github.io/<仓库名>/3d-map-tiff.html
```

### 方案三：Vercel / Netlify
1. 访问 https://vercel.com 或 https://netlify.com
2. 拖拽 `qinling-3d-map.zip` 到上传区域
3. 自动生成可访问链接（如：https://qinling-3d.vercel.app）

### 方案四：免费文件托管
```powershell
# 使用transfer.sh（14天有效期）
# 在PowerShell中运行：
$url = Invoke-RestMethod -Method Put -Uri "https://transfer.sh/qinling-3d-map.zip" -InFile "qinling-3d-map.zip"
Write-Host "下载链接: $url"
```

## 🔧 数据处理与更新

### 重新处理TIFF数据
```bash
# 运行采样脚本（需要GDAL）
python sample_tiff_values.py

# 输出:
# - data/carbon_samples.json
# - data/map3d_sampled.json
```

### 脚本说明
- `sample_tiff_values.py`：在县区中心点采样TIFF值
- 采样方法：centroid_point_sampling（中心点采样）
- 数据范围：-89.47 ~ 357.93 单位
- 有效数据：24/40 县区

## 🌐 在线预览功能

### 交互控制
1. **高度缩放**：1-20倍柱体高度调整
2. **配色方案**：5种颜色主题可选
3. **视图角度**：默认/俯视/侧视/斜45°
4. **键盘控制**：
   - 方向键：旋转视角
   - +/-：调整柱体高度
   - 鼠标拖拽：自由旋转

### 数据展示
- 2D柱状图：每个县区一个柱体，高度表示碳汇值
- 颜色渐变：红→高碳汇，蓝→低碳汇
- 悬停提示：显示详细数据
- 实时统计：平均碳汇、数据覆盖、碳汇范围、空间范围

## 📊 数据说明

### 数据源
- **栅格数据**：`data/nep20225.tif` (3963×1471像素)
- **地理范围**：经度105.49°-111.03°, 纬度32.48°-34.54°
- **县区边界**：`data/shapefile/qinling.geojson` (40个县区)
- **数据单位**：碳通量单位（可能为NEP或GPP）

### 数据质量
- 总县区数：40个
- 有效采样点：24个（60%覆盖率）
- 碳汇范围：-89.47（碳源）~ 357.93（碳汇）
- 平均值：238.54 单位

## 🔄 后续优化建议

1. **数据精度提升**
   - 使用多边形平均代替中心点采样
   - 集成多年份TIFF数据，添加时间轴
   - 连接 `carbonData2.js` 中的历史数据

2. **可视化增强**
   - 添加地形底图（使用Three.js地形渲染）
   - 实现数据动画（年份过渡效果）
   - 添加等高线/热力图叠加

3. **性能优化**
   - 压缩GeoJSON文件大小
   - 使用Web Workers处理大数据
   - 实现按需加载（LOD）

4. **功能扩展**
   - 添加数据导出功能（PNG/CSV）
   - 实现县区筛选/搜索
   - 添加对比分析工具

## 📞 技术支持

### 环境要求
- 现代浏览器（Chrome 90+, Edge 90+, Firefox 88+）
- 网络连接（加载CDN资源）
- 如有问题，检查浏览器控制台错误

### 常见问题
1. **地图不显示**：检查网络，确保能访问 https://cdn.jsdelivr.net
2. **数据加载失败**：检查 `data/map3d_sampled.json` 文件路径
3. **3D渲染卡顿**：降低高度缩放值，或使用性能模式
4. **县区名称乱码**：GeoJSON文件编码问题，可重新保存为UTF-8

---

## 🚀 一键部署脚本（Windows）

创建 `deploy.bat` 文件：
```batch
@echo off
echo 秦岭碳汇3D地图部署工具
echo.

REM 启动本地预览
start http://localhost:8000/3d-map-tiff.html
python -m http.server 8000

pause
```

运行方法：双击 `deploy.bat`，浏览器将自动打开预览页面。

---

**部署完成时间**：2025年3月22日  
**数据处理版本**：v1.0 (中心点采样)  
**可视化技术栈**：ECharts GL + GeoJSON + GDAL