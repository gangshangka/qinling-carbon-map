// pages/3d-bar-chart/3d-bar-chart.js
import * as echarts from '../../miniprogram_npm/echarts/index';

Page({
  data: {
    echarts: echarts,
    ec: {
      lazyLoad: false,
      onInit: null
    },
    chartData: [],
    countyStats: {
      total: 0,
      avg: 0,
      max: 0,
      min: 0,
      maxCounty: '',
      minCounty: ''
    },
    sortMode: 'value', // value: 按碳汇值排序, name: 按名称排序, location: 按地理位置排序
    heightScale: 1.0,
    barSize: 1.5,
    colorScheme: 'red-yellow-green',
    isLoading: true,
    errorMsg: '',
    mapLoaded: false, // 地图是否已加载
    mapData: null // 地图数据
  },

  onLoad() {
    console.log('3D行政区划柱状图页面加载');
    
    // 设置ec.onInit回调
    const self = this;
    this.setData({
      'ec.onInit': (canvas, width, height, dpr) => {
        console.log('Canvas初始化回调:', { width, height, dpr });
        self.onChartInit({ detail: { canvas, width, height, dpr } });
      }
    });
    
    this.loadData();
    // 开始加载地图数据（暂时注释，使用CSS背景模拟地形图）
    // this.loadMapData();
  },

  loadData() {
    this.setData({ isLoading: true, errorMsg: '' });
    
    // 在小程序环境中，可以使用wx.request或直接导入JSON
    // 这里我们使用require导入本地JS数据文件
    try {
      const map3dData = require('../../data/map3d_sampled.js');
      this.processData(map3dData);
    } catch (error) {
      console.error('加载数据失败:', error);
      this.setData({ 
        errorMsg: '加载数据失败，请检查文件路径',
        isLoading: false 
      });
      
      // 使用备用数据
      this.useFallbackData();
    }
  },

  useFallbackData() {
    console.log('使用备用数据');
    // 创建一些示例数据
    const fallbackData = [
      { name: '宁陕县', carbon: 296.31, center: [108.44, 33.53], height: 87.60 },
      { name: '丹凤县', carbon: 309.99, center: [110.43, 33.68], height: 90.36 },
      { name: '柞水县', carbon: 357.93, center: [109.27, 33.68], height: 100.00 },
      { name: '山阳县', carbon: 285.71, center: [109.88, 33.53], height: 84.23 },
      { name: '镇安县', carbon: 275.42, center: [109.15, 33.43], height: 81.34 },
      { name: '商南县', carbon: 298.76, center: [110.88, 33.53], height: 88.22 },
      { name: '洛南县', carbon: 268.91, center: [110.15, 34.09], height: 79.41 },
      { name: '太白县', carbon: 245.67, center: [107.32, 34.06], height: 72.50 }
    ];
    
    this.processData({
      features: fallbackData.map(item => ({
        name: item.name,
        carbon: item.carbon,
        center: item.center,
        height: item.height,
        value_3d: [item.center[0], item.center[1], item.height]
      }))
    });
  },

  // 加载秦岭地图数据
  loadMapData() {
    console.log('开始加载秦岭地图数据');
    
    wx.request({
      url: '../../data/qinling.geojson',
      success: (res) => {
        console.log('秦岭地图数据加载成功');
        this.setData({
          mapData: res.data,
          mapLoaded: true
        });
        
        // 如果图表已初始化，注册地图并重新绘制图表
        if (this.chart) {
          this.registerMapToChart();
          console.log('地图数据加载完成，重新绘制图表');
          this.updateChart();
        }
      },
      fail: (err) => {
        console.warn('加载秦岭地图数据失败，将显示无背景的柱状图:', err);
        this.setData({
          mapLoaded: false
        });
      }
    });
  },

  // 注册地图到ECharts实例
  registerMapToChart() {
    if (!this.chart || !this.data.mapData) {
      console.warn('无法注册地图：图表实例或地图数据不存在');
      return;
    }
    
    try {
      // 注册地图到echarts
      echarts.registerMap('qinling', this.data.mapData);
      console.log('秦岭地图注册成功: qinling');
    } catch (error) {
      console.error('注册地图时出错:', error);
    }
  },

  processData(rawData) {
    console.log('处理数据:', rawData);
    
    if (!rawData || !rawData.features || !Array.isArray(rawData.features)) {
      console.error('数据格式错误');
      this.setData({ 
        errorMsg: '数据格式错误，无法解析',
        isLoading: false 
      });
      return;
    }

    const features = rawData.features;
    const chartData = [];
    let totalCarbon = 0;
    let maxCarbon = -Infinity;
    let minCarbon = Infinity;
    let maxCounty = '';
    let minCounty = '';
    
    // 统计坐标范围
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    features.forEach(feature => {
      if (feature && feature.name && feature.carbon !== undefined) {
        const carbonValue = feature.carbon;
        const center = feature.center || [0, 0];
        const [lng, lat] = center;
        
        chartData.push({
          name: feature.name,
          value: [lng, lat, carbonValue],
          carbon: carbonValue
        });

        totalCarbon += carbonValue;
        
        // 更新坐标范围
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        
        if (carbonValue > maxCarbon) {
          maxCarbon = carbonValue;
          maxCounty = feature.name;
        }
        
        if (carbonValue < minCarbon) {
          minCarbon = carbonValue;
          minCounty = feature.name;
        }
      }
    });

    const avgCarbon = chartData.length > 0 ? totalCarbon / chartData.length : 0;
    
    // 打印详细统计信息
    console.log('数据统计详情:');
    console.log('- 县区数量:', chartData.length);
    console.log('- 经度范围:', minLng.toFixed(4), '~', maxLng.toFixed(4), '(差值:', (maxLng - minLng).toFixed(4), ')');
    console.log('- 纬度范围:', minLat.toFixed(4), '~', maxLat.toFixed(4), '(差值:', (maxLat - minLat).toFixed(4), ')');
    console.log('- 碳汇范围:', minCarbon.toFixed(2), '~', maxCarbon.toFixed(2), '(差值:', (maxCarbon - minCarbon).toFixed(2), ')');
    console.log('- 最高碳汇:', maxCounty, maxCarbon.toFixed(2));
    console.log('- 最低碳汇:', minCounty, minCarbon.toFixed(2));
    console.log('- 平均碳汇:', avgCarbon.toFixed(2));

    this.setData({
      chartData: chartData,
      countyStats: {
        total: chartData.length,
        avg: avgCarbon.toFixed(2),
        max: maxCarbon.toFixed(2),
        min: minCarbon.toFixed(2),
        maxCounty: maxCounty,
        minCounty: minCounty
      },
      isLoading: false
    }, () => {
      console.log('数据处理完成，共', chartData.length, '个县区');
      // 如果图表已初始化，更新图表
      if (this.chart) {
        console.log('图表已初始化，立即更新图表');
        this.updateChart();
      } else {
        console.log('等待图表初始化完成后更新');
      }
    });
  },

  onChartInit(e) {
    console.log('图表初始化回调', e);
    
    // 处理两种调用方式：直接传递参数或通过事件对象
    let canvas, width, height, dpr;
    if (e && e.detail) {
      // 来自bind:init事件
      ({ canvas, width, height, dpr } = e.detail);
    } else if (e && e.canvas) {
      // 来自ec.onInit回调
      ({ canvas, width, height, dpr } = e);
    } else {
      console.error('无效的初始化参数:', e);
      return;
    }
    
    if (!canvas) {
      console.error('Canvas对象为空');
      return;
    }

    // 复制3D地图页面的兼容性处理
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

    try {
      // 尝试不同的ECharts初始化方式，类似于3D地图页面
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
            return;
          }
        }
      }
      
      // 将chart实例设置到canvas中
      if (canvas.setChart) {
        canvas.setChart(chart);
        console.log('已设置chart到canvas');
      }
      
      this.chart = chart;
      
      // 如果地图数据已加载，注册地图
      if (this.data.mapLoaded && this.data.mapData) {
        this.registerMapToChart();
      }
      
      // 监听图表点击事件（2D柱状图）
      chart.on('click', (params) => {
        if (params.componentType === 'series' && params.componentSubType === 'bar') {
          const countyName = params.name;
          const carbonValue = params.value;
          wx.showToast({
            title: `${countyName}: ${carbonValue.toFixed(2)}`,
            icon: 'none',
            duration: 2000
          });
        }
      });
      
      // 如果数据已加载，立即更新图表
      if (this.data.chartData && this.data.chartData.length > 0) {
        console.log('数据已加载，更新图表');
        this.updateChart();
      } else {
        console.log('等待数据加载完成后更新图表');
      }
      
    } catch (error) {
      console.error('图表初始化失败:', error);
    }
  },

  updateChart() {
    if (!this.chart || !this.data.chartData || this.data.chartData.length === 0) {
      console.log('图表未初始化或数据为空');
      return;
    }

    const { chartData, sortMode, heightScale, barSize, colorScheme } = this.data;
    
    // 根据排序模式准备数据
    let sortedData;
    switch (sortMode) {
      case 'name':
        // 按名称排序
        sortedData = [...chartData].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        break;
      case 'location':
        // 按经度排序（大致的地理位置）
        sortedData = [...chartData].sort((a, b) => a.value[0] - b.value[0]);
        break;
      case 'value':
      default:
        // 按碳汇值排序（默认）
        sortedData = [...chartData].sort((a, b) => b.carbon - a.carbon);
        break;
    }
    
    const xAxisData = sortedData.map(item => item.name);
    const seriesData = sortedData.map(item => ({
      name: item.name,
      value: item.carbon * heightScale,
      carbon: item.carbon,
      longitude: item.value[0],
      latitude: item.value[1]
    }));

    // 设置颜色方案
    let color = [];
    let visualMapColors = [];
    switch (colorScheme) {
      case 'red-yellow-green':
        color = ['#ff4444', '#ffbb33', '#00C851', '#007E33'];
        visualMapColors = ['#ff4444', '#ffbb33', '#00C851', '#007E33'];
        break;
      case 'viridis':
        color = ['#440154', '#31688e', '#35b779', '#fde725'];
        visualMapColors = ['#440154', '#31688e', '#35b779', '#fde725'];
        break;
      case 'plasma':
        color = ['#0d0887', '#cc4678', '#f89441', '#f0f921'];
        visualMapColors = ['#0d0887', '#cc4678', '#f89441', '#f0f921'];
        break;
      case 'blue-gradient':
        color = ['#2196F3', '#64B5F6', '#90CAF9', '#E3F2FD'];
        visualMapColors = ['#2196F3', '#64B5F6', '#90CAF9', '#E3F2FD'];
        break;
      default:
        color = ['#ff4444', '#ffbb33', '#00C851', '#007E33'];
        visualMapColors = ['#ff4444', '#ffbb33', '#00C851', '#007E33'];
    }

    // 计算最小值最大值
    const carbonValues = seriesData.map(item => item.carbon);
    const minCarbon = Math.min(...carbonValues);
    const maxCarbon = Math.max(...carbonValues);
    const range = maxCarbon - minCarbon;
    
    // 配置选项 - 2D柱状图带厚度效果
    const option = {
      title: {
        text: '秦岭地区碳汇行政区划柱状图',
        subtext: '带厚度效果的2D可视化，秦岭地形图背景',
        left: 'center',
        top: 10,
        textStyle: {
          color: '#333',
          fontSize: 16,
          fontWeight: 'bold'
        },
        subtextStyle: {
          color: '#666',
          fontSize: 12
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params) {
          const data = params[0];
          const item = seriesData[data.dataIndex];
          return `${item.name}<br/>碳汇值: ${item.carbon.toFixed(2)}<br/>经度: ${item.longitude.toFixed(4)}<br/>纬度: ${item.latitude.toFixed(4)}`;
        }
      },
      visualMap: {
        show: true,
        dimension: 0,
        min: minCarbon,
        max: maxCarbon,
        inRange: {
          color: visualMapColors
        },
        left: 'right',
        top: 'center',
        text: ['高', '低'],
        calculable: true,
        textStyle: {
          color: '#333'
        }
      },
      grid: {
        left: '3%',
        right: '12%',
        bottom: '10%',
        top: '20%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLabel: {
          rotate: 45,
          interval: 0,
          fontSize: 10
        },
        axisTick: {
          alignWithLabel: true
        },
        axisLine: {
          lineStyle: {
            color: '#666'
          }
        },
        splitLine: {
          show: false
        }
      },
      yAxis: {
        type: 'value',
        name: '碳汇值',
        nameTextStyle: {
          fontSize: 12
        },
        axisLabel: {
          formatter: '{value}'
        },
        axisLine: {
          lineStyle: {
            color: '#666'
          }
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#e0e0e0'
          }
        }
      },
      series: [{
        name: '碳汇值',
        type: 'bar',
        data: seriesData,
        // 动态计算柱状条宽度
        barWidth: Math.max(10, Math.min(40, barSize * 15)),
        // 添加厚度效果 - 使用渐变色和阴影
        itemStyle: {
          color: function(params) {
            // 根据碳汇值计算颜色
            const value = seriesData[params.dataIndex].carbon;
            const ratio = (value - minCarbon) / range;
            
            // 创建渐变效果模拟厚度
            if (colorScheme === 'red-yellow-green') {
              if (ratio < 0.25) return '#ff4444';
              if (ratio < 0.5) return '#ffbb33';
              if (ratio < 0.75) return '#00C851';
              return '#007E33';
            } else if (colorScheme === 'viridis') {
              if (ratio < 0.25) return '#440154';
              if (ratio < 0.5) return '#31688e';
              if (ratio < 0.75) return '#35b779';
              return '#fde725';
            } else if (colorScheme === 'plasma') {
              if (ratio < 0.25) return '#0d0887';
              if (ratio < 0.5) return '#cc4678';
              if (ratio < 0.75) return '#f89441';
              return '#f0f921';
            } else {
              if (ratio < 0.25) return '#2196F3';
              if (ratio < 0.5) return '#64B5F6';
              if (ratio < 0.75) return '#90CAF9';
              return '#E3F2FD';
            }
          },
          // 添加阴影效果模拟厚度
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          shadowBlur: 5,
          shadowOffsetX: 2,
          shadowOffsetY: 2,
          // 添加边框增强立体感
          borderColor: '#fff',
          borderWidth: 1,
          // 添加内阴影效果
          opacity: 0.9
        },
        // 高亮状态
        emphasis: {
          itemStyle: {
            shadowColor: 'rgba(0, 0, 0, 0.5)',
            shadowBlur: 10,
            shadowOffsetX: 3,
            shadowOffsetY: 3,
            borderColor: '#ff5722',
            borderWidth: 2,
            opacity: 1
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            textStyle: {
              color: '#333',
              fontSize: 10,
              fontWeight: 'bold',
              backgroundColor: 'rgba(255,255,255,0.8)',
              padding: [2, 4],
              borderRadius: 3
            }
          }
        },
        // 添加标签显示
        label: {
          show: false,
          position: 'top',
          formatter: '{c}',
          textStyle: {
            color: '#333',
            fontSize: 9
          }
        },
        // 添加动画效果
        animation: true,
        animationDuration: 1000,
        animationEasing: 'cubicOut'
      }]
    };

    console.log('设置2D柱状图选项，数据点数量:', seriesData.length);
    console.log('碳汇值范围:', minCarbon.toFixed(2), '~', maxCarbon.toFixed(2));
    console.log('柱状条宽度:', Math.max(10, Math.min(40, barSize * 15)));
    
    this.chart.setOption(option);
    console.log('2D柱状图更新完成');
  },

  // 控制函数
  changeSortMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ sortMode: mode }, () => {
      this.updateChart();
    });
  },

  changeHeightScale(e) {
    const scale = parseFloat(e.currentTarget.dataset.scale);
    this.setData({ heightScale: scale }, () => {
      this.updateChart();
    });
  },

  changeBarSize(e) {
    const size = parseFloat(e.currentTarget.dataset.size);
    this.setData({ barSize: size }, () => {
      this.updateChart();
    });
  },

  changeColorScheme(e) {
    const scheme = e.currentTarget.dataset.scheme;
    this.setData({ colorScheme: scheme }, () => {
      this.updateChart();
    });
  },

  refreshData() {
    this.loadData();
  },

  goToTerrainMap() {
    wx.navigateTo({
      url: '/pages/terrain-webview/terrain-webview'
    });
  },

  goToTerrainMonthly() {
    wx.navigateTo({
      url: '/pages/terrain-bar-monthly/terrain-bar-monthly'
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  onUnload() {
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
  }
});