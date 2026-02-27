// 碳汇统计页面 - 回退版本（县级排名数据为固定聚合数据）
import * as echarts from '../../miniprogram_npm/echarts/index';
import carbonData from '../../data/carbonData.js';
import monthlyData from '../../data/monthly_data.js';

Page({
  data: {
    echarts: echarts, // 直接传入 echarts 对象
    ec: { 
      lazyLoad: false // 改为 false，立即加载
    },
    annualData: carbonData.annualData || [],
    countyData: carbonData.countyRanking || [],
    monthlyData: monthlyData || [],
    currentYearIndex: 0,
    currentCountyIndex: 0,
    latestYear: carbonData.latestYear || 2022,
    updateTime: carbonData.updateTime || '',
    chartMode: 'county', // 'annual' 或 'county' 或 'monthly'
    totalCounties: carbonData.totalCounties || 40,
    currentYear: carbonData.latestYear || 2022, // 当前选择的年份
    monthlyDataCount: 0,
    availableYears: [] // 可用的年份列表
  },

  onLoad() {
    console.log('碳汇统计页面加载');
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
          top: 10,
          textStyle: { fontSize: 18, color: '#333' }
        },
        xAxis: {
          type: 'category',
          data: ['无数据'],
          axisLabel: { fontSize: 12, color: '#666' }
        },
        yAxis: {
          type: 'value',
          name: '碳汇量 (吨)',
          nameTextStyle: { fontSize: 12, color: '#666' }
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

    const barData = values.map((value, _index) => ({
      value: value,
      itemStyle: {
        color: value >= 0 ? '#4ECDC4' : '#FF6B6B'
      }
    }));

    return {
      title: {
        text: '秦岭年度碳汇变化',
        left: 'center',
        top: 10,
        textStyle: { fontSize: 18, color: '#333' }
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
        right: '5%',
        top: '20%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: {
          fontSize: 12,
          color: '#666'
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        name: '碳汇量 (吨)',
        nameTextStyle: {
          fontSize: 12,
          color: '#666'
        },
        axisLabel: {
          fontSize: 12,
          color: '#666',
          formatter: '{value}'
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#e0e0e0'
          }
        }
      },
      series: [{
        name: '碳汇量',
        type: 'bar',
        barWidth: '60%',
        data: barData,
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
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
    const { countyData, totalCounties } = this.data;
    console.log('创建县级排名图表，数据量:', countyData.length);
    
    const counties = countyData.map(item => item.county);
    const values = countyData.map(item => item.value);
    const ranks = countyData.map(item => item.rank);

    // 根据排名设置颜色：前3名用特殊颜色
    const barData = values.map((value, _index) => ({
      value: value,
      itemStyle: {
        color: ranks[_index] === 1 ? '#FFD700' : // 第一名金色
               ranks[_index] === 2 ? '#C0C0C0' : // 第二名银色
               ranks[_index] === 3 ? '#CD7F32' : '#4ECDC4' // 其他县区
      }
    }));

    return {
      title: {
        text: `县级碳汇排名 (共${totalCounties}个县区)`,
        left: 'center',
        top: 10,
        textStyle: { fontSize: 18, color: '#333' }
      },
      tooltip: {
        trigger: 'axis',
        formatter: '{b}: {c}吨',
        backgroundColor: 'rgba(50, 50, 50, 0.7)',
        borderColor: '#333',
        textStyle: { color: '#fff' }
      },
      grid: {
        left: '5%',
        right: '5%',
        top: '20%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: counties,
        axisLabel: {
          fontSize: 10,
          rotate: 45,
          color: '#666'
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        name: '碳汇量 (吨)',
        nameTextStyle: {
          fontSize: 12,
          color: '#666'
        },
        axisLabel: {
          fontSize: 12,
          color: '#666'
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#e0e0e0'
          }
        }
      },
      series: [{
        name: '碳汇量',
        type: 'bar',
        barWidth: '60%',
        data: barData,
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
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
    const barData = values.map((value, _index) => ({
      value: value,
      itemStyle: {
        color: value >= 0 ? '#4ECDC4' : '#FF6B6B'
      }
    }));

    return {
      title: {
        text: `${currentYear}年碳汇月度变化`,
        left: 'center',
        top: 10,
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
        right: '5%',
        top: '20%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: {
          fontSize: 12,
          color: '#666'
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        name: '碳汇量 (吨)',
        nameTextStyle: {
          fontSize: 12,
          color: '#666'
        },
        axisLabel: {
          fontSize: 12,
          color: '#666',
          formatter: '{value}'
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#e0e0e0'
          }
        }
      },
      series: [{
        name: '碳汇量',
        type: 'bar',
        barWidth: '60%',
        data: barData,
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
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
    
    this.setData({ 
      chartMode: mode,
      currentYearIndex: 0,
      currentCountyIndex: 0
    }, () => {
      console.log('模式切换完成，新模式:', this.data.chartMode);
      console.log('年度数据长度:', this.data.annualData ? this.data.annualData.length : 0);
      console.log('县级数据长度:', this.data.countyData ? this.data.countyData.length : 0);
      console.log('月度数据长度:', this.data.monthlyData ? this.data.monthlyData.length : 0);
      
      if (mode === 'monthly') {
        this.updateMonthlyDataCount();
      }
      if (this.chart) {
        const option = this.getChartOption();
        console.log('生成的图表选项:', option ? '有效' : '无效');
        console.log('图表选项详情:', option);
        this.chart.setOption(option);
      }
    });
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

  onUnload() {
    // 清理工作
  }
});