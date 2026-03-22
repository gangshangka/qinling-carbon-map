// components/ec-canvas/echarts.js
// 导出ECharts初始化函数
import * as echarts from '../../miniprogram_npm/echarts/index';

module.exports = {
  init: function(canvas, width, height, dpr) {
    console.log('ECharts init', width, height, dpr);
    const chart = echarts.init(canvas, null, {
      width: width,
      height: height,
      devicePixelRatio: dpr || 1
    });
    
    canvas.setChart(chart);
    
    return chart;
  }
};