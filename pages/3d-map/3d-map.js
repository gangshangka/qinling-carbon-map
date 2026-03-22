// pages/3d-map/3d-map.js
import * as echarts from '../../miniprogram_npm/echarts/index';
// 碳汇数据（分县区、分月份）
const carbonData = require('../../data/carbonData2.js');

Page({
  data: {
    echarts: echarts, // echarts库对象
    ec: {
      lazyLoad: false // ec-canvas配置
    },
    years: [], // 可用年份
    months: Array.from({length: 12}, (_, i) => i + 1), // 1-12月
    yearIndex: 0,
    monthIndex: 0,
    heightScale: 100, // 柱状图高度比例
    selectedCounty: '',
    selectedValue: 0,
    selectedYear: 0,
    selectedMonth: 0,
    countyCoords: {}, // 县区坐标映射
    mapLoaded: false, // 地图是否已加载
    chartInitialized: false // 图表是否已初始化
  },

  onLoad() {
    console.log('3D地图页面加载');
    
    // 初始化县区坐标（简化版，使用虚拟坐标）
    this.initCountyCoords();
    
    // 提取可用年份
    const years = Object.keys(carbonData).map(year => parseInt(year)).sort((a, b) => a - b);
    this.setData({
      years: years,
      yearIndex: years.length - 1, // 默认选择最新年份
      selectedYear: years[years.length - 1] || 2022,
      selectedMonth: 1
    });
  },

  // 初始化县区坐标（虚拟坐标，实际应用应使用真实地理坐标）
  initCountyCoords() {
    console.log('初始化县区虚拟坐标');
    
    try {
      // 从carbonData中获取所有县区名称
      const firstYear = Object.keys(carbonData)[0];
      const firstMonth = Object.keys(carbonData[firstYear])[0];
      const counties = Object.keys(carbonData[firstYear][firstMonth]);
      
      console.log('找到县区数量:', counties.length);
      
      // 为每个县区分配虚拟坐标（在2D平面上均匀分布）
      const countyCoords = {};
      const gridSize = Math.ceil(Math.sqrt(counties.length));
      // 将坐标归一化到0-5范围内
      counties.forEach((county, index) => {
        const gridX = index % gridSize;
        const gridY = Math.floor(index / gridSize);
        // 将坐标映射到0-5范围内
        const x = (gridX / gridSize) * 5;
        const y = (gridY / gridSize) * 5;
        countyCoords[county] = { x, y };
      });
      
      this.setData({ countyCoords });
      console.log('虚拟坐标生成完成');
      
    } catch (error) {
      console.error('初始化县区坐标时出错:', error);
      // 如果出错，使用随机坐标
      const fallbackCoords = {
        '测试县1': { x: 0.5, y: 0.5 },
        '测试县2': { x: 1.5, y: 0.5 },
        '测试县3': { x: 0.5, y: 1.5 },
        '测试县4': { x: 1.5, y: 1.5 }
      };
      this.setData({ countyCoords: fallbackCoords });
    }
  },

  // 初始化图表
  initChart() {
    console.log('初始化图表，设置ec.onInit回调');
    
    // 保存this引用，确保在回调中可以访问
    const self = this;
    
    // 设置ec.onInit回调，这是官方echarts-for-weixin组件的标准用法
    this.setData({
      'ec.onInit': (canvas, width, height, dpr) => {
        console.log('Canvas初始化回调:', { width, height, dpr });
        console.log('echarts变量是否可用:', typeof echarts);
        
        if (!canvas) {
          console.error('Canvas对象为空');
          return null;
        }
        
        try {
          console.log('开始创建ECharts实例...');
          
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
          
          // 补丁：确保事件对象有preventDefault方法，避免TypeError
          // 这是ECharts在小程序环境中的兼容性问题
          if (canvas && typeof canvas.addEventListener !== 'undefined') {
            // 保存原始的addEventListener
            const originalAddEventListener = canvas.addEventListener;
            canvas.addEventListener = function(eventName, handler) {
              // 包装事件处理器
              const wrappedHandler = function(e) {
                if (e && typeof e.preventDefault === 'undefined') {
                  e.preventDefault = function() {
                    // 空函数，避免TypeError
                  };
                }
                return handler(e);
              };
              return originalAddEventListener.call(this, eventName, wrappedHandler);
            };
          }
          
          // 尝试不同的ECharts初始化方式，类似于carbon-chart页面
          let chart;
          console.log('尝试ECharts初始化...');
          
          try {
            // 方式1：最简单的初始化（推荐）
            chart = echarts.init(canvas, null, {
              width: width,
              height: height,
              devicePixelRatio: Math.min(dpr, 2) // 限制dpr，避免内存问题
            });
            console.log('ECharts实例创建成功 (方式1)');
          } catch (err1) {
            console.log('方式1失败:', err1);
            try {
              // 方式2：使用canvas渲染器
              chart = echarts.init(canvas, 'canvas', {
                width: width,
                height: height,
                devicePixelRatio: Math.min(dpr, 2)
              });
              console.log('ECharts实例创建成功 (方式2)');
            } catch (err2) {
              console.log('方式2失败:', err2);
              try {
                // 方式3：不使用ssr选项
                chart = echarts.init(canvas, {
                  width: width,
                  height: height,
                  devicePixelRatio: Math.min(dpr, 2)
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
          
          // 保存chart实例到Page对象
          self.chart = chart;
          self.setData({
            chartInitialized: true
          });
          
          console.log('图表实例已设置，设置初始选项');
          
          // 设置一个简单的初始选项，包含测试数据，确保图表能显示
          const initialOption = {
            title: {
              text: '秦岭碳汇3D分布',
              left: 'center',
              textStyle: { color: '#333', fontSize: 16 }
            },
            tooltip: {
              formatter: function(params) {
                return `${params.name}<br/>碳汇值: ${params.value[2].toFixed(2)} tC`;
              }
            },
            visualMap: {
              show: true,
              dimension: 2,
              min: -5,
              max: 15,
              inRange: {
                color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
              },
              textStyle: { color: '#333' }
            },
            xAxis: {
              type: 'value',
              name: 'X坐标',
              min: 0,
              max: 5,
              axisLabel: { show: true },
              axisLine: { show: true },
              splitLine: { show: true }
            },
            yAxis: {
              type: 'value',
              name: 'Y坐标',
              min: 0,
              max: 5,
              axisLabel: { show: true },
              axisLine: { show: true },
              splitLine: { show: true }
            },
            grid: {
              left: '10%',
              right: '10%',
              bottom: '15%',
              top: '15%',
              containLabel: true
            },
            series: [{
              type: 'scatter',
              data: [
                { name: '测试县1', value: [0.5, 0.5, 5.5] },
                { name: '测试县2', value: [1.5, 0.5, 8.2] },
                { name: '测试县3', value: [0.5, 1.5, 3.7] },
                { name: '测试县4', value: [1.5, 1.5, 6.9] }
              ],
              symbolSize: function(data) {
                // 根据碳汇值的绝对值计算点大小
                const value = Math.abs(data[2]);
                return Math.max(10, value * 5); // 基础大小10，按比例放大
              },
              label: { show: false },
              emphasis: {
                label: {
                  show: true,
                  formatter: '{b}',
                  textStyle: {
                    fontSize: 12,
                    color: '#333',
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    padding: [2, 4],
                    borderRadius: 2
                  }
                },
                itemStyle: { color: '#ff9800' }
              },
              itemStyle: { 
                opacity: 0.9,
                borderColor: '#fff',
                borderWidth: 1
              }
            }]
          };
          
          chart.setOption(initialOption);
          console.log('初始图表选项设置完成');
          
          // 延迟更新真实数据，避免递归
          setTimeout(() => {
            if (self.chart === chart && self.data.chartInitialized) {
              console.log('开始延迟更新图表数据');
              self.updateChart();
            }
          }, 500);
          
          return chart;
          
        } catch (error) {
          console.error('创建ECharts实例失败:', error);
          console.error('错误详情:', error.message, error.stack);
          return null;
        }
      }
    });
  },
  
  // 检查canvas是否初始化
  checkCanvasInit() {
    const query = wx.createSelectorQuery();
    query.select('#chart').fields({
      node: true,
      size: true
    }).exec((res) => {
      if (res && res[0] && res[0].node) {
        console.log('canvas节点存在，但未触发init事件');
        // 尝试手动触发图表更新
        if (this.chart) {
          this.updateChart();
        }
      } else {
        console.log('canvas节点未找到');
      }
    });
  },



  // 更新图表数据
  updateChart() {
    console.log('updateChart 调用，chart实例:', this.chart, 'chartInitialized:', this.data.chartInitialized);
    if (!this.chart || !this.data.chartInitialized) {
      console.error('图表实例不存在或未初始化，无法更新');
      return;
    }

    // 3D图表使用虚拟坐标，不需要加载GeoJSON地图数据
    // 注释掉地图加载，避免可能的递归问题
    // this.loadGeoJSONMap();

    const { yearIndex, monthIndex, years, months, heightScale, countyCoords } = this.data;
    const year = years[yearIndex];
    const month = months[monthIndex];
    
    console.log('选择的年份月份:', year, month);
    
    // 测试数据 - 确保图表能显示
    const testData = [
      { name: '测试县1', value: [0.5, 0.5, 5.5] },
      { name: '测试县2', value: [1.5, 0.5, 8.2] },
      { name: '测试县3', value: [0.5, 1.5, 3.7] },
      { name: '测试县4', value: [1.5, 1.5, 6.9] }
    ];

    // 尝试加载真实数据
    let data = testData;
    let useRealData = false;
    
    if (carbonData && carbonData[year] && carbonData[year][month]) {
      console.log('找到真实数据，尝试加载');
      try {
        const monthData = carbonData[year][month];
        const counties = Object.keys(monthData);
        console.log('县区数量:', counties.length);
        
        if (counties.length > 0) {
          data = counties.slice(0, 10).map(county => { // 限制数量以便测试
            const value = monthData[county];
            const coords = countyCoords[county] || { x: Math.random() * 5, y: Math.random() * 5 };
            return {
              name: county,
              value: [
                coords.x,
                coords.y,
                value  // 原始碳汇值，用于颜色映射
              ]
            };
          });
          useRealData = true;
          console.log('成功加载真实数据，数量:', data.length);
        }
      } catch (error) {
        console.error('加载真实数据时出错:', error);
      }
    } else {
      console.warn('未找到对应数据，使用测试数据');
    }

    // 简化的配置项，确保3D图表能显示
    const option = {
      title: {
        text: useRealData ? `${year}年${month}月碳汇3D分布` : '测试3D图表',
        left: 'center',
        textStyle: { color: '#333', fontSize: 16 }
      },
      tooltip: {
        formatter: function(params) {
          return `${params.name}<br/>碳汇值: ${params.value[2].toFixed(2)} tC`;
        }
      },
      visualMap: {
        show: true,
        dimension: 2,
        min: -5,
        max: 15,
        inRange: {
          color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
        },
        textStyle: { color: '#333' }
      },
      xAxis: {
        type: 'value',
        name: 'X坐标',
        min: 0,
        max: 5,
        axisLabel: { show: true },
        axisLine: { show: true },
        splitLine: { show: true }
      },
      yAxis: {
        type: 'value',
        name: 'Y坐标',
        min: 0,
        max: 5,
        axisLabel: { show: true },
        axisLine: { show: true },
        splitLine: { show: true }
      },
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      series: [{
        type: 'scatter',
        data: data,
        symbolSize: function(data) {
          // data是value数组: [x, y, value]
          const value = Math.abs(data[2]);
          const size = Math.max(8, value * (heightScale / 100) * 3);
          return size;
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            formatter: '{b}',
            textStyle: {
              fontSize: 12,
              color: '#333',
              backgroundColor: 'rgba(255,255,255,0.8)',
              padding: [2, 4],
              borderRadius: 2
            }
          },
          itemStyle: { color: '#ff9800' }
        },
        itemStyle: { 
          opacity: 0.9,
          borderColor: '#fff',
          borderWidth: 1
        }
      }]
    };

    console.log('设置图表选项');
    try {
      this.chart.setOption(option);
      console.log('图表选项设置成功');
    } catch (error) {
      console.error('设置图表选项时出错:', error);
    }
  },

  // 加载GeoJSON地图数据
  loadGeoJSONMap() {
    console.log('尝试加载GeoJSON地图数据');
    // 检查是否已经加载过
    if (this.data.mapLoaded) {
      console.log('地图已加载');
      return;
    }

    wx.request({
      url: '../../data/qinling.geojson',
      success: (res) => {
        console.log('GeoJSON加载成功，数据大小:', JSON.stringify(res.data).length);
        try {
          // 注册地图到echarts
          echarts.registerMap('qinling', res.data);
          console.log('地图注册成功: qinling');
          
          // 标记地图已加载
          this.setData({ mapLoaded: true });
          
          // 如果需要，可以在这里解析区域中心点坐标
          // this.parseGeoJSONCenters(res.data);
          
        } catch (error) {
          console.error('注册地图时出错:', error);
        }
      },
      fail: (err) => {
        console.warn('加载GeoJSON失败，使用虚拟坐标:', err);
        // 即使地图加载失败，也不影响3D图表的显示
      }
    });
  },

  // 年份改变事件
  onYearChange(e) {
    const index = e.detail.value;
    this.setData({
      yearIndex: index,
      selectedYear: this.data.years[index]
    });
    if (this.data.chartInitialized) {
      this.updateChart();
    } else {
      console.log('图表未初始化，跳过更新');
    }
  },

  // 月份改变事件
  onMonthChange(e) {
    const index = e.detail.value;
    this.setData({
      monthIndex: index,
      selectedMonth: this.data.months[index]
    });
    if (this.data.chartInitialized) {
      this.updateChart();
    } else {
      console.log('图表未初始化，跳过更新');
    }
  },

  // 高度比例改变事件
  onScaleChange(e) {
    const value = e.detail.value;
    this.setData({
      heightScale: value
    });
    if (this.data.chartInitialized) {
      this.updateChart();
    } else {
      console.log('图表未初始化，跳过更新');
    }
  },

  onReady() {
    // 页面渲染完成
    console.log('3d-map页面onReady');
    
    // 初始化图表
    this.initChart();
    
    // 备用检查：如果2秒后图表仍未初始化，记录警告
    setTimeout(() => {
      if (!this.data.chartInitialized) {
        console.warn('图表仍未初始化，请检查ec-canvas组件配置');
      }
    }, 2000);
  },

  onShow() {
    // 页面显示
  },

  onHide() {
    // 页面隐藏
  },

  onUnload() {
    // 页面卸载
    if (this.chart) {
      this.chart.dispose();
    }
    if (this.initTimeout) {
      clearTimeout(this.initTimeout);
    }
  }
});