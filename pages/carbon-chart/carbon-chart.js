// 碳汇统计页面 - 使用完整分县区数据（carbonData2.js）
import * as echarts from '../../miniprogram_npm/echarts/index';
import rawCarbonData from '../../data/carbonData2.js';

Page({
  data: {
    echarts: echarts, // 直接传入 echarts 对象
    ec: { 
      lazyLoad: false // 改为 false，立即加载
    },
    annualData: [],
    countyData: [],
    monthlyData: [],
    currentYearIndex: 0,
    currentCountyIndex: 0,
    latestYear: 2022,
    updateTime: '',
    chartMode: 'county', // 'annual' 或 'county' 或 'monthly'
    totalCounties: 0,
    currentYear: 2022, // 当前选择的年份
    monthlyDataCount: 0,
    availableYears: [], // 可用的年份列表
    yearTabs: [2020, 2021, 2022], // 年份选项卡
    rawCarbonData: null, // 原始数据
    countyDataByYear: {}, // 每年县级排名数据
    countyDataByYearMonth: {}, // 每年每月县级排名数据，键格式为 "2022-01"
    // 播放控制相关
    isPlaying: false,
    playSpeed: 2000, // 播放速度，毫秒，默认放慢
    currentPlayIndex: 0, // 当前播放的月份索引
    playIntervalId: null, // 播放定时器ID
    yearMonthList: [], // 年份月份列表，用于播放
    currentYearMonth: '', // 当前播放的年月，格式如"2022-01"
    currentChartMode: 'year' // 播放模式：'year' 按年份播放，'month' 按月份播放
  },

  // 处理原始数据，生成年度、县级和月度数据
  processRawData() {
    console.log('开始处理原始碳汇数据...');
    
    const rawData = rawCarbonData; // 直接使用导入的原始数据
    const annualData = [];
    const monthlyData = [];
    
    // 获取所有年份并排序
    const years = Object.keys(rawData).map(year => parseInt(year)).sort((a, b) => a - b);
    console.log('数据包含的年份:', years);
    
    // 获取所有县区名称（从第一个年份的第一个月中获取）
    const firstYear = years[0];
    const firstMonth = Object.keys(rawData[firstYear])[0];
    const counties = Object.keys(rawData[firstYear][firstMonth]);
    console.log('县区数量:', counties.length);
    
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
          
          // 2. 生成月度数据
          monthlyData.push({
            year: parseInt(year),
            month: month,
            value: monthTotal
          });
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
    });
    
    // 3. 生成县级排名数据：使用最新一年的数据
    const latestYear = years[years.length - 1];
    console.log('最新年份:', latestYear);
    
    // 计算每年的县级排名数据
    const countyDataByYear = {};
    // 计算每年每月的县级排名数据
    const countyDataByYearMonth = {};
    years.forEach(year => {
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
        county: county,
        value: countyTotals[county]
      })).sort((a, b) => b.value - a.value);
      
      // 添加排名
      countyArray.forEach((item, index) => {
        item.rank = index + 1;
      });
      
      countyDataByYear[year] = countyArray;
      
      // 计算每个月份的县级排名数据
      const monthData = rawData[year];
      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString();
        if (monthData[monthStr]) {
          const monthCountyTotals = monthData[monthStr];
          // 转换为数组并排序（从高到低）
          const monthCountyArray = Object.keys(monthCountyTotals).map(county => ({
            county: county,
            value: monthCountyTotals[county]
          })).sort((a, b) => b.value - a.value);
          
          // 添加排名
          monthCountyArray.forEach((item, index) => {
            item.rank = index + 1;
          });
          
          const yearMonthKey = `${year}-${monthStr.padStart(2, '0')}`;
          countyDataByYearMonth[yearMonthKey] = monthCountyArray;
        }
      }
    });
    
    // 最新年份的县级排名数据（用于默认显示）
    const countyArray = countyDataByYear[latestYear];
    
    // 生成年份月份列表，用于播放
    const yearMonthList = [];
    monthlyData.forEach(item => {
      const key = `${item.year}-${item.month.toString().padStart(2, '0')}`;
      if (!yearMonthList.includes(key)) {
        yearMonthList.push(key);
      }
    });
    // 按年份和月份排序
    yearMonthList.sort((a, b) => {
      const [yearA, monthA] = a.split('-').map(Number);
      const [yearB, monthB] = b.split('-').map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });
    
    // 更新页面数据
    this.setData({
      annualData: annualData,
      countyData: countyArray,
      monthlyData: monthlyData,
      countyDataByYear: countyDataByYear,
      countyDataByYearMonth: countyDataByYearMonth,
      latestYear: latestYear,
      totalCounties: counties.length,
      currentYear: latestYear,
      updateTime: '2026-03-23', // 更新时间为当前日期
      yearTabs: years.slice(-3), // 显示最近3年
      availableYears: years, // 所有可用年份，用于播放
      yearMonthList: yearMonthList,
      currentYearMonth: yearMonthList.length > 0 ? yearMonthList[0] : ''
    });
    
    console.log('数据处理完成:');
    console.log('- 年度数据条数:', annualData.length);
    console.log('- 县级数据条数:', countyArray.length);
    console.log('- 月度数据条数:', monthlyData.length);
    console.log('- 最新年份:', latestYear);
    console.log('- 县区总数:', counties.length);
  },

  onLoad() {
    console.log('碳汇统计页面加载 - 使用完整分县区数据');
    
    // 处理原始数据
    this.processRawData();
    
    // 初始化月度数据计数
    this.updateMonthlyDataCount();
    
    // 提取可用的年份列表
    this.extractAvailableYears();
  },
  
  extractAvailableYears() {
    const { monthlyData } = this.data;
    if (!monthlyData || monthlyData.length === 0) {
      this.setData({ availableYears: [] });
      return;
    }
    
    // 提取所有唯一的年份，并排序
    const years = [...new Set(monthlyData.map(item => Number(item.year)))].sort((a, b) => a - b);
    console.log('可用的年份列表:', years);
    
    this.setData({ availableYears: years });
  },
  
  onReady() {
    console.log('年度数据:', this.data.annualData);
    // 初始化图表
    this.initChart();
  },
  
  onShow() {
    // 页面显示时重新初始化图表，确保显示正确
    if (this.chart) {
      setTimeout(() => {
        this.chart.resize();
      }, 50);
    }
  },

  initChart() {
    console.log('开始初始化图表...');
    console.log('echarts对象:', this.data.echarts);
    console.log('ec配置:', this.data.ec);
    
    // 设置 ec.onInit 回调
    this.setData({
      'ec.onInit': (canvas, width, height, dpr) => {
        console.log('Canvas初始化回调:', { width, height, dpr });
        console.log('Canvas对象:', canvas);
        
        if (!canvas) {
          console.error('Canvas 对象为空');
          return null;
        }
        
        try {
          console.log('开始创建ECharts实例...');
          console.log('canvas类型:', typeof canvas);
          
          // 在小程序环境中，需要给canvas对象添加addEventListener方法
          // 以避免zrender尝试调用DOM API
          if (canvas && typeof canvas.addEventListener === 'undefined') {
            canvas.addEventListener = function(event, _handler) {
              console.log('addEventListener called for event:', event);
              // 在小程序环境中，事件处理由组件本身处理
              // 这里只需要返回一个空函数避免错误
              return function() {};
            };
          }
          
          // 尝试不同的ECharts初始化方式
          let chart;
          console.log('尝试ECharts初始化...');
          
          try {
            // 方式1：最简单的初始化（推荐）
            chart = echarts.init(canvas, null, {
              width: width,
              height: height,
              devicePixelRatio: dpr
            });
            console.log('ECharts实例创建成功 (方式1)');
          } catch (err1) {
            console.log('方式1失败:', err1);
            try {
              // 方式2：使用canvas渲染器
              chart = echarts.init(canvas, 'canvas', {
                width: width,
                height: height,
                devicePixelRatio: dpr
              });
              console.log('ECharts实例创建成功 (方式2)');
            } catch (err2) {
              console.log('方式2失败:', err2);
              try {
                // 方式3：不使用ssr选项
                chart = echarts.init(canvas, {
                  width: width,
                  height: height,
                  devicePixelRatio: dpr
                });
                console.log('ECharts实例创建成功 (方式3)');
              } catch (err3) {
                console.log('方式3失败:', err3);
                console.error('所有ECharts初始化方式都失败');
                return null;
              }
            }
          }
          
          // 将chart实例设置到canvas中
          if (canvas.setChart) {
            canvas.setChart(chart);
            console.log('已设置chart到canvas');
          }
          
          const option = this.getChartOption();
          console.log('图表选项:', option);
          chart.setOption(option);
          this.chart = chart;
          console.log('图表选项设置完成');
          
          // 确保图表正确显示
          setTimeout(() => {
            try {
              console.log('确保图表正确显示...');
              chart.resize();
              // 使用forceUpdate确保图表更新
              chart.setOption(option, true);
            } catch (err) {
              console.log('图表更新失败:', err);
            }
          }, 100);
          
          return chart;
        } catch (error) {
          console.error('初始化ECharts失败:', error);
          console.error('错误详情:', error.message, error.stack);
          return null;
        }
      }
    });
  },

  getChartOption() {
    const { chartMode } = this.data;
    console.log('getChartOption 当前模式:', chartMode, '类型:', typeof chartMode);
    
    if (chartMode === 'annual') {
      console.log('返回年度统计图表');
      return this.getAnnualChartOption();
    } else if (chartMode === 'county') {
      console.log('返回县级排名图表');
      return this.getCountyChartOption();
    } else if (chartMode === 'monthly') {
      console.log('返回月度统计图表');
      return this.getMonthlyChartOption();
    }
    
    console.log('未知模式，默认返回县级图表');
    // 默认返回县级图表选项
    return this.getCountyChartOption();
  },

  getAnnualChartOption() {
    const { annualData } = this.data;
    console.log('创建年度统计图表，数据量:', annualData ? annualData.length : 0);
    console.log('年度数据详情:', annualData);
    
    if (!annualData || annualData.length === 0) {
      console.error('年度数据为空，返回默认配置');
      return {
        title: {
          text: '年度碳汇变化 (无数据)',
          left: 'center',
          top: 15,
          textStyle: { fontSize: 18, color: '#333', fontWeight: 'bold' }
        },
        xAxis: {
          type: 'category',
          data: ['无数据'],
          axisLabel: { fontSize: 14, color: '#555', fontWeight: 500 }
        },
        yAxis: {
          type: 'value',
          name: '碳汇量 (吨)',
          nameTextStyle: { fontSize: 16, color: '#333', fontWeight: 'bold' }
        },
        series: [{
          type: 'bar',
          data: [0],
          itemStyle: { color: '#4ECDC4' }
        }]
      };
    }
    
    const years = annualData.map(item => item.year);
    const values = annualData.map(item => item.value);

    const echarts = this.data.echarts;
    const barData = values.map((value, _index) => ({
      value: value,
      itemStyle: {
        color: value >= 0 ? new echarts.graphic.LinearGradient(
          0, 0, 0, 1,
          [
            { offset: 0, color: '#52c41a' },
            { offset: 0.5, color: '#4CAF50' },
            { offset: 1, color: '#2E7D32' }
          ]
        ) : new echarts.graphic.LinearGradient(
          0, 0, 0, 1,
          [
            { offset: 0, color: '#ff7875' },
            { offset: 0.5, color: '#ff4d4f' },
            { offset: 1, color: '#cf1322' }
          ]
        )
      }
    }));

    return {
      title: {
        text: '秦岭年度碳汇变化',
        left: 'center',
        top: 10,
        textStyle: { fontSize: 18, color: '#333', fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const data = params[0];
          const yearData = annualData[data.dataIndex];
          return `${yearData.year}年<br/>碳汇量: ${data.value.toFixed(2)}吨<br/>同比增长: ${yearData.change.toFixed(2)}%`;
        },
        backgroundColor: 'rgba(50, 50, 50, 0.7)',
        borderColor: '#333',
        textStyle: { color: '#fff' }
      },
      grid: {
        left: '5%',
        right: '2%',
        top: '12%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: {
          fontSize: 12,
          color: '#555',
          fontWeight: 500
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        name: '碳汇量 (吨)',
        nameTextStyle: {
          fontSize: 14,
          color: '#333',
          fontWeight: 'bold'
        },
        axisLabel: {
          fontSize: 12,
          color: '#555',
          fontWeight: 500,
          formatter: '{value}'
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#e0e0e0',
            width: 1
          }
        }
      },
      series: [{
        name: '碳汇量',
        type: 'bar',
        barWidth: '80%',
        data: barData,
        label: {
          show: true,
          position: 'right',
          fontSize: 12,
          fontWeight: 'normal',
          color: '#333',
          formatter: (params) => params.value.toFixed(0)
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }],
      dataZoom: [{
        type: 'inside',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        zoomLock: false
      }],
      animation: true,
      animationDuration: 500
    };
  },

  getCountyChartOption() {
    const { countyDataByYear, countyDataByYearMonth, currentYear, currentYearMonth, totalCounties } = this.data;
    console.log('创建县级排名图表，年份:', currentYear, '年月:', currentYearMonth);
    
    // 确定显示模式：如果 currentYearMonth 有值且存在对应数据，则显示月份排名，否则显示年份排名
    let countyData = null;
    let displayTitle = '';
    
    if (currentYearMonth && countyDataByYearMonth[currentYearMonth]) {
      // 显示月份排名
      countyData = countyDataByYearMonth[currentYearMonth];
      const [year, month] = currentYearMonth.split('-');
      displayTitle = `${year}年${parseInt(month)}月县级碳汇排名 (共${totalCounties}个县区)`;
      console.log('使用月份排名数据，年月:', currentYearMonth, '数据量:', countyData.length);
    } else {
      // 显示年份排名
      countyData = countyDataByYear[currentYear];
      if (!countyData) {
        // 如果没有当前年份的数据，使用最新年份的数据
        const years = Object.keys(countyDataByYear).map(Number).sort((a, b) => b - a);
        if (years.length > 0) {
          countyData = countyDataByYear[years[0]];
        } else {
          countyData = [];
        }
      }
      displayTitle = `${currentYear}年县级碳汇排名 (共${totalCounties}个县区)`;
      console.log('使用年份排名数据，年份:', currentYear, '数据量:', countyData.length);
    }
    
    if (!countyData || countyData.length === 0) {
      console.error('县级排名数据为空，返回默认配置');
      return {
        title: {
          text: '县级碳汇排名 (无数据)',
          left: 'center',
          top: 10,
          textStyle: { fontSize: 18, color: '#333' }
        },
        xAxis: {
          type: 'category',
          data: ['无数据'],
          axisLabel: { fontSize: 14, color: '#555', fontWeight: 500 }
        },
        yAxis: {
          type: 'value',
          name: '碳汇量 (吨)',
          nameTextStyle: { fontSize: 16, color: '#333', fontWeight: 'bold' }
        },
        series: [{
          type: 'bar',
          data: [0],
          itemStyle: { color: '#4ECDC4' }
        }]
      };
    }
    
    const counties = countyData.map(item => item.county);
    const values = countyData.map(item => item.value);
    const ranks = countyData.map(item => item.rank);

    // 根据排名设置颜色：前3名用特殊颜色，其他用绿色渐变
    const echarts = this.data.echarts;
    const barData = values.map((value, _index) => ({
      value: value,
      itemStyle: {
        color: ranks[_index] === 1 ? '#FFD700' : // 第一名金色
               ranks[_index] === 2 ? '#C0C0C0' : // 第二名银色
               ranks[_index] === 3 ? '#CD7F32' : new echarts.graphic.LinearGradient(
                 0, 0, 0, 1,
                 [
                   { offset: 0, color: '#52c41a' },
                   { offset: 0.5, color: '#4CAF50' },
                   { offset: 1, color: '#2E7D32' }
                 ]
               ) // 其他县区用绿色渐变
      }
    }));

    return {
      title: {
        text: displayTitle,
        left: 'center',
        top: 5,
        textStyle: { fontSize: 18, color: '#333', fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        formatter: '{b}: {c}吨',
        backgroundColor: 'rgba(50, 50, 50, 0.7)',
        borderColor: '#333',
        textStyle: { color: '#fff' }
      },
      grid: {
        left: '3%',
        right: '0.5%',
        top: '8%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: '碳汇量 (吨)',
        nameTextStyle: {
          fontSize: 14,
          color: '#333',
          fontWeight: 'bold'
        },
        axisLabel: {
          fontSize: 12,
          color: '#555',
          fontWeight: 500
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#e0e0e0',
            width: 1
          }
        }
      },
      yAxis: {
        type: 'category',
        data: counties,
        axisLabel: {
          fontSize: 12,
          color: '#555',
          fontWeight: 500
        },
        axisTick: {
          alignWithLabel: true,
          lineStyle: {
            width: 1
          }
        }
      },
      series: [{
        name: '碳汇量',
        type: 'bar',
        barWidth: '80%',
        data: barData,
        label: {
          show: true,
          position: 'right',
          fontSize: 12,
          fontWeight: 'normal',
          color: '#333',
          formatter: (params) => params.value.toFixed(0)
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }],
      dataZoom: [{
        type: 'inside',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        zoomLock: false
      }],
      animation: true,
      animationDuration: 500
    };
  },

  getMonthlyChartOption() {
    const { monthlyData, currentYear } = this.data;
    console.log('创建月度统计图表，年份:', currentYear);
    
    // 获取当前年份的数据
    const yearData = monthlyData
      .filter(item => Number(item.year) === currentYear)
      .sort((a, b) => a.month - b.month);
    
    console.log('当前年份数据量:', yearData.length);
    
    if (!yearData || yearData.length === 0) {
      // 如果没有数据，返回一个简单的图表配置
      return {
        title: {
          text: `${currentYear}年碳汇月度变化`,
          left: 'center',
          top: 10,
          textStyle: { fontSize: 18, color: '#333' }
        },
        xAxis: {
          type: 'category',
          data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
          axisLabel: {
            fontSize: 12,
            color: '#666'
          }
        },
        yAxis: {
          type: 'value',
          name: '碳汇量 (吨)',
          nameTextStyle: {
            fontSize: 12,
            color: '#666'
          }
        },
        series: [{
          type: 'bar',
          data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          itemStyle: {
            color: '#4ECDC4'
          }
        }],
        dataZoom: [{
          type: 'inside',
          xAxisIndex: 0,
          start: 0,
          end: 100,
          zoomLock: false
        }]
      };
    }
    
    // 使用实际数据
    const months = yearData.map(item => `${item.month}月`);
    const values = yearData.map(item => item.value);

    // 创建bar数据，设置颜色
    const echarts = this.data.echarts;
    const barData = values.map((value, _index) => ({
      value: value,
      itemStyle: {
        color: value >= 0 ? new echarts.graphic.LinearGradient(
          0, 0, 0, 1,
          [
            { offset: 0, color: '#52c41a' },
            { offset: 0.5, color: '#4CAF50' },
            { offset: 1, color: '#2E7D32' }
          ]
        ) : new echarts.graphic.LinearGradient(
          0, 0, 0, 1,
          [
            { offset: 0, color: '#ff7875' },
            { offset: 0.5, color: '#ff4d4f' },
            { offset: 1, color: '#cf1322' }
          ]
        )
      }
    }));

    return {
      title: {
        text: `${currentYear}年碳汇月度变化`,
        left: 'center',
        top: 5,
        textStyle: { fontSize: 18, color: '#333' }
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const data = params[0];
          const monthData = yearData[data.dataIndex];
          return `${currentYear}年${monthData.month}月<br/>碳汇量: ${data.value.toFixed(2)}吨`;
        },
        backgroundColor: 'rgba(50, 50, 50, 0.7)',
        borderColor: '#333',
        textStyle: { color: '#fff' }
      },
      grid: {
        left: '5%',
        right: '2%',
        top: '12%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: {
          fontSize: 12,
          color: '#555',
          fontWeight: 500
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        name: '碳汇量 (吨)',
        nameTextStyle: {
          fontSize: 14,
          color: '#333',
          fontWeight: 'bold'
        },
        axisLabel: {
          fontSize: 12,
          color: '#555',
          fontWeight: 500,
          formatter: '{value}'
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#e0e0e0',
            width: 1
          }
        }
      },
      series: [{
        name: '碳汇量',
        type: 'bar',
        barWidth: '80%',
        data: barData,
        label: {
          show: true,
          position: 'right',
          fontSize: 12,
          fontWeight: 'normal',
          color: '#333',
          formatter: (params) => params.value.toFixed(0)
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }],
      dataZoom: [{
        type: 'inside',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        zoomLock: false
      }],
      animation: true,
      animationDuration: 500
    };
  },

  switchChartMode(event) {
    // 从事件对象中获取mode参数
    const mode = event.currentTarget.dataset.mode;
    console.log('切换图表模式:', mode, '当前模式:', this.data.chartMode);
    console.log('事件对象:', event);
    console.log('dataset:', event.currentTarget.dataset);
    
    if (!mode || mode === this.data.chartMode) return;
    
    // 停止播放（如果正在播放）
    if (this.data.isPlaying) {
      this.stopPlay();
    }
    
    // 准备新的数据设置
    const newData = { 
      chartMode: mode,
      currentYearIndex: 0,
      currentCountyIndex: 0
    };
    
    // 根据模式设置当前显示项
    if (mode === 'county') {
      // 县级排名模式：设置默认年月为第一个月份
      const { yearMonthList } = this.data;
      if (yearMonthList && yearMonthList.length > 0) {
        newData.currentYearMonth = yearMonthList[0];
      }
    } else if (mode === 'monthly') {
      // 月度统计模式：确保当前年份有效
      const { availableYears, currentYear } = this.data;
      if (availableYears && availableYears.length > 0 && !availableYears.includes(currentYear)) {
        newData.currentYear = availableYears[0];
      }
      this.updateMonthlyDataCount();
    }
    
    this.setData(newData, () => {
      console.log('模式切换完成，新模式:', this.data.chartMode);
      console.log('年度数据长度:', this.data.annualData ? this.data.annualData.length : 0);
      console.log('县级数据长度:', this.data.countyData ? this.data.countyData.length : 0);
      console.log('月度数据长度:', this.data.monthlyData ? this.data.monthlyData.length : 0);
      
      if (this.chart) {
        const option = this.getChartOption();
        console.log('生成的图表选项:', option ? '有效' : '无效');
        console.log('图表选项详情:', option);
        this.chart.setOption(option);
      }
    });
  },

  formatYearMonth(yearMonth) {
    if (!yearMonth) return '';
    const [year, month] = yearMonth.split('-');
    return `${year}年${parseInt(month)}月`;
  },

  getCountyTotal() {
    const { countyData } = this.data;
    if (!countyData || countyData.length === 0) return '0.00';
    const total = countyData.reduce((sum, item) => sum + item.value, 0);
    return total.toFixed(2);
  },

  getCountyAvg() {
    const { countyData } = this.data;
    if (!countyData || countyData.length === 0) return '0.00';
    const total = countyData.reduce((sum, item) => sum + item.value, 0);
    return (total / countyData.length).toFixed(2);
  },

  getYearTotal() {
    const { monthlyData, currentYear } = this.data;
    if (!monthlyData || monthlyData.length === 0) return '0.00';
    const yearData = monthlyData.filter(item => Number(item.year) === currentYear);
    if (yearData.length === 0) return '0.00';
    const total = yearData.reduce((sum, item) => sum + item.value, 0);
    return total.toFixed(2);
  },

  getMonthlyDataCount() {
    const { monthlyData, currentYear } = this.data;
    if (!monthlyData || monthlyData.length === 0) return 0;
    const yearData = monthlyData.filter(item => Number(item.year) === currentYear);
    return yearData.length;
  },

  updateMonthlyDataCount() {
    const { monthlyData, currentYear } = this.data;
    let count = 0;
    if (monthlyData && monthlyData.length > 0) {
      const yearData = monthlyData.filter(item => Number(item.year) === currentYear);
      count = yearData.length;
    }
    this.setData({
      monthlyDataCount: count
    });
  },

  switchYear(event) {
    const year = event.currentTarget.dataset.year;
    console.log('切换年份:', year, '当前年份:', this.data.currentYear);
    
    if (!year || year === this.data.currentYear) return;
    
    this.setData({
      currentYear: Number(year)
    }, () => {
      console.log('年份切换完成，新年份:', this.data.currentYear);
      this.updateMonthlyDataCount();
      
      if (this.data.chartMode === 'monthly' && this.chart) {
        const option = this.getChartOption();
        console.log('更新月度图表选项');
        this.chart.setOption(option);
      }
    });
  },

  // 播放控制方法 - 根据图表模式选择轮播单位
  togglePlay() {
    const { isPlaying, chartMode, availableYears, yearMonthList } = this.data;
    
    if (isPlaying) {
      // 停止播放
      this.stopPlay();
    } else {
      // 开始播放，根据图表模式选择播放列表
      let playList = [];
      if (chartMode === 'county') {
        // 县级排名模式：按月份播放
        playList = yearMonthList;
      } else if (chartMode === 'monthly') {
        // 月度统计模式：按年份播放
        playList = availableYears;
      } else {
        console.log('当前图表模式不支持播放');
        return;
      }
      
      if (!playList || playList.length === 0) {
        console.log('没有可播放的数据');
        return;
      }
      
      // 设置播放状态
      this.setData({
        isPlaying: true
      });
      
      // 设置定时器
      const intervalId = setInterval(() => {
        this.nextItem();
      }, this.data.playSpeed);
      
      this.setData({
        playIntervalId: intervalId
      });
      
      console.log(`开始${chartMode === 'county' ? '按月份' : '按年份'}播放，速度:`, this.data.playSpeed, 'ms');
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
    this.nextItem();
  },
  
  nextItem() {
    const { chartMode, availableYears, currentYear, yearMonthList, currentYearMonth } = this.data;
    
    if (chartMode === 'county') {
      // 县级排名模式：按月份切换
      if (!yearMonthList || yearMonthList.length === 0) return;
      
      // 找到当前年月在列表中的位置
      let currentIndex = yearMonthList.indexOf(currentYearMonth);
      if (currentIndex === -1) {
        currentIndex = 0;
      }
      
      // 计算下一个月份索引
      let nextIndex = currentIndex + 1;
      if (nextIndex >= yearMonthList.length) {
        nextIndex = 0; // 循环播放
      }
      
      const nextYearMonth = yearMonthList[nextIndex];
      
      this.setData({
        currentYearMonth: nextYearMonth
      }, () => {
        // 更新图表
        if (this.chart) {
          const option = this.getChartOption();
          this.chart.setOption(option);
        }
      });
    } else if (chartMode === 'monthly') {
      // 月度统计模式：按年份切换
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
        // 更新图表
        if (this.chart) {
          const option = this.getChartOption();
          this.chart.setOption(option);
        }
      });
    }
  },
  
  prevYear() {
    this.prevItem();
  },
  
  prevItem() {
    const { chartMode, availableYears, currentYear, yearMonthList, currentYearMonth } = this.data;
    
    if (chartMode === 'county') {
      // 县级排名模式：按月份切换
      if (!yearMonthList || yearMonthList.length === 0) return;
      
      // 找到当前年月在列表中的位置
      let currentIndex = yearMonthList.indexOf(currentYearMonth);
      if (currentIndex === -1) {
        currentIndex = yearMonthList.length - 1;
      }
      
      // 计算上一个月份索引
      let prevIndex = currentIndex - 1;
      if (prevIndex < 0) {
        prevIndex = yearMonthList.length - 1; // 循环播放
      }
      
      const prevYearMonth = yearMonthList[prevIndex];
      
      this.setData({
        currentYearMonth: prevYearMonth
      }, () => {
        // 更新图表
        if (this.chart) {
          const option = this.getChartOption();
          this.chart.setOption(option);
        }
      });
    } else if (chartMode === 'monthly') {
      // 月度统计模式：按年份切换
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
        // 更新图表
        if (this.chart) {
          const option = this.getChartOption();
          this.chart.setOption(option);
        }
      });
    }
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
  }
});