import monthlyData from '../../data/monthly_data.js';  // 引入月度数据

Page({
  data: {
    currentImageUrl: '', // 初始为空，切换年份时设置
    placeholderImageUrl: '/images/nep201201.png', // 2012年1月图片作为占位图（绝对路径）
    currentYear: 2012,
    minYear: 2012,
    maxYear: 2022,
    yearTabs: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022], // 年份选项卡（2012-2022）
    imageLoaded: false,
    imageError: false,
    imageInfo: { width: 0, height: 0, ratio: '0%' },
    monthlyRealData: monthlyData,          // 所有月度数据
    currentMonthlyData: [],                // 当前年份的月度数据
    imageScale: 1.0,
    imageOpacity: 1.0,
    scalePercent: 100,
    preloadedYears: [],
    loadProgress: 0
  },

  onLoad() {
    console.log('=== 秦岭碳汇遥感影像查看器 ===');
    this.loadImageForYear(this.data.currentYear);
    this.preloadAllImages();
    this.getSystemInfo();
    this.updateMonthlyData(this.data.currentYear);   // 初始化月度图表
  },

  // 切换年份（选项卡点击）
  switchYear(e) {
    const year = Number(e.currentTarget.dataset.year);
    if (!year || year === this.data.currentYear) return;
    
    console.log('切换年份:', year);
    this.setData({ currentYear: year });
    this.loadImageForYear(year);
    this.updateMonthlyData(year);
  },

  onYearSliderChange(e) {
    const year = e.detail.value;
    this.setData({ currentYear: year });
    this.loadImageForYear(year);
    this.updateMonthlyData(year);   // 切换年份时更新图表
  },

  onYearSliderChanging(e) {
    const year = Math.round(e.detail.value);
    if (year !== this.data.currentYear) {
      this.setData({ currentYear: year });
      this.updateMonthlyData(year);   // 实时预览年份
      if (this.data.preloadedYears.includes(year)) {
        this.switchToImage(year);
      }
    }
  },

  loadImageForYear(year) {
    this.setData({ imageLoaded: false, imageError: false });
    const imagePath = this.detectImagePath(year);
    this.setData({ currentImageUrl: imagePath, imageScale: 1.0, scalePercent: 100 });
  },

  detectImagePath(year) {
    // 使用1月份的图片作为年度代表图（例如：nep201201.png）
    return `/images/nep${year}01.png`;
  },

  onImageLoad(e) {
    const info = e.detail || { width: 800, height: 600 };
    const ratio = info.height && info.width ? ((info.height / info.width) * 100).toFixed(1) + '%' : '未知';
    this.setData({
      imageLoaded: true,
      imageError: false,
      imageInfo: { width: info.width || 800, height: info.height || 600, ratio: ratio }
    });
    this.updateMonthlyData(this.data.currentYear);
  },

  onImageError(e) {
    console.error('❌ 影像加载失败', e.detail);
    this.useOnlinePlaceholder();
  },

  useOnlinePlaceholder() {
    const year = this.data.currentYear;
    this.setData({
      imageLoaded: false,
      imageError: true,
      imageInfo: { width: 0, height: 0, ratio: '0%' }
    });
    this.updateMonthlyData(year);
  },

  // 新增：从真实月度数据中筛选当前年份数据
  updateMonthlyData(year) {
    const yearData = this.data.monthlyRealData.filter(item => item.year === year);
    yearData.sort((a, b) => a.month - b.month);
    this.setData({ currentMonthlyData: yearData });
    this.drawChart(year, yearData);
  },

  getColorForValue(value) {
    // 处理负值：使用红色系
    if (value < -1000) return '#a8071a';
    if (value < -500) return '#cf1322';
    if (value < -100) return '#ff4d4f';
    if (value < 0) return '#ffa39e';
    
    // 处理正值：使用绿色系
    if (value > 2000) return '#237804';
    if (value > 1000) return '#52c41a';
    if (value > 500) return '#95de64';
    if (value > 100) return '#ffe58f';
    
    // 0到100之间的值
    return '#ffccc7';
  },

  // 计算颜色亮度，返回true表示颜色较深，适合白色文字
  isDarkColor(color) {
    // 将十六进制颜色转换为RGB
    let r, g, b;
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else {
        return true; // 默认视为深色
      }
      // 计算亮度（YIQ公式）
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness < 128; // 小于128视为深色
    }
    return true; // 默认视为深色
  },

  // 高分辨率绘图方法，支持负值，文字清晰
  drawChart(year, data) {
    if (!data || data.length === 0) return;
    
    const query = wx.createSelectorQuery();
    query.select('#monthlyChart').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        // 降级到旧方法
        this.drawChartLegacy(year, data);
        return;
      }
      
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio || 1;
      
      // 获取Canvas的显示尺寸
      const width = res[0].width || canvas.width;
      const height = res[0].height || canvas.height;
      
      // 设置Canvas实际像素尺寸（考虑dpr）
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      // 缩放上下文以匹配实际像素
      ctx.scale(dpr, dpr);
      
      // 现在使用逻辑尺寸进行绘制
      const canvasWidth = width;
      const canvasHeight = height;
      
      // 清除Canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // 绘制背景
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 增加左侧边距，为Y轴标签留更多空间
      const margin = {
        left: canvasWidth * 0.12,
        right: canvasWidth * 0.04,
        top: canvasHeight * 0.08,
        bottom: canvasHeight * 0.08
      };
      const chartWidth = canvasWidth - margin.left - margin.right;
      const chartHeight = canvasHeight - margin.top - margin.bottom;
      const spacing = chartWidth / data.length;
      const barWidth = spacing * 0.7;

      // 标题
      ctx.font = `bold ${canvasHeight * 0.05}px sans-serif`;
      ctx.fillStyle = '#333';
      ctx.fillText(`${year}年 月度碳汇`, margin.left, margin.top - canvasHeight * 0.01);
      ctx.font = `${canvasHeight * 0.04}px sans-serif`;
      ctx.fillStyle = '#666';
      ctx.fillText('单位: 吨', margin.left + chartWidth - 70, margin.top - canvasHeight * 0.01);

      // 计算最小值和最大值
      const values = data.map(d => d.value);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      
      // 确定Y轴范围，为负值和正值留出空间
      let yMin, yMax;
      if (minValue < 0 && maxValue > 0) {
        // 既有负值又有正值，以零为中心扩展
        const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));
        yMin = -absMax * 1.2;
        yMax = absMax * 1.2;
      } else if (minValue < 0) {
        // 只有负值
        yMin = minValue * 1.2;
        yMax = Math.abs(minValue) * 0.2; // 留出一些正空间
      } else {
        // 只有正值
        yMin = 0;
        yMax = maxValue * 1.1;
      }
      
      const yRange = yMax - yMin;

      // 绘制基线（零线或X轴）
      let baselineY = margin.top + chartHeight; // 默认在底部（只有正值）
      if (minValue < 0) {
        // 有负值，基线在零值位置
        baselineY = margin.top + chartHeight * (1 - (-yMin) / yRange);
      } else if (maxValue <= 0) {
        // 只有负值，基线在顶部
        baselineY = margin.top;
      }
      
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin.left, baselineY);
      ctx.lineTo(margin.left + chartWidth, baselineY);
      ctx.stroke();

      // 绘制坐标轴
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(margin.left, margin.top + chartHeight);
      ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(margin.left, margin.top);
      ctx.lineTo(margin.left, margin.top + chartHeight);
      ctx.stroke();

      // 绘制柱状图
      // 计算基线位置（与上面绘制的基线一致）
      let zeroY = margin.top + chartHeight; // 默认在底部（只有正值）
      if (minValue < 0) {
        // 有负值，基线在零值位置
        zeroY = margin.top + chartHeight * (1 - (-yMin) / yRange);
      } else if (maxValue <= 0) {
        // 只有负值，基线在顶部
        zeroY = margin.top;
      }
      
      // 计算正负值各自的范围和高度比例
      const positiveHeight = Math.max(0, zeroY - margin.top); // 零线以上的高度
      const negativeHeight = Math.max(0, margin.top + chartHeight - zeroY); // 零线以下的高度
      const positiveRange = Math.max(yMax, 1); // 正值范围，避免除零
      const negativeRange = Math.max(Math.abs(yMin), 1); // 负值范围（绝对值），避免除零
      
      data.forEach((item, index) => {
        const x = margin.left + index * spacing + (spacing - barWidth) / 2;
        let barHeight, y;
        
        if (item.value >= 0) {
          // 正值：从零线向上
          barHeight = (item.value / positiveRange) * positiveHeight;
          y = zeroY - barHeight;
          // 确保柱子不会超出顶部
          if (y < margin.top) {
            barHeight = zeroY - margin.top;
            y = margin.top;
          }
        } else {
          // 负值：从零线向下
          barHeight = (Math.abs(item.value) / negativeRange) * negativeHeight;
          y = zeroY;
          // 确保柱子不会超出底部
          if (y + barHeight > margin.top + chartHeight) {
            barHeight = margin.top + chartHeight - zeroY;
          }
        }
        
        const barColor = this.getColorForValue(item.value);
        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // 月份标签
        ctx.font = `${canvasHeight * 0.04}px sans-serif`;
        ctx.fillStyle = '#333';
        ctx.fillText(item.month + '月', x, margin.top + chartHeight + canvasHeight * 0.045);
        
        // 数值标签（根据柱子颜色选择文字颜色）- 所有柱子都显示
        const text = item.value.toFixed(0);
        const textX = x + 4;
        let labelY;
        
        // 智能调整标签位置
        const minBarHeightForInsideLabel = 15;
        
        if (item.value >= 0) {
          // 正值柱子
          if (barHeight >= minBarHeightForInsideLabel) {
            // 柱子较高，标签在柱子顶部内部
            labelY = y + 16;
          } else {
            // 柱子较矮，标签在柱子顶部上方
            labelY = y - 5;
          }
        } else {
          // 负值柱子
          if (barHeight >= minBarHeightForInsideLabel) {
            // 柱子较高，标签在柱子底部内部
            labelY = y + barHeight - 4;
          } else {
            // 柱子较矮，标签在柱子底部下方
            labelY = y + barHeight + 12;
          }
        }
        
        ctx.font = `${canvasHeight * 0.035}px sans-serif`;
        
        // 根据柱子颜色选择文字颜色
        const isDarkBar = this.isDarkColor(barColor);
        if (isDarkBar) {
          // 深色柱子用白色文字，添加黑色阴影增强可读性
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 2;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, textX, labelY);
          // 重置阴影
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else {
          // 浅色柱子用深色文字，添加白色阴影
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
          ctx.shadowBlur = 2;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = '#333333';
          ctx.fillText(text, textX, labelY);
          // 重置阴影
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      });

      // Y轴刻度（简化显示）
      ctx.font = `${canvasHeight * 0.035}px sans-serif`;
      ctx.fillStyle = '#666';
      
      // 显示最大值
      ctx.fillText(yMax.toFixed(0), margin.left - canvasWidth * 0.08, margin.top + canvasHeight * 0.01);
      
      // 显示最小值
      ctx.fillText(yMin.toFixed(0), margin.left - canvasWidth * 0.08, margin.top + chartHeight + canvasHeight * 0.01);
      
      // 如果有负值，显示零线标签
      if (minValue < 0) {
        const zeroY = margin.top + chartHeight * (1 - (-yMin) / yRange);
        ctx.fillText('0', margin.left - canvasWidth * 0.08, zeroY + canvasHeight * 0.01);
      }
      
      // 如果范围较大，显示中间值
      if (yRange > 1000) {
        const midY = margin.top + chartHeight / 2;
        const midVal = (yMax + yMin) / 2;
        ctx.fillText(midVal.toFixed(0), margin.left - canvasWidth * 0.08, midY + canvasHeight * 0.01);
      }
    });
  },

  // 降级绘图方法（兼容旧设备）
  drawChartLegacy(year, data) {
    if (!data || data.length === 0) return;
    const ctx = wx.createCanvasContext('monthlyChart', this);
    const windowInfo = wx.getSystemInfoSync();
    const screenWidth = windowInfo.windowWidth;
    const containerHeightRpx = 550;
    const containerHeightPx = containerHeightRpx * screenWidth / 750;
    const canvasWidth = screenWidth - 40;
    const canvasHeight = containerHeightPx;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.setFillStyle('#fafafa');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const margin = {
      left: canvasWidth * 0.12,
      right: canvasWidth * 0.04,
      top: canvasHeight * 0.08,
      bottom: canvasHeight * 0.08
    };
    const chartWidth = canvasWidth - margin.left - margin.right;
    const chartHeight = canvasHeight - margin.top - margin.bottom;
    const spacing = chartWidth / data.length;
    const barWidth = spacing * 0.7;

    // 标题
    ctx.setFontSize(canvasHeight * 0.05);
    ctx.setFillStyle('#333');
    ctx.fillText(`${year}年 月度碳汇`, margin.left, margin.top - canvasHeight * 0.01);
    ctx.setFontSize(canvasHeight * 0.04);
    ctx.setFillStyle('#666');
    ctx.fillText('单位: 吨', margin.left + chartWidth - 70, margin.top - canvasHeight * 0.01);

    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    let yMin, yMax;
    if (minValue < 0 && maxValue > 0) {
      const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));
      yMin = -absMax * 1.2;
      yMax = absMax * 1.2;
    } else if (minValue < 0) {
      yMin = minValue * 1.2;
      yMax = Math.abs(minValue) * 0.2;
    } else {
      yMin = 0;
      yMax = maxValue * 1.1;
    }
    
    const yRange = yMax - yMin;

    let baselineY = margin.top + chartHeight;
    if (minValue < 0) {
      baselineY = margin.top + chartHeight * (1 - (-yMin) / yRange);
    } else if (maxValue <= 0) {
      baselineY = margin.top;
    }
    
    ctx.setStrokeStyle('#888');
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(margin.left, baselineY);
    ctx.lineTo(margin.left + chartWidth, baselineY);
    ctx.stroke();

    ctx.setStrokeStyle('#aaa');
    ctx.setLineWidth(1.5);
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();

    let zeroY = margin.top + chartHeight;
    if (minValue < 0) {
      zeroY = margin.top + chartHeight * (1 - (-yMin) / yRange);
    } else if (maxValue <= 0) {
      zeroY = margin.top;
    }
    
    const positiveHeight = Math.max(0, zeroY - margin.top);
    const negativeHeight = Math.max(0, margin.top + chartHeight - zeroY);
    const positiveRange = Math.max(yMax, 1);
    const negativeRange = Math.max(Math.abs(yMin), 1);
    
    data.forEach((item, index) => {
      const x = margin.left + index * spacing + (spacing - barWidth) / 2;
      let barHeight, y;
      
      if (item.value >= 0) {
        barHeight = (item.value / positiveRange) * positiveHeight;
        y = zeroY - barHeight;
        if (y < margin.top) {
          barHeight = zeroY - margin.top;
          y = margin.top;
        }
      } else {
        barHeight = (Math.abs(item.value) / negativeRange) * negativeHeight;
        y = zeroY;
        if (y + barHeight > margin.top + chartHeight) {
          barHeight = margin.top + chartHeight - zeroY;
        }
      }
      
      const barColor = this.getColorForValue(item.value);
      ctx.setFillStyle(barColor);
      ctx.fillRect(x, y, barWidth, barHeight);
      
      ctx.setFontSize(canvasHeight * 0.04);
      ctx.setFillStyle('#333');
      ctx.fillText(item.month + '月', x, margin.top + chartHeight + canvasHeight * 0.045);
      
      // 数值标签（所有柱子都显示）- 兼容版本
      const text = item.value.toFixed(0);
      let labelY;
      
      // 智能调整标签位置
      const minBarHeightForInsideLabel = 15;
      
      if (item.value >= 0) {
        // 正值柱子
        if (barHeight >= minBarHeightForInsideLabel) {
          // 柱子较高，标签在柱子顶部内部
          labelY = y + 16;
        } else {
          // 柱子较矮，标签在柱子顶部上方
          labelY = y - 5;
        }
      } else {
        // 负值柱子
        if (barHeight >= minBarHeightForInsideLabel) {
          // 柱子较高，标签在柱子底部内部
          labelY = y + barHeight - 4;
        } else {
          // 柱子较矮，标签在柱子底部下方
          labelY = y + barHeight + 12;
        }
      }
      
      ctx.setFontSize(canvasHeight * 0.035);
      
      // 降级方法中，根据柱子颜色选择文字颜色
      const isDarkBar = this.isDarkColor(barColor);
      if (isDarkBar) {
        // 深色柱子用白色文字
        // 为了增强可读性，绘制两次（模拟阴影）
        ctx.setFillStyle('rgba(0, 0, 0, 0.3)');
        ctx.fillText(text, x + 5, labelY + 1);
        ctx.setFillStyle('#ffffff');
        ctx.fillText(text, x + 4, labelY);
      } else {
        // 浅色柱子用深色文字
        // 为了增强可读性，绘制两次（模拟阴影）
        ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
        ctx.fillText(text, x + 5, labelY + 1);
        ctx.setFillStyle('#333333');
        ctx.fillText(text, x + 4, labelY);
      }
    });

    ctx.setFontSize(canvasHeight * 0.035);
    ctx.setFillStyle('#666');
    ctx.fillText(yMax.toFixed(0), margin.left - canvasWidth * 0.08, margin.top + canvasHeight * 0.01);
    ctx.fillText(yMin.toFixed(0), margin.left - canvasWidth * 0.08, margin.top + chartHeight + canvasHeight * 0.01);
    
    if (minValue < 0) {
      const zeroY = margin.top + chartHeight * (1 - (-yMin) / yRange);
      ctx.fillText('0', margin.left - canvasWidth * 0.08, zeroY + canvasHeight * 0.01);
    }
    
    if (yRange > 1000) {
      const midY = margin.top + chartHeight / 2;
      const midVal = (yMax + yMin) / 2;
      ctx.fillText(midVal.toFixed(0), margin.left - canvasWidth * 0.08, midY + canvasHeight * 0.01);
    }
    
    ctx.draw();
  },

  preloadAllImages() {
    const years = [];
    for (let y = this.data.minYear; y <= this.data.maxYear; y++) years.push(y);
    let loadedCount = 0;
    const preloadedYears = [];
    years.forEach(year => {
      const imagePath = `../../images/nep${year}01.png`;
      wx.getImageInfo({
        src: imagePath,
        success: () => {
          loadedCount++;
          preloadedYears.push(year);
          this.setData({
            preloadedYears,
            loadProgress: Math.round((loadedCount / years.length) * 100)
          });
        },
        fail: () => loadedCount++
      });
    });
  },

  switchToImage(year) {
    this.setData({ 
      currentImageUrl: this.detectImagePath(year), 
      imageLoaded: false,
      imageScale: 1.0, 
      scalePercent: 100 
    });
  },

  zoomIn() {
    const newScale = Math.min(3.0, this.data.imageScale + 0.2);
    this.setData({ imageScale: newScale, scalePercent: Math.round(newScale * 100) });
  },

  zoomOut() {
    const newScale = Math.max(0.3, this.data.imageScale - 0.2);
    this.setData({ imageScale: newScale, scalePercent: Math.round(newScale * 100) });
  },

  resetZoom() {
    this.setData({ imageScale: 1.0, scalePercent: 100 });
  },

  toggleOpacity() {
    const newOpacity = this.data.imageOpacity === 1 ? 0.7 : 1;
    this.setData({ imageOpacity: newOpacity });
  },

  toggleInfoOverlay() {
    this.setData({ showInfoOverlay: !this.data.showInfoOverlay });
  },

  jumpToYear() {
    const years = this.data.yearTabs.map(year => year.toString());
    wx.showActionSheet({
      itemList: years,
      success: (res) => {
        const year = parseInt(years[res.tapIndex]);
        this.setData({ currentYear: year });
        this.loadImageForYear(year);
        this.updateMonthlyData(year);
      }
    });
  },

  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      console.log('系统信息:', systemInfo);
    } catch (err) {
      console.error('获取系统信息失败:', err);
    }
  },

  // 跳转到曲线统计页面
  navigateToCurveStatistics() {
    wx.navigateTo({
      url: '/pages/curve-statistics/curve-statistics'
    });
  },

  showSystemInfo() {
    const info = `
系统状态:
当前年份: ${this.data.currentYear}
影像尺寸: ${this.data.imageInfo.width} × ${this.data.imageInfo.height}
缩放比例: ${this.data.scalePercent}%
透明度: ${Math.round(this.data.imageOpacity * 100)}%
预加载: ${this.data.preloadedYears.length} 个年份
数据状态: ${this.data.currentMonthlyData.length} 个月度数据点
    `.trim();
    wx.showModal({ title: '系统信息', content: info, showCancel: false });
  },

  // 跳转到碳汇统计页面（包含县城统计数据）
  navigateToCarbonChart() {
    wx.navigateTo({
      url: '/pages/carbon-chart/carbon-chart'
    });
  },

  // 跳转区县统计页面（含图片轮播）
  navigateToCountyStats() {
    wx.navigateTo({
      url: '/pages/county-stats/county-stats'
    });
  }
});