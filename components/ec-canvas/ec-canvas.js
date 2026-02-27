// components/ec-canvas/ec-canvas.js
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
  data: {},
  
  methods: {
    touchStart(e) {
      // 触摸开始处理
      console.log('touch start', e);
    },
    
    touchMove(e) {
      // 触摸移动处理
      console.log('touch move', e);
    },
    
    touchEnd(e) {
      // 触摸结束处理
      console.log('touch end', e);
    }
  }
});