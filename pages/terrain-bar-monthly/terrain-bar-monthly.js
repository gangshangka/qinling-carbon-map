// pages/terrain-bar-monthly/terrain-bar-monthly.js
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
    console.log('地形图与月度碳汇3D柱状图页面加载');
    
    // 构建web-view的URL - 加载包含月度数据的3D柱状图
    const webViewUrl = '../../static/terrain-bar-chart-monthly.html';
    
    this.setData({
      webViewUrl: webViewUrl
    });
    
    console.log('web-view URL:', webViewUrl);
    console.log('加载秦岭地形图与月度碳汇3D柱状图');
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