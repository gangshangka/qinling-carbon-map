Page({
  data: {},

  openWebView() {
    const url = 'https://gangshangka.github.io/qinling-carbon-3d/terrain-bar-chart-monthly1-fixed.html';
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showModal({
          title: '链接已复制',
          content: '请打开手机浏览器，粘贴并访问该链接，查看完整的3D交互版碳汇图。',
          showCancel: false,
          confirmText: '我知道了'
        });
      }
    });
  }
});