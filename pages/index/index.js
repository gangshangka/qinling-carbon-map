import monthlyData from '../../data/monthly_data.js';  // 引入月度数据

Page({
  data: {
    currentImageUrl: '', // 初始为空，切换年份时设置
    placeholderImageUrl: '/images/nep201201.png', // 2012年1月图片作为占位图（绝对路径）
    currentYear: 2012,
    currentMonth: 1, // 当前月份，默认1月
    minYear: 2012,
    maxYear: 2022,
    yearTabs: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022], // 年份选项卡（2012-2022）
    monthTabs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // 月份选项卡（1-12月）
    imageLoaded: false,
    imageError: false,
    imageInfo: { width: 0, height: 0, ratio: '0%' },
    monthlyRealData: monthlyData,          // 所有月度数据
    currentMonthlyData: [],                // 当前年份的月度数据
    imageScale: 1.0,
    imageOpacity: 1.0,
    scalePercent: 100,
    preloadedYears: [],
    loadProgress: 0,
    // 图片映射表：存储已上传的图片路径，格式: {年份: {月份: 图片路径}}
    imageMap: {},
    
    // 自动播放相关
    autoPlay: false,
    autoPlayStatus: '停止',
    autoPlayTimer: null,
    autoPlayInterval: 2000, // 播放间隔2秒
    showYearPicker: false,
    showMonthPicker: false,
    // TIF上传图片状态提示
    uploadedImageTip: '',
    showUploadedTip: false,
    uploadedImageTipTimer: null,
  },



  onLoad() {
    console.log('=== 秦岭碳汇遥感影像查看器 ===');
    this.loadImage();
    this.preloadAllImages();
    this.getSystemInfo();
    this.updateMonthlyData(this.data.currentYear);   // 初始化月度图表
    // 初始化imageMap（可以从本地存储或云存储加载）
    this.initImageMap();
    
    // 监听本地存储变化，当图片映射表更新时重新加载
    if (wx.onStorageChange) {
      wx.onStorageChange((res) => {
        if (res.key === 'carbon_image_map') {
          console.log('检测到图片映射表更新，重新加载');
          this.initImageMap();
          // 如果当前显示的年份月份有更新，重新加载图片
          const { currentYear, currentMonth } = this.data;
          const imageMap = wx.getStorageSync('carbon_image_map') || {};
          if (imageMap[currentYear] && imageMap[currentYear][currentMonth]) {
            this.loadImage(currentYear, currentMonth);
            // 显示上传图片提示
            this.showUploadedImageTip(currentYear, currentMonth);
          }
        }
      });
    }
  },



  // 切换年份（选项卡点击）
  switchYear(e) {
    const year = Number(e.currentTarget.dataset.year);
    if (!year || year === this.data.currentYear) return;
    
    console.log('切换年份:', year);
    this.setData({ currentYear: year });
    this.loadImage(year, this.data.currentMonth);
    this.updateMonthlyData(year);
  },
  
  // 切换月份（选项卡点击）
  switchMonth(e) {
    const month = Number(e.currentTarget.dataset.month);
    if (!month || month === this.data.currentMonth) return;
    
    console.log('切换月份:', month);
    this.setData({ currentMonth: month });
    this.loadImage(this.data.currentYear, month);
  },



  onYearSliderChange(e) {
    const year = e.detail.value;
    this.setData({ currentYear: year });
    this.loadImage(year, this.data.currentMonth);
    this.updateMonthlyData(year);   // 切换年份时更新图表
  },



  onYearSliderChanging(e) {
    const year = Math.round(e.detail.value);
    if (year !== this.data.currentYear) {
      this.setData({ currentYear: year });
      this.updateMonthlyData(year);   // 实时预览年份
      if (this.data.preloadedYears.includes(year)) {
        this.switchToImage(year, this.data.currentMonth);
      }
    }
  },



  loadImage(year = this.data.currentYear, month = this.data.currentMonth) {
    this.setData({ imageLoaded: false, imageError: false });
    const imagePath = this.detectImagePath(year, month);
    this.setData({ currentImageUrl: imagePath, imageScale: 1.0, scalePercent: 100 });
  },
  
  // 保持向后兼容
  loadImageForYear(year) {
    this.loadImage(year, this.data.currentMonth);
  },



  detectImagePath(year, month = this.data.currentMonth) {
    // 优先从imageMap中获取图片路径
    const imageMap = this.data.imageMap;
    if (imageMap[year] && imageMap[year][month]) {
      return imageMap[year][month];
    }
    // 默认使用命名规则: /images/nep{年份}{月份:02d}.png
    const monthStr = month < 10 ? '0' + month : month.toString();
    return `/images/nep${year}${monthStr}.png`;
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
    const { currentYear, currentMonth } = this.data;
    const monthStr = currentMonth < 10 ? '0' + currentMonth : currentMonth.toString();
    
    // 设置一个在线占位图URL（使用placeholder.com服务）
    const placeholderUrl = `https://via.placeholder.com/800x600/4CAF50/FFFFFF?text=${currentYear}年${currentMonth}月碳汇分布图`;
    
    console.log('使用在线占位图:', placeholderUrl);
    this.setData({
      imageLoaded: false,
      imageError: true,
      imageInfo: { width: 800, height: 600, ratio: '75%' },
      currentImageUrl: placeholderUrl
    });
    this.updateMonthlyData(currentYear);
  },



  // 新增：从真实月度数据中筛选当前年份数据
  updateMonthlyData(year) {
    const yearData = this.data.monthlyRealData.filter(item => item.year === year);
    yearData.sort((a, b) => a.month - b.month);
    this.setData({ currentMonthlyData: yearData });
    this.drawChart(year, yearData);
  },



  getColorForValue(value) {
    // 处理负值：使用多彩的冷色系（更美观多样）
    if (value < -1500) return '#283593'; // 深靛蓝
    if (value < -1000) return '#4527a0'; // 深紫色
    if (value < -500) return '#5e35b1';  // 紫色
    if (value < -200) return '#7e57c2';  // 中紫色
    if (value < -100) return '#9575cd';  // 浅紫色
    if (value < 0) return '#b39ddb';     // 淡紫色
    
    // 处理正值：使用多彩的暖色系（更美观多样）
    if (value > 3000) return '#004d40';  // 深青色
    if (value > 2000) return '#00695c';  // 青色
    if (value > 1500) return '#2e7d32';  // 深绿色
    if (value > 1000) return '#43a047';  // 绿色
    if (value > 500) return '#66bb6a';   // 浅绿色
    if (value > 200) return '#a5d6a7';   // 淡绿色
    if (value > 100) return '#fff59d';   // 淡黄色
    
    // 0到100之间的值：温和的橙色
    return '#ffcc80';
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



  switchToImage(year, month = this.data.currentMonth) {
    this.setData({ 
      currentImageUrl: this.detectImagePath(year, month), 
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
        this.loadImage(year, this.data.currentMonth);
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
当前日期: ${this.data.currentYear}年${this.data.currentMonth}月
影像尺寸: ${this.data.imageInfo.width} × ${this.data.imageInfo.height}
缩放比例: ${this.data.scalePercent}%
透明度: ${Math.round(this.data.imageOpacity * 100)}%
预加载: ${this.data.preloadedYears.length} 个年份
数据状态: ${this.data.currentMonthlyData.length} 个月度数据点
图片映射: ${Object.keys(this.data.imageMap).length} 个年份
    `.trim();
    wx.showModal({ title: '系统信息', content: info, showCancel: false });
  },



  // 跳转到碳汇统计页面（包含县城统计数据）
  navigateToCarbonChart() {
    wx.navigateTo({
      url: '/pages/carbon-chart/carbon-chart'
    });
  },



  // 初始化图片映射表（从本地存储加载管理员上传的图片信息）
  initImageMap() {
    // 从本地存储加载图片映射表
    const imageMap = wx.getStorageSync('carbon_image_map') || {};
    console.log('加载图片映射表:', Object.keys(imageMap).length, '个年份');
    
    // 检查每个年份是否有图片文件存在
    // 这里可以添加云存储检查逻辑
    this.setData({ imageMap });
    
    // 更新年份选项卡，基于imageMap中的年份
    this.updateYearTabsFromImageMap(imageMap);
    
    // 如果没有图片映射表，初始化默认结构
    if (Object.keys(imageMap).length === 0) {
      this.initDefaultImageMap();
    }
  },
  
  // 根据图片映射表更新年份选项卡
  updateYearTabsFromImageMap(imageMap) {
    let years = Object.keys(imageMap).map(year => parseInt(year)).sort((a, b) => a - b);
    
    // 如果年份列表为空，使用默认年份（2012-2022）
    if (years.length === 0) {
      years = [];
      for (let y = 2012; y <= 2022; y++) {
        years.push(y);
      }
    }
    
    console.log('更新年份选项卡:', years);
    this.setData({ yearTabs: years });
    
    // 如果当前年份不在新的年份列表中，调整到第一个年份
    if (years.length > 0 && !years.includes(this.data.currentYear)) {
      const newYear = years[0];
      console.log('当前年份不在列表中，切换到:', newYear);
      this.setData({ currentYear: newYear });
      this.loadImage(newYear, this.data.currentMonth);
      this.updateMonthlyData(newYear);
    }
  },
  
  // 初始化默认图片映射表（基于现有图片文件）
  initDefaultImageMap() {
    const imageMap = {};
    const years = this.data.yearTabs;
    const months = this.data.monthTabs;
    
    // 假设图片命名规则为: nep{年份}{月份:02d}.png
    for (const year of years) {
      imageMap[year] = {};
      for (const month of months) {
        const monthStr = month < 10 ? '0' + month : month.toString();
        const imagePath = `/images/nep${year}${monthStr}.png`;
        // 这里可以添加图片存在性检查
        imageMap[year][month] = imagePath;
      }
    }
    
    this.setData({ imageMap });
    // 保存到本地存储
    wx.setStorageSync('carbon_image_map', imageMap);
    console.log('初始化默认图片映射表完成');
  },
  
  // 添加图片到映射表（管理员上传新图片后调用）
  addImageToMap(year, month, imagePath) {
    const imageMap = this.data.imageMap;
    if (!imageMap[year]) {
      imageMap[year] = {};
    }
    imageMap[year][month] = imagePath;
    
    this.setData({ imageMap });
    // 保存到本地存储
    wx.setStorageSync('carbon_image_map', imageMap);
    console.log('添加图片到映射表:', year, '年', month, '月', imagePath);
    
    // 更新年份选项卡
    this.updateYearTabsFromImageMap(imageMap);
    
    // 如果当前显示的是这个年份月份，重新加载图片
    if (this.data.currentYear === year && this.data.currentMonth === month) {
      this.loadImage(year, month);
    }
  },

  // 跳转区县统计页面（含图片轮播）
  navigateToCountyStats() {
    wx.navigateTo({
      url: '/pages/county-stats/county-stats'
    });
  },

  // 跳转3D地图页面
  navigateTo3DMap() {
    wx.navigateTo({
      url: '/pages/3d-map/3d-map'
    });
  },

  // 跳转碳汇地图页面（2D平面地图）
  navigateToCarbonMap() {
    wx.navigateTo({
      url: '/pages/terrain-webview/terrain-webview'
    });
  },

  // 跳转管理员页面
  navigateToAdmin() {
    wx.navigateTo({
      url: '/pages/admin-upload/admin-upload'
    });
  },

  // 跳转3D行政区划柱状图页面
  navigateTo3DBarChart() {
    wx.navigateTo({
      url: '/pages/3d-bar-chart/3d-bar-chart'
    });
  },

  // 切换自动播放
  toggleAutoPlay() {
    if (this.data.autoPlay) {
      this.stopAutoPlay();
    } else {
      this.startAutoPlay();
    }
  },

  // 开始自动播放
  startAutoPlay() {
    const that = this;
    this.setData({
      autoPlay: true,
      autoPlayStatus: '播放中...'
    });
    
    // 设置定时器
    const timer = setInterval(() => {
      that.autoPlayNext();
    }, this.data.autoPlayInterval);
    
    this.setData({ autoPlayTimer: timer });
    console.log('自动播放开始，间隔:', this.data.autoPlayInterval, 'ms');
  },

  // 停止自动播放
  stopAutoPlay() {
    if (this.data.autoPlayTimer) {
      clearInterval(this.data.autoPlayTimer);
    }
    this.setData({
      autoPlay: false,
      autoPlayStatus: '停止',
      autoPlayTimer: null
    });
    console.log('自动播放停止');
  },

  // 播放下一张图片
  autoPlayNext() {
    let { currentYear, currentMonth, maxYear } = this.data;
    
    // 先尝试增加月份
    if (currentMonth < 12) {
      currentMonth++;
    } else {
      // 月份到12月，增加到下一年1月
      currentMonth = 1;
      if (currentYear < maxYear) {
        currentYear++;
      } else {
        // 已经到最大年份的12月，停止播放
        this.stopAutoPlay();
        wx.showToast({
          title: '已播放到最后一张',
          icon: 'none'
        });
        return;
      }
    }
    
    console.log('自动播放下一张:', currentYear, '年', currentMonth, '月');
    this.setData({
      currentYear,
      currentMonth
    });
    this.loadImage(currentYear, currentMonth);
    this.updateMonthlyData(currentYear);
  },

  // 切换年份选择器显示
  toggleYearPicker() {
    this.setData({
      showYearPicker: !this.data.showYearPicker
    });
  },

  // 关闭年份选择器
  closeYearPicker() {
    this.setData({
      showYearPicker: false
    });
  },

  // 选择年份
  selectYear(e) {
    const year = Number(e.currentTarget.dataset.year);
    if (!year || year === this.data.currentYear) {
      this.closeYearPicker();
      return;
    }
    
    this.setData({
      currentYear: year,
      showYearPicker: false
    });
    
    // 加载对应年份的图片和数据
    this.loadImage(year, this.data.currentMonth);
    this.updateMonthlyData(year);
    
    console.log('切换到年份:', year);
  },

  // 切换月份选择器显示
  toggleMonthPicker() {
    this.setData({
      showMonthPicker: !this.data.showMonthPicker
    });
  },

  // 关闭月份选择器
  closeMonthPicker() {
    this.setData({
      showMonthPicker: false
    });
  },

  // 选择月份
  selectMonth(e) {
    const month = Number(e.currentTarget.dataset.month);
    if (!month || month === this.data.currentMonth) {
      this.closeMonthPicker();
      return;
    }
    
    this.setData({
      currentMonth: month,
      showMonthPicker: false
    });
    
    // 加载对应月份的图片
    this.loadImage(this.data.currentYear, month);
    
    console.log('切换到月份:', month);
  },

  // 显示上传图片提示
  showUploadedImageTip(year, month) {
    // 清除之前的定时器
    if (this.data.uploadedImageTipTimer) {
      clearTimeout(this.data.uploadedImageTipTimer);
    }
    
    // 设置提示信息
    const tip = `📸 已加载上传图片 (${year}年${month}月)`;
    this.setData({
      uploadedImageTip: tip,
      showUploadedTip: true
    });
    
    // 5秒后自动隐藏提示
    const timer = setTimeout(() => {
      this.setData({
        showUploadedTip: false
      });
    }, 5000);
    
    this.setData({ uploadedImageTipTimer: timer });
  },
  
  // 检查当前图片是否为上传图片
  checkImageSource(year, month) {
    const imageMap = this.data.imageMap;
    if (imageMap[year] && imageMap[year][month]) {
      const imagePath = imageMap[year][month];
      // 检查是否为上传图片（不是默认路径）
      if (!imagePath.includes('/images/nep')) {
        return 'uploaded';
      }
      return 'default';
    }
    return 'default';
  },
  
  // 优化detectImagePath函数，添加图片来源标记
  detectImagePath(year, month = this.data.currentMonth) {
    // 优先从imageMap中获取图片路径
    const imageMap = this.data.imageMap;
    if (imageMap[year] && imageMap[year][month]) {
      const imagePath = imageMap[year][month];
      // 如果找到的是上传图片路径，显示提示
      if (!imagePath.includes('/images/nep')) {
        // 延迟显示提示，确保图片加载后显示
        setTimeout(() => {
          this.showUploadedImageTip(year, month);
        }, 300);
      }
      return imageMap[year][month];
    }
    // 默认使用命名规则: /images/nep{年份}{月份:02d}.png
    const monthStr = month < 10 ? '0' + month : month.toString();
    return `/images/nep${year}${monthStr}.png`;
  },
  
  // 阻止事件冒泡
  stopPropagation(e) {
    // 阻止事件冒泡，防止点击面板内部时触发外层点击事件
    return;
  }
});