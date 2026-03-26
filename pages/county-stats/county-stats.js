// pages/county-stats/county-stats.js
// 导入原始碳汇数据（一个 JavaScript 对象，包含所有年份、月份、县区的数值）
import rawCarbonData from '../../data/carbonData2.js';

// Page 函数：定义当前页面的逻辑和数据
Page({
  // data 对象：页面中使用的所有数据（类似于 Vue 的 data）
  data: {
    // 数据相关
    yearTabs: [],        // 年份选项卡（数组，存放要显示的年份）
    currentYear: 2022,   // 当前选中的年份，默认 2022
    countyStats: [],     // 当前年份的县级统计数据（数组，每个元素包含 name, value, rank）
    averageCarbon: '0.00',  // 当前年份所有县的平均碳汇（保留两位小数）
    maxCarbon: '0.00',      // 当前年份的最大碳汇值
    totalCounties: 0,       // 县区总数（43）

    // 播放控制相关（自动轮播年份）
    isPlaying: false,       // 是否正在播放
    playSpeed: 1000,        // 播放速度，单位毫秒（1000ms = 1秒）
    playIntervalId: null,   // 定时器 ID，用于停止播放
    availableYears: [],     // 所有可用的年份列表（从数据中解析出来的）

    // 排序相关
    sortField: 'value',     // 排序字段：'name'（按县名）或 'value'（按碳汇值）
    sortOrder: 'desc',      // 排序顺序：'asc'（升序）或 'desc'（降序）

    // 加载状态
    loading: false,         // 是否正在加载数据（用于显示加载动画）

    // 原始数据处理后的结构
    countyDataByYear: {},   // 每年县级排名数据，格式：{ 2024: [{name, value, rank}, ...], ... }
    annualData: [],         // 年度数据，格式：[{year, value, change}, ...]

    // 性能优化相关
    dataProcessed: false,   // 数据是否已处理完成（用于避免重复处理）
    dataCacheKey: 'county_stats_data_cache'  // 本地缓存中使用的键名
  },

  // 页面加载时自动执行的生命周期函数
  onLoad() {
    console.log('县区统计页面加载');

    // 显示加载状态（让用户知道正在加载）
    this.setData({ loading: true });

    // 尝试从本地缓存加载数据（异步方法）
    this.loadDataWithCache();
  },

  // 自定义方法：带缓存的异步数据加载
  loadDataWithCache() {
    const cacheKey = this.data.dataCacheKey;    // 缓存的 key
    const now = Date.now();                     // 当前时间戳（毫秒）
    const cacheExpireTime = 5 * 60 * 1000;      // 缓存过期时间：5分钟（单位毫秒）

    try {
      // 尝试从本地存储同步读取缓存数据
      const cachedData = wx.getStorageSync(cacheKey);
      // 如果缓存存在、有时间戳、且未超过5分钟
      if (cachedData && cachedData.timestamp && (now - cachedData.timestamp < cacheExpireTime)) {
        console.log('从缓存加载数据，缓存时间:', new Date(cachedData.timestamp).toLocaleString());

        // 用缓存中的数据更新页面 data
        this.setData({
          yearTabs: cachedData.yearTabs || [],
          currentYear: cachedData.currentYear || 2022,
          countyStats: cachedData.countyStats || [],
          averageCarbon: cachedData.averageCarbon || '0.00',
          maxCarbon: cachedData.maxCarbon || '0.00',
          totalCounties: cachedData.totalCounties || 0,
          availableYears: cachedData.availableYears || [],
          countyDataByYear: cachedData.countyDataByYear || {},
          annualData: cachedData.annualData || [],
          loading: false,          // 关闭加载状态
          dataProcessed: true       // 标记数据已处理
        });

        console.log('缓存数据加载完成');
        return;   // 直接返回，不再重新处理原始数据
      }
    } catch (err) {
      // 如果读取缓存出错（比如 key 不存在），打印日志并继续向下执行
      console.log('缓存读取失败，重新处理数据:', err);
    }

    // 执行到这里说明无缓存或缓存过期，需要从原始数据重新处理
    console.log('开始异步处理原始数据...');

    // 使用 setTimeout 将数据处理放到下一个事件循环，避免阻塞 UI 渲染
    setTimeout(() => {
      try {
        // 调用 processRawData 方法处理原始数据，返回处理后的结果对象
        const processedData = this.processRawData();

        // 将处理结果更新到页面 data 中
        this.setData({
          yearTabs: processedData.yearTabs,
          currentYear: processedData.currentYear,
          countyStats: processedData.countyStats,
          averageCarbon: processedData.averageCarbon,
          maxCarbon: processedData.maxCarbon,
          totalCounties: processedData.totalCounties,
          availableYears: processedData.availableYears,
          countyDataByYear: processedData.countyDataByYear,
          annualData: processedData.annualData
        });

        // 准备要缓存的数据（包含时间戳）
        const cacheData = {
          yearTabs: processedData.yearTabs,
          currentYear: processedData.currentYear,
          countyStats: processedData.countyStats,
          averageCarbon: processedData.averageCarbon,
          maxCarbon: processedData.maxCarbon,
          totalCounties: processedData.totalCounties,
          availableYears: processedData.availableYears,
          countyDataByYear: processedData.countyDataByYear,
          annualData: processedData.annualData,
          timestamp: now
        };

        // 将数据存入本地存储（同步）
        wx.setStorageSync(cacheKey, cacheData);
        console.log('数据处理完成并已缓存');

        // 更新加载状态为完成
        this.setData({
          loading: false,
          dataProcessed: true
        });
      } catch (error) {
        // 如果处理过程中出错，打印错误并关闭加载状态
        console.error('数据处理失败:', error);
        this.setData({
          loading: false,
          dataProcessed: false
        });
      }
    }, 0); // 延迟 0 毫秒，相当于“尽快”但异步执行
  },

  // 处理原始碳汇数据，生成年度数据和县级排名数据
  processRawData() {
    console.log('开始处理原始碳汇数据...');

    const rawData = rawCarbonData;   // 引用导入的原始数据

    // 1. 提取所有年份，转为数字并排序（从小到大）
    const years = Object.keys(rawData).map(year => parseInt(year)).sort((a, b) => a - b);
    console.log('数据包含的年份:', years);

    // 获取所有县区名称：从第一个年份的第一个月份中获取县名列表
    const firstYear = years[0];                                // 最小的年份
    const firstMonth = Object.keys(rawData[firstYear])[0];    // 该年份下的第一个月份（键名，如 "1"）
    const counties = Object.keys(rawData[firstYear][firstMonth]); // 该月份的所有县名
    console.log('县区数量:', counties.length);                  // 通常为 43

    // 存放最终结果的数组/对象
    const annualData = [];          // 年度汇总数据
    const countyDataByYear = {};    // 按年份存储县级排名数据

    // 2. 遍历每个年份
    years.forEach(year => {
      // 计算全省年度总碳汇
      let yearTotal = 0;
      const monthData = rawData[year];   // 该年份的所有月份数据

      // 遍历 1 到 12 月
      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString();
        if (monthData[monthStr]) {   // 如果该月份数据存在
          // 计算该月份所有县的总和
          const monthTotal = Object.values(monthData[monthStr]).reduce((sum, value) => sum + value, 0);
          yearTotal += monthTotal;   // 累加到年度总量
        }
      }

      // 计算同比增长率（与上一年比较）
      let change = 0;
      if (annualData.length > 0) {
        const prevYearValue = annualData[annualData.length - 1].value;  // 前一年的总量
        if (prevYearValue !== 0) {
          change = ((yearTotal - prevYearValue) / prevYearValue) * 100;
        }
      }

      // 存储年度数据
      annualData.push({
        year: parseInt(year),
        value: yearTotal,
        change: change
      });

      // 3. 计算当前年份下每个县的年度总碳汇
      const countyTotals = {};
      counties.forEach(county => {
        let countyTotal = 0;
        const monthData = rawData[year];

        // 累加该县每个月的碳汇值
        for (let month = 1; month <= 12; month++) {
          const monthStr = month.toString();
          if (monthData[monthStr] && monthData[monthStr][county] !== undefined) {
            countyTotal += monthData[monthStr][county];
          }
        }
        countyTotals[county] = countyTotal;   // 记录该县的年度总量
      });

      // 将 countyTotals 对象转为数组，并按 value 降序排序（碳汇高的在前）
      const countyArray = Object.keys(countyTotals).map(county => ({
        name: county,
        value: countyTotals[county]
      })).sort((a, b) => b.value - a.value);

      // 添加排名（1 表示第一名）
      countyArray.forEach((item, index) => {
        item.rank = index + 1;
      });

      // 存储到 countyDataByYear 对象中，键为年份
      countyDataByYear[year] = countyArray;
    });

    // 取最新年份作为当前默认年份
    const latestYear = years[years.length - 1];
    const currentYear = latestYear;
    const countyStats = countyDataByYear[currentYear] || [];   // 当前年份的县区数据

    // 计算平均碳汇和最大碳汇
    let averageCarbon = '0.00';
    let maxCarbon = '0.00';
    if (countyStats.length > 0) {
      const total = countyStats.reduce((sum, item) => sum + item.value, 0);
      averageCarbon = (total / countyStats.length).toFixed(2);   // 平均值保留两位小数
      maxCarbon = Math.max(...countyStats.map(item => item.value)).toFixed(2);
    }

    // 构建返回的结果对象
    const result = {
      yearTabs: years.slice(-5),      // 年份选项卡只显示最近5年（slice(-5) 取最后5个）
      currentYear: currentYear,
      countyStats: countyStats,
      averageCarbon: averageCarbon,
      maxCarbon: maxCarbon,
      totalCounties: counties.length,
      availableYears: years,          // 所有可用年份（供播放器使用）
      countyDataByYear: countyDataByYear,
      annualData: annualData
    };

    console.log('数据处理完成，当前年份:', currentYear, '县级数据条数:', countyStats.length);

    return result;
  },

  // 切换年份（点击年份选项卡时触发）
  switchYear(event) {
    const year = event.currentTarget.dataset.year;   // 获取自定义属性 data-year 的值
    console.log('切换年份:', year, '当前年份:', this.data.currentYear);

    if (!year || year === this.data.currentYear) return;   // 如果年份无效或和当前相同，不做操作

    // 更新当前年份，并在回调中刷新县级统计
    this.setData({
      currentYear: Number(year)   // 转为数字
    }, () => {
      this.updateCountyStats();   // 更新显示数据
    });
  },

  // 根据当前年份更新县级统计数据（重新计算平均、最大，并应用排序）
  updateCountyStats() {
    const { countyDataByYear, currentYear } = this.data;
    const countyStats = countyDataByYear[currentYear] || [];   // 获取当前年份的原始数据

    // 计算平均碳汇和最大碳汇
    let averageCarbon = '0.00';
    let maxCarbon = '0.00';
    if (countyStats.length > 0) {
      const total = countyStats.reduce((sum, item) => sum + item.value, 0);
      averageCarbon = (total / countyStats.length).toFixed(2);
      maxCarbon = Math.max(...countyStats.map(item => item.value)).toFixed(2);
    }

    // 根据当前的排序规则对数据排序
    const sortedStats = this.sortCountyStats(countyStats);

    this.setData({
      countyStats: sortedStats,
      averageCarbon: averageCarbon,
      maxCarbon: maxCarbon
    });
  },

  // 排序县区统计数据（支持按名称或数值升序/降序）
  sortCountyStats(stats) {
    const { sortField, sortOrder } = this.data;

    if (!stats || stats.length === 0) return [];

    // 复制数组，避免直接修改原数据
    return [...stats].sort((a, b) => {
      let valueA, valueB;

      if (sortField === 'name') {
        // 按县名排序（使用中文排序 localeCompare）
        valueA = a.name;
        valueB = b.name;
        if (sortOrder === 'asc') {
          return valueA.localeCompare(valueB, 'zh-CN');   // 升序（A-Z）
        } else {
          return valueB.localeCompare(valueA, 'zh-CN');   // 降序（Z-A）
        }
      } else {
        // 按碳汇值排序
        valueA = a.value;
        valueB = b.value;
        if (sortOrder === 'asc') {
          return valueA - valueB;   // 升序（小→大）
        } else {
          return valueB - valueA;   // 降序（大→小）
        }
      }
    });
  },

  // 切换排序字段和顺序（点击表头时触发）
  toggleSort(event) {
    const field = event.currentTarget.dataset.field;   // 获取自定义属性 data-field
    if (!field) return;

    const { sortField, sortOrder } = this.data;

    let newSortField = field;
    let newSortOrder = 'desc';

    if (sortField === field) {
      // 如果点击的是当前排序字段，则切换排序顺序（升序 ↔ 降序）
      newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // 如果是新字段，默认降序
      newSortOrder = 'desc';
    }

    this.setData({
      sortField: newSortField,
      sortOrder: newSortOrder
    }, () => {
      // 更新完排序设置后，重新排序当前数据
      const sortedStats = this.sortCountyStats(this.data.countyStats);
      this.setData({
        countyStats: sortedStats
      });
    });
  },

  // 播放控制：开始/停止自动轮播年份
  togglePlay() {
    const { isPlaying, availableYears } = this.data;

    if (isPlaying) {
      // 如果正在播放，则停止
      this.stopPlay();
    } else {
      // 如果没有播放，检查是否有年份数据
      if (!availableYears || availableYears.length === 0) {
        console.log('没有可播放的数据');
        return;
      }

      // 将播放状态设为 true
      this.setData({
        isPlaying: true
      });

      // 启动定时器，每隔 playSpeed 毫秒调用一次 nextYear 方法
      const intervalId = setInterval(() => {
        this.nextYear();
      }, this.data.playSpeed);

      // 保存定时器 ID，以便停止时清除
      this.setData({
        playIntervalId: intervalId
      });

      console.log('开始按年份播放，速度:', this.data.playSpeed, 'ms');
    }
  },

  // 停止播放
  stopPlay() {
    const { playIntervalId } = this.data;
    if (playIntervalId) {
      clearInterval(playIntervalId);   // 清除定时器
    }
    this.setData({
      isPlaying: false,
      playIntervalId: null
    });
    console.log('停止播放');
  },

  // 播放到下一个年份
  nextYear() {
    const { availableYears, currentYear } = this.data;
    if (!availableYears || availableYears.length === 0) return;

    // 找到当前年份在数组中的索引
    let currentIndex = availableYears.indexOf(currentYear);
    if (currentIndex === -1) {
      currentIndex = 0;
    }

    // 计算下一个索引，如果到末尾则回到开头（循环播放）
    let nextIndex = currentIndex + 1;
    if (nextIndex >= availableYears.length) {
      nextIndex = 0;
    }

    const nextYear = availableYears[nextIndex];

    // 更新当前年份，并在回调中刷新县级统计
    this.setData({
      currentYear: nextYear
    }, () => {
      this.updateCountyStats();
    });
  },

  // 播放到上一个年份（手动点击“上一页”时使用）
  prevYear() {
    const { availableYears, currentYear } = this.data;
    if (!availableYears || availableYears.length === 0) return;

    let currentIndex = availableYears.indexOf(currentYear);
    if (currentIndex === -1) {
      currentIndex = availableYears.length - 1;
    }

    // 计算上一个索引，如果到开头则回到末尾
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = availableYears.length - 1;
    }

    const prevYear = availableYears[prevIndex];

    this.setData({
      currentYear: prevYear
    }, () => {
      this.updateCountyStats();
    });
  },

  // 手动更改播放速度（点击速度按钮时触发）
  changePlaySpeed(event) {
    const speed = event.currentTarget.dataset.speed;   // 获取 data-speed 属性值
    if (!speed) return;

    // 更新播放速度（转为整数）
    this.setData({
      playSpeed: parseInt(speed)
    });

    // 如果正在播放，需要重启定时器以使用新的速度
    if (this.data.isPlaying) {
      this.stopPlay();      // 先停止
      this.togglePlay();    // 重新开始（会使用新的 speed）
    }
  },

  // 页面卸载时的清理工作（避免定时器残留）
  onUnload() {
    this.stopPlay();   // 停止播放，清除定时器
  },

  // 以下为页面生命周期函数（空实现，可保留用于后续扩展）
  onReady() {},
  onShow() {},
  onHide() {},
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage() {}
});