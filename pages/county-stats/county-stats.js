// pages/county-stats/county-stats.js
const carbonData = require('../../data/carbonData2.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 年份列表 2012-2022
    yearTabs: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
    currentYear: 2020,
    // 轮播图图片列表
    swiperImages: [],
    // 区县统计数据
    countyStats: [],
    // 统计摘要
    averageCarbon: '0.00',
    maxCarbon: '0.00',
    // 排序字段: 'name' 或 'value'
    sortField: 'value',
    // 排序方向: 'asc' 或 'desc'
    sortOrder: 'desc',
    // 是否显示加载中
    loading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.updateForYear(2020);
  },

  /**
   * 切换年份
   */
  switchYear(e) {
    const year = e.currentTarget.dataset.year;
    if (year === this.data.currentYear) return;
    this.setData({
      currentYear: year
    });
    this.updateForYear(year);
  },

  /**
   * 根据年份更新图片和统计数据
   */
  updateForYear(year) {
    this.setData({ loading: true });
    
    // 更新轮播图图片
    const images = [];
    for (let month = 1; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, '0');
      images.push(`/images/nep${year}${monthStr}.png`);
    }
    
    // 计算区县统计
    const yearData = carbonData[year];
    if (!yearData) {
      this.setData({
        swiperImages: images,
        countyStats: [],
        loading: false
      });
      return;
    }
    
    // 汇总每个区县全年数据
    const countyMap = {};
    const months = Object.keys(yearData);
    months.forEach(month => {
      const monthData = yearData[month];
      Object.keys(monthData).forEach(county => {
        if (!countyMap[county]) {
          countyMap[county] = 0;
        }
        countyMap[county] += monthData[county];
      });
    });
    
    // 转换为数组并排序
    let stats = Object.keys(countyMap).map(county => ({
      name: county,
      value: parseFloat(countyMap[county].toFixed(2))
    }));
    
    // 默认按值降序排序
    stats.sort((a, b) => b.value - a.value);
    
    // 计算统计摘要
    let averageCarbon = '0.00';
    let maxCarbon = '0.00';
    if (stats.length > 0) {
      const sum = stats.reduce((total, item) => total + item.value, 0);
      averageCarbon = (sum / stats.length).toFixed(2);
      maxCarbon = Math.max(...stats.map(item => item.value)).toFixed(2);
    }
    
    this.setData({
      swiperImages: images,
      countyStats: stats,
      averageCarbon: averageCarbon,
      maxCarbon: maxCarbon,
      loading: false
    });
  },

  /**
   * 切换排序
   */
  toggleSort(e) {
    const field = e.currentTarget.dataset.field;
    let { sortField, sortOrder } = this.data;
    
    if (field === sortField) {
      // 同一字段切换排序方向
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // 新字段，默认降序
      sortField = field;
      sortOrder = 'desc';
    }
    
    const sortedStats = [...this.data.countyStats];
    sortedStats.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      
      if (sortField === 'name') {
        // 按名称排序
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        // 按值排序
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
    
    this.setData({
      sortField,
      sortOrder,
      countyStats: sortedStats,
      // 平均值和最大值保持不变
      averageCarbon: this.data.averageCarbon,
      maxCarbon: this.data.maxCarbon
    });
  },

  /**
   * 轮播图切换
   */
  onSwiperChange(e) {
    // 可以在这里添加当前月份指示器
    // console.log('当前滑块索引:', e.detail.current);
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    const urls = this.data.swiperImages;
    wx.previewImage({
      current: urls[index],
      urls: urls
    });
  }
})