// components/ec-canvas/wx-canvas.js

export default class WxCanvas {
  constructor(ctx, canvasNode, isNew, componentInstance) {
    this.ctx = ctx;
    this.canvasNode = canvasNode;
    this.isNew = isNew;
    this.componentInstance = componentInstance;
    
    if (!this.isNew) {
      this._initStyle(ctx);
    }
    
    this._initEvent();
  }
  
  _initStyle(ctx) {
    const styles = [
      'fillStyle',
      'strokeStyle',
      'globalAlpha',
      'textAlign',
      'textBaseAlign',
      'shadow',
      'lineWidth',
      'lineCap',
      'lineJoin',
      'lineDash',
      'miterLimit',
      'fontSize'
    ];
    
    styles.forEach(style => {
      Object.defineProperty(ctx, style, {
        set: value => {
          if (style !== 'fillStyle' && style !== 'strokeStyle'
            || value !== 'none') {
            if (this.isNew) {
              this.ctx[style] = value;
            } else {
              this._setStyle(style, value);
            }
          }
        }
      });
    });
    
    ctx.createRadialGradient = () => {
      return ctx.createCircularGradient(arguments);
    };
  }
  
  _setStyle(style, value) {
    this.ctx[style] = value;
    const str = value.toString();
    let method;
    
    if (style === 'fillStyle') {
      method = 'setFillStyle';
    } else if (style === 'strokeStyle') {
      method = 'setStrokeStyle';
    }
    
    if (method) {
      this.ctx[method](str);
    }
  }
  
  _initEvent() {
    this.event = {};
  }
  
  addEventListener(event, func) {
    if (!this.event[event]) {
      this.event[event] = [];
    }
    this.event[event].push(func);
  }
  
  removeEventListener(event, func) {
    if (this.event[event]) {
      const index = this.event[event].indexOf(func);
      if (index >= 0) {
        this.event[event].splice(index, 1);
      }
    }
  }
  
  set width(w) {
    if (this.canvasNode) this.canvasNode.width = w;
  }
  
  set height(h) {
    if (this.canvasNode) this.canvasNode.height = h;
  }
  
  get width() {
    if (this.canvasNode) return this.canvasNode.width;
    return 0;
  }
  
  get height() {
    if (this.canvasNode) return this.canvasNode.height;
    return 0;
  }
  
  getContext(type) {
    return this.ctx;
  }
  
  getBoundingClientRect() {
    return this.canvasNode ? this.canvasNode.getBoundingClientRect() : {};
  }
  
  attachEvent() {
    // noop
  }
  
  detachEvent() {
    // noop
  },
  
  setChart(chart) {
    this.chart = chart;
  }
}