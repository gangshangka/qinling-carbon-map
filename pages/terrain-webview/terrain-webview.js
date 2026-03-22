// pages/terrain-webview/terrain-webview.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    webViewUrl: '' // web-view加载的URL
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('地形图网页视图页面加载');
    
    // 构建web-view的URL - 加载最成功的simple-terrain.html
    // 这个版本经过测试，有完善的错误处理和2D/3D切换功能
    // 默认显示2D平面地图，用户可切换到3D（如果需要）
    const webViewUrl = '../../static/simple-terrain.html';
    
    this.setData({
      webViewUrl: webViewUrl
    });
    
    console.log('web-view URL:', webViewUrl);
    console.log('加载经过测试的秦岭地形图（默认2D平面模式）');
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },
  
  /**
   * web-view加载成功
   */
  onWebViewLoad(e) {
    console.log('web-view加载成功', e);
  },
  
  /**
   * web-view加载失败
   */
  onWebViewError(e) {
    console.error('web-view加载失败', e);
    wx.showToast({
      title: '地形图加载失败',
      icon: 'none',
      duration: 3000
    });
  }
})