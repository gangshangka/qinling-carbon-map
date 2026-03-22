// components/ec-canvas/ec-canvas.js
import WxCanvas from './wx-canvas.js';
import * as echarts from '../../miniprogram_npm/echarts/index';

Component({
  properties: {
    canvasId: {
      type: String,
      value: 'ec-canvas'
    },
    ec: {
      type: Object
    }
  },
  data: {
    isUseNewCanvas: false
  },
  
  lifetimes: {
    attached() {
      // 检查是否支持2d canvas
      try {
        const systemInfo = wx.getSystemInfoSync();
        const SDKVersion = systemInfo.SDKVersion;
        
        // 简单判断：如果SDKVersion >= 2.9.0，支持2d canvas
        const versionParts = SDKVersion.split('.').map(Number);
        const isNewCanvasSupported = versionParts[0] > 2 || 
                                    (versionParts[0] === 2 && versionParts[1] >= 9);
        
        this.setData({
          isUseNewCanvas: isNewCanvasSupported
        });
        
        console.log('ec-canvas attached, SDKVersion:', SDKVersion, 'isUseNewCanvas:', this.data.isUseNewCanvas);
      } catch (error) {
        console.warn('获取系统信息失败，使用旧canvas', error);
        this.setData({
          isUseNewCanvas: false
        });
      }
    },
    
    ready() {
      console.log('ec-canvas component ready');
      // 组件就绪后，检查是否已经初始化
      if (!this.chart) {
        console.log('组件就绪但未初始化图表');
      }
    }
  },
  
  methods: {
    init(e) {
      console.log('ec-canvas init', e, 'isUseNewCanvas:', this.data.isUseNewCanvas);
      
      // 首先立即触发一个测试事件，确保事件机制工作
      this.triggerEvent('init', { test: true, message: 'init事件触发' });
      
      const canvasId = this.properties.canvasId || 'ec-canvas';
      
      if (this.data.isUseNewCanvas) {
        this.initNewCanvas(canvasId);
      } else {
        this.initOldCanvas(canvasId);
      }
    },
    
    // 初始化新版canvas（2d）
    initNewCanvas(canvasId) {
      console.log('初始化新版2d canvas');
      const query = wx.createSelectorQuery().in(this);
      
      query.select(`canvas[canvas-id="${canvasId}"]`).fields({
        node: true,
        size: true
      }).exec((res) => {
        if (!res || !res[0]) {
          console.error('无法获取2d canvas节点', res);
          // 回退到旧版canvas
          this.initOldCanvas(canvasId);
          return;
        }
        
        const canvasNode = res[0].node;
        const width = res[0].width;
        const height = res[0].height;
        
        if (!canvasNode) {
          console.error('2d canvas节点不存在');
          this.initOldCanvas(canvasId);
          return;
        }
        
        console.log('2d canvas节点获取成功，尺寸:', width, height);
        
        // 获取context
        const ctx = canvasNode.getContext('2d');
        if (!ctx) {
          console.error('无法获取2d canvas context');
          this.initOldCanvas(canvasId);
          return;
        }
        
        // 设置canvas尺寸
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvasNode.width = width * dpr;
        canvasNode.height = height * dpr;
        ctx.scale(dpr, dpr);
        
        // 创建WxCanvas实例
        const canvas = new WxCanvas(ctx, canvasNode, true, this);
        
        // 初始化echarts实例
        const chart = echarts.init(canvas, null, {
          width: width,
          height: height,
          devicePixelRatio: dpr
        });
        
        canvas.setChart(chart);
        
        // 触发初始化完成事件
        this.triggerEvent('init', { chart });
        this.chart = chart;
        
        console.log('ECharts图表初始化完成（2d canvas）');
      });
    },
    
    // 初始化旧版canvas
    initOldCanvas(canvasId) {
      console.log('初始化旧版canvas');
      const query = wx.createSelectorQuery().in(this);
      
      query.select('.ec-canvas').fields({
        size: true,
        rect: true
      }).exec((res) => {
        if (!res || !res[0]) {
          console.error('无法获取canvas尺寸');
          // 使用默认尺寸
          this.initChartWithSize(canvasId, 300, 200);
          return;
        }
        
        const width = res[0].width || 300;
        const height = res[0].height || 200;
        
        console.log('canvas尺寸:', width, height);
        this.initChartWithSize(canvasId, width, height);
      });
    },
    
    // 使用指定尺寸初始化图表
    initChartWithSize(canvasId, width, height) {
      const dpr = wx.getSystemInfoSync().pixelRatio;
      
      // 创建canvas上下文（旧版API）
      const ctx = wx.createCanvasContext(canvasId, this);
      
      // 创建WxCanvas实例（适配旧版canvas）
      const canvas = new WxCanvas(ctx, null, false, this);
      
      // 设置canvas尺寸
      canvas.width = width;
      canvas.height = height;
      
      // 初始化echarts实例
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      
      canvas.setChart(chart);
      
      // 触发初始化完成事件
      this.triggerEvent('init', { chart });
      this.chart = chart;
      
      console.log('ECharts图表初始化完成（旧版canvas）');
    },
    
    touchStart(e) {
      // 触摸开始处理
      console.log('touch start', e);
      if (this.chart && this.chart._zr) {
        const touch = e.touches[0];
        this.chart._zr.handler.dispatch('mousedown', {
          zrX: touch.x,
          zrY: touch.y
        });
        this.chart._zr.handler.dispatch('mousemove', {
          zrX: touch.x,
          zrY: touch.y
        });
        this.chart._zr.handler.processGesture(wrapTouch(e), 'start');
      }
    },
    
    touchMove(e) {
      // 触摸移动处理
      console.log('touch move', e);
      if (this.chart && this.chart._zr) {
        const touch = e.touches[0];
        this.chart._zr.handler.dispatch('mousemove', {
          zrX: touch.x,
          zrY: touch.y
        });
        this.chart._zr.handler.processGesture(wrapTouch(e), 'change');
      }
    },
    
    touchEnd(e) {
      // 触摸结束处理
      console.log('touch end', e);
      if (this.chart && this.chart._zr) {
        const touch = e.changedTouches ? e.changedTouches[0] : {};
        this.chart._zr.handler.dispatch('mouseup', {
          zrX: touch.x,
          zrY: touch.y
        });
        this.chart._zr.handler.dispatch('click', {
          zrX: touch.x,
          zrY: touch.y
        });
        this.chart._zr.handler.processGesture(wrapTouch(e), 'end');
      }
    }
  }
});

// 辅助函数：包装触摸事件
function wrapTouch(event) {
  const touches = [];
  for (let i = 0; i < event.touches.length; ++i) {
    const touch = event.touches[i];
    touches.push({
      pageX: touch.pageX,
      pageY: touch.pageY,
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  }
  return { touches };
}