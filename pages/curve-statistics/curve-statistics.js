import * as echarts from '../../miniprogram_npm/echarts/index';
import monthlyData from '../../data/monthly_data.js';

Page({
  data: {
    echarts: echarts, // 直接传入 echarts 对象
    ec: { 
      lazyLoad: false // 改为 false，立即加载
    },
    monthlyData: monthlyData, // 所有月度数据
    currentYear: 2020, // 默认显示2020年
    years: [], // 所有可用年份
    currentYearData: [], // 当前年份的月度数据
    isPlaying: false,
    timer: null,
    autoPlayInterval: 2000, // 自动播放间隔
    yearTotal: '0.00' // 年度总量
  },

  onLoad() {
    console.log('曲线统计页面加载');
    // 提取所有不重复的年份
    const yearsSet = new Set();
    monthlyData.forEach(item => {
      yearsSet.add(item.year);
    });
    const years = Array.from(yearsSet).sort((a, b) => a - b);
    
    this.setData({
      years,
      currentYear: years[years.length - 1] // 默认显示最新年份
    }, () => {
      this.updateCurrentYearData();
      // 初始化图表
      this.initChart();
    });
  },

  onReady() {
    // 页面渲染完成后再次初始化图表，确保显示正确
    setTimeout(() => {
      if (!this.chart) {
        this.initChart();
      } else {
        this.chart.resize();
      }
    }, 200);
  },
  
  onShow() {
    // 页面显示时重新调整图表大小
    if (this.chart) {
      setTimeout(() => {
        this.chart.resize();
      }, 50);
    }
  },

  // 更新当前年份的数据
  updateCurrentYearData() {
    const { monthlyData, currentYear } = this.data;
    const yearData = monthlyData
      .filter(item => item.year === currentYear)
      .sort((a, b) => a.month - b.month);
    
    // 计算年度总量
    const yearTotal = yearData.reduce((sum, item) => sum + item.value, 0);
    
    this.setData({ 
      currentYearData: yearData,
      yearTotal: yearTotal.toFixed(2)
    });
  },



  // 初始化图表
  initChart() {
    console.log('曲线统计：开始初始化图表...');
    console.log('曲线统计：echarts对象:', this.data.echarts);
    console.log('曲线统计：ec配置:', this.data.ec);
    
    // 设置 ec.onInit 回调
    this.setData({
      'ec.onInit': (canvas, width, height, dpr) => {
        console.log('曲线统计：Canvas初始化回调:', { width, height, dpr });
        console.log('曲线统计：Canvas对象:', canvas);
        
        if (!canvas) {
          console.error('Canvas 对象为空');
          return null;
        }
        
        try {
          console.log('曲线统计：开始创建ECharts实例...');
          console.log('曲线统计：canvas类型:', typeof canvas);
          
          // ECharts 5.x 在小程序环境中需要传入宽度、高度和devicePixelRatio
          const chart = echarts.init(canvas, null, {
            width: width,
            height: height,
            devicePixelRatio: dpr
          });
          console.log('曲线统计：ECharts实例创建成功');
          
          // 将chart实例设置到canvas中
          if (canvas.setChart) {
            canvas.setChart(chart);
            console.log('曲线统计：已设置chart到canvas');
          }
          
          chart.setOption(this.getChartOption());
          this.chart = chart;
          console.log('曲线统计：图表选项设置完成');
          return chart;
        } catch (error) {
          console.error('初始化ECharts失败:', error);
          console.error('错误详情:', error.message, error.stack);
          return null;
        }
      }
    });
  },

  // 获取图表配置
  getChartOption() {
    const { currentYearData, currentYear } = this.data;
    
    // 准备数据
    const months = currentYearData.map(item => `${item.month}月`);
    const values = currentYearData.map(item => item.value);
    
    // 计算Y轴范围，考虑负值
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    let yMin, yMax;
    
    if (minValue < 0 && maxValue > 0) {
      // 既有负值又有正值
      const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));
      yMin = -absMax * 1.2;
      yMax = absMax * 1.2;
    } else if (minValue < 0) {
      // 只有负值
      yMin = minValue * 1.2;
      yMax = Math.abs(minValue) * 0.2;
    } else {
      // 只有正值
      yMin = 0;
      yMax = maxValue * 1.1;
    }

    // 根据数值正负设置线条颜色
    const lineColor = minValue < 0 ? '#FF6B6B' : '#4ECDC4';
    const areaColor = minValue < 0 ? 'rgba(255, 107, 107, 0.1)' : 'rgba(78, 205, 196, 0.1)';

    return {
      title: {
        text: `${currentYear}年 月度碳汇曲线`,
        left: 'center',
        top: 10,
        textStyle: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#333'
        }
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const item = params[0];
          const dataItem = currentYearData[item.dataIndex];
          return `${currentYear}年${dataItem.month}月<br/>碳汇量: ${item.value.toFixed(2)} 吨`;
        }
      },
      grid: {
        left: '3%',
        right: '3%',
        top: '18%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: {
          fontSize: 16,
          color: '#666',
          fontWeight: 'bold'
        },
        axisLine: {
          lineStyle: {
            color: '#d9d9d9'
          }
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        name: '碳汇量 (吨)',
        nameTextStyle: {
          fontSize: 18,
          color: '#666',
          fontWeight: 'bold'
        },
        axisLabel: {
          fontSize: 16,
          color: '#666',
          fontWeight: 'bold'
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#e8e8e8'
          }
        },
        min: yMin,
        max: yMax
      },
      series: [{
        name: '碳汇量',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 4,
          color: lineColor
        },
        itemStyle: {
          color: lineColor,
          borderColor: '#fff',
          borderWidth: 2
        },
        areaStyle: {
          color: areaColor
        },
        data: values,
        markPoint: {
          data: [
            { type: 'max', name: '最大值' },
            { type: 'min', name: '最小值' }
          ],
          symbolSize: 50,
          label: {
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        markLine: {
          data: [
            { type: 'average', name: '平均值' }
          ],
          label: {
            fontSize: 14,
            fontWeight: 'bold'
          }
        }
      }],
      animation: true,
      animationDuration: 1000
    };
  },

  // 年份选择变化
  onYearChange(e) {
    const year = parseInt(e.detail.value);
    this.setData({
      currentYear: year
    }, () => {
      this.updateCurrentYearData();
      this.updateChart();
    });
  },

  // 更新图表
  updateChart() {
    if (!this.chart) return;
    this.chart.setOption(this.getChartOption());
  },

  // 切换到上一年
  prevYear() {
    const { years, currentYear } = this.data;
    const currentIndex = years.indexOf(currentYear);
    if (currentIndex > 0) {
      const prevYear = years[currentIndex - 1];
      this.setData({
        currentYear: prevYear
      }, () => {
        this.updateCurrentYearData();
        this.updateChart();
      });
    }
  },

  // 切换到下一年
  nextYear() {
    const { years, currentYear } = this.data;
    const currentIndex = years.indexOf(currentYear);
    if (currentIndex < years.length - 1) {
      const nextYear = years[currentIndex + 1];
      this.setData({
        currentYear: nextYear
      }, () => {
        this.updateCurrentYearData();
        this.updateChart();
      });
    }
  },

  // 开始/暂停自动播放
  toggleAutoPlay() {
    if (this.data.timer) {
      this.pauseAutoPlay();
    } else {
      this.startAutoPlay();
    }
  },

  // 开始自动播放
  startAutoPlay() {
    if (this.data.timer) clearInterval(this.data.timer);
    
    const timer = setInterval(() => {
      const { years, currentYear } = this.data;
      const currentIndex = years.indexOf(currentYear);
      const nextIndex = (currentIndex + 1) % years.length;
      const nextYear = years[nextIndex];
      
      this.setData({
        currentYear: nextYear
      }, () => {
        this.updateCurrentYearData();
        this.updateChart();
      });
    }, this.data.autoPlayInterval);
    
    this.setData({
      timer,
      isPlaying: true
    });
  },

  // 暂停自动播放
  pauseAutoPlay() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({
        timer: null,
        isPlaying: false
      });
    }
  },

  // 重置到最新年份
  resetToLatest() {
    const { years } = this.data;
    const latestYear = years[years.length - 1];
    this.setData({
      currentYear: latestYear
    }, () => {
      this.updateCurrentYearData();
      this.updateChart();
    });
  },

  onUnload() {
    // 清理定时器
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  }
});