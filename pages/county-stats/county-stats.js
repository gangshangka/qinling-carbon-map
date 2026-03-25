// pages/county-stats/county-stats.js
import rawCarbonData from '../../data/carbonData2.js';

Page({
  data: {
    // 数据相关
    yearTabs: [], // 年份选项卡
    currentYear: 2022, // 当前选中的年份
    countyStats: [], // 当前年份的县级统计数组
    averageCarbon: '0.00', // 平均碳汇
    maxCarbon: '0.00', // 最大碳汇
    totalCounties: 0, // 县区总数
    
    // 播放控制相关
    isPlaying: false,
    playSpeed: 1000, // 播放速度，毫秒
    playIntervalId: null,
    availableYears: [], // 可用的年份列表
    
    // 排序相关
    sortField: 'value', // 排序字段：'name' 或 'value'
    sortOrder: 'desc', // 排序顺序：'asc' 或 'desc'
    
    // 加载状态
    loading: false,
    
    // 原始数据处理后的结构
    countyDataByYear: {}, // 每年县级排名数据
    annualData: [] // 年度数据
  },

  onLoad() {
    console.log('县区统计页面加载');
    this.processRawData();
  },

  // 处理原始数据，生成年度和县级排名数据
  processRawData() {
    console.log('开始处理原始碳汇数据...');
    this.setData({ loading: true });
    
    const rawData = rawCarbonData;
    
    // 获取所有年份并排序
    const years = Object.keys(rawData).map(year => parseInt(year)).sort((a, b) => a - b);
    console.log('数据包含的年份:', years);
    
    // 获取所有县区名称（从第一个年份的第一个月中获取）
    const firstYear = years[0];
    const firstMonth = Object.keys(rawData[firstYear])[0];
    const counties = Object.keys(rawData[firstYear][firstMonth]);
    console.log('县区数量:', counties.length);
    
    const annualData = [];
    const countyDataByYear = {};
    
    // 1. 生成年度数据：每年所有县区所有月份的总和
    years.forEach(year => {
      let yearTotal = 0;
      const monthData = rawData[year];
      
      // 遍历所有月份（1-12月）
      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString();
        if (monthData[monthStr]) {
          // 计算该月份所有县区的总和
          const monthTotal = Object.values(monthData[monthStr]).reduce((sum, value) => sum + value, 0);
          yearTotal += monthTotal;
        }
      }
      
      // 计算同比增长率（与上一年比较）
      let change = 0;
      if (annualData.length > 0) {
        const prevYearValue = annualData[annualData.length - 1].value;
        if (prevYearValue !== 0) {
          change = ((yearTotal - prevYearValue) / prevYearValue) * 100;
        }
      }
      
      annualData.push({
        year: parseInt(year),
        value: yearTotal,
        change: change
      });
      
      // 2. 生成每年的县级排名数据
      const countyTotals = {};
      counties.forEach(county => {
        let countyTotal = 0;
        const monthData = rawData[year];
        
        for (let month = 1; month <= 12; month++) {
          const monthStr = month.toString();
          if (monthData[monthStr] && monthData[monthStr][county] !== undefined) {
            countyTotal += monthData[monthStr][county];
          }
        }
        
        countyTotals[county] = countyTotal;
      });
      
      // 转换为数组并排序（从高到低）
      const countyArray = Object.keys(countyTotals).map(county => ({
        name: county,
        value: countyTotals[county]
      })).sort((a, b) => b.value - a.value);
      
      // 添加排名
      countyArray.forEach((item, index) => {
        item.rank = index + 1;
      });
      
      countyDataByYear[year] = countyArray;
    });
    
    const latestYear = years[years.length - 1];
    const currentYear = latestYear;
    const countyStats = countyDataByYear[currentYear] || [];
    
    // 计算平均碳汇和最大碳汇
    let averageCarbon = '0.00';
    let maxCarbon = '0.00';
    if (countyStats.length > 0) {
      const total = countyStats.reduce((sum, item) => sum + item.value, 0);
      averageCarbon = (total / countyStats.length).toFixed(2);
      maxCarbon = Math.max(...countyStats.map(item => item.value)).toFixed(2);
    }
    
    this.setData({
      yearTabs: years.slice(-5), // 显示最近5年
      currentYear: currentYear,
      countyStats: countyStats,
      averageCarbon: averageCarbon,
      maxCarbon: maxCarbon,
      totalCounties: counties.length,
      availableYears: years,
      countyDataByYear: countyDataByYear,
      annualData: annualData,
      loading: false
    });
    
    console.log('数据处理完成，当前年份:', currentYear, '县级数据条数:', countyStats.length);
  },

  // 切换年份
  switchYear(event) {
    const year = event.currentTarget.dataset.year;
    console.log('切换年份:', year, '当前年份:', this.data.currentYear);
    
    if (!year || year === this.data.currentYear) return;
    
    this.setData({
      currentYear: Number(year)
    }, () => {
      this.updateCountyStats();
    });
  },

  // 更新当前年份的县级统计
  updateCountyStats() {
    const { countyDataByYear, currentYear } = this.data;
    const countyStats = countyDataByYear[currentYear] || [];
    
    // 计算平均碳汇和最大碳汇
    let averageCarbon = '0.00';
    let maxCarbon = '0.00';
    if (countyStats.length > 0) {
      const total = countyStats.reduce((sum, item) => sum + item.value, 0);
      averageCarbon = (total / countyStats.length).toFixed(2);
      maxCarbon = Math.max(...countyStats.map(item => item.value)).toFixed(2);
    }
    
    // 根据当前排序规则排序
    const sortedStats = this.sortCountyStats(countyStats);
    
    this.setData({
      countyStats: sortedStats,
      averageCarbon: averageCarbon,
      maxCarbon: maxCarbon
    });
  },

  // 排序县区统计
  sortCountyStats(stats) {
    const { sortField, sortOrder } = this.data;
    
    if (!stats || stats.length === 0) return [];
    
    return [...stats].sort((a, b) => {
      let valueA, valueB;
      
      if (sortField === 'name') {
        valueA = a.name;
        valueB = b.name;
        // 按名称排序
        if (sortOrder === 'asc') {
          return valueA.localeCompare(valueB, 'zh-CN');
        } else {
          return valueB.localeCompare(valueA, 'zh-CN');
        }
      } else {
        valueA = a.value;
        valueB = b.value;
        // 按值排序
        if (sortOrder === 'asc') {
          return valueA - valueB;
        } else {
          return valueB - valueA;
        }
      }
    });
  },

  // 切换排序
  toggleSort(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    
    const { sortField, sortOrder } = this.data;
    
    let newSortField = field;
    let newSortOrder = 'desc';
    
    if (sortField === field) {
      // 同一字段，切换排序顺序
      newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // 不同字段，默认降序
      newSortOrder = 'desc';
    }
    
    this.setData({
      sortField: newSortField,
      sortOrder: newSortOrder
    }, () => {
      // 重新排序当前数据
      const sortedStats = this.sortCountyStats(this.data.countyStats);
      this.setData({
        countyStats: sortedStats
      });
    });
  },

  // 播放控制方法
  togglePlay() {
    const { isPlaying, availableYears } = this.data;
    
    if (isPlaying) {
      // 停止播放
      this.stopPlay();
    } else {
      // 开始播放
      if (!availableYears || availableYears.length === 0) {
        console.log('没有可播放的数据');
        return;
      }
      
      this.setData({
        isPlaying: true
      });
      
      const intervalId = setInterval(() => {
        this.nextYear();
      }, this.data.playSpeed);
      
      this.setData({
        playIntervalId: intervalId
      });
      
      console.log('开始按年份播放，速度:', this.data.playSpeed, 'ms');
    }
  },

  stopPlay() {
    const { playIntervalId } = this.data;
    if (playIntervalId) {
      clearInterval(playIntervalId);
    }
    this.setData({
      isPlaying: false,
      playIntervalId: null
    });
    console.log('停止播放');
  },

  nextYear() {
    const { availableYears, currentYear } = this.data;
    if (!availableYears || availableYears.length === 0) return;
    
    // 找到当前年份在列表中的位置
    let currentIndex = availableYears.indexOf(currentYear);
    if (currentIndex === -1) {
      currentIndex = 0;
    }
    
    // 计算下一个年份索引
    let nextIndex = currentIndex + 1;
    if (nextIndex >= availableYears.length) {
      nextIndex = 0; // 循环播放
    }
    
    const nextYear = availableYears[nextIndex];
    
    this.setData({
      currentYear: nextYear
    }, () => {
      this.updateCountyStats();
    });
  },

  prevYear() {
    const { availableYears, currentYear } = this.data;
    if (!availableYears || availableYears.length === 0) return;
    
    // 找到当前年份在列表中的位置
    let currentIndex = availableYears.indexOf(currentYear);
    if (currentIndex === -1) {
      currentIndex = availableYears.length - 1;
    }
    
    // 计算上一个年份索引
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = availableYears.length - 1; // 循环播放
    }
    
    const prevYear = availableYears[prevIndex];
    
    this.setData({
      currentYear: prevYear
    }, () => {
      this.updateCountyStats();
    });
  },

  // 手动切换播放速度
  changePlaySpeed(event) {
    const speed = event.currentTarget.dataset.speed;
    if (!speed) return;
    
    this.setData({
      playSpeed: parseInt(speed)
    });
    
    // 如果正在播放，重启定时器
    if (this.data.isPlaying) {
      this.stopPlay();
      this.togglePlay();
    }
  },

  onUnload() {
    // 清理工作
    this.stopPlay();
  },

  onReady() {},
  onShow() {},
  onHide() {},
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage() {}
});