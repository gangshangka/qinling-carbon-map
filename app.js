// app.js
App({
  onLaunch() {
    console.log('秦岭碳收支遥感监测系统启动');
    
    // 全局配置
    this.globalData = {
      baseUrl: 'https://your-api.com',
      mapCenter: {
        latitude: 33.5108767,
        longitude: 108.2590920
      },
      version: '1.0.0'
    };
  }
});