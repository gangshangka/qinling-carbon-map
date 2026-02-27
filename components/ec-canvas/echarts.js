// components/ec-canvas/echarts.js
// 暂时导出一个空对象，我们将在页面中通过npm安装的echarts来使用
module.exports = {
  init: function(canvas, width, height, dpr) {
    console.log('ECharts init', width, height);
    return {
      setOption: function(option) {
        console.log('ECharts setOption', option);
      }
    };
  }
};