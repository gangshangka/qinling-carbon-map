/**
 * 系统性能报告页面
 * 显示四大目标的测量结果：
 * 1. 高可用性：接口平均响应时间小于500ms，可用性达到99.9%
 * 2. 高性能：图片加载通过缓存命中率提升至85%，网络请求减少60%
 * 3. 高安全：多层安全防护，未发生安全漏洞
 * 4. 易扩展：模块化设计支持未来功能扩展
 */
const { getPerformanceReport, resetMetrics, exportData } = require('../../utils/performance-monitor.js');

Page({
  data: {
    loading: true,
    report: null,
    exportJson: '',
    showExport: false,
    targetsSummary: []
  },

  onLoad() {
    this.loadPerformanceReport();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadPerformanceReport();
  },

  // 加载性能报告
  loadPerformanceReport() {
    this.setData({ loading: true });
    
    try {
      const report = getPerformanceReport();
      console.log('性能报告加载成功:', report);
      
      // 处理目标摘要
      const targetsSummary = this.processTargetsSummary(report.targets);
      
      this.setData({
        report: report,
        targetsSummary: targetsSummary,
        loading: false
      });
    } catch (error) {
      console.error('加载性能报告失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error',
        duration: 2000
      });
      this.setData({ loading: false });
    }
  },

  // 处理目标摘要
  processTargetsSummary(targets) {
    return Object.keys(targets).map(key => {
      const target = targets[key];
      return {
        name: this.getTargetChineseName(key),
        target: target.target,
        current: target.current,
        achieved: target.achieved,
        details: target.details
      };
    });
  },

  // 获取目标中文名称
  getTargetChineseName(key) {
    const names = {
      highAvailability: '高可用性',
      highPerformance: '高性能',
      highSecurity: '高安全',
      easyExtension: '易扩展'
    };
    return names[key] || key;
  },

  // 刷新报告
  refreshReport() {
    this.loadPerformanceReport();
    wx.showToast({
      title: '报告已刷新',
      icon: 'success',
      duration: 1000
    });
  },

  // 重置监控数据
  resetMetrics() {
    wx.showModal({
      title: '确认重置',
      content: '确定要重置所有性能监控数据吗？此操作不可撤销。',
      success: (res) => {
        if (res.confirm) {
          resetMetrics();
          wx.showToast({
            title: '数据已重置',
            icon: 'success',
            duration: 1500
          });
          setTimeout(() => {
            this.loadPerformanceReport();
          }, 500);
        }
      }
    });
  },

  // 导出数据
  exportData() {
    try {
      const json = exportData();
      this.setData({
        exportJson: json,
        showExport: true
      });
      wx.showToast({
        title: '数据已导出',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      console.error('导出数据失败:', error);
      wx.showToast({
        title: '导出失败',
        icon: 'error',
        duration: 2000
      });
    }
  },

  // 关闭导出面板
  closeExport() {
    this.setData({ showExport: false });
  },

  // 复制JSON到剪贴板
  copyJson() {
    wx.setClipboardData({
      data: this.data.exportJson,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success',
          duration: 1500
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'error',
          duration: 1500
        });
      }
    });
  },

  // 格式化数字
  formatNumber(num) {
    if (typeof num === 'number') {
      return num.toFixed(2);
    }
    return num;
  },

  // 格式化百分比
  formatPercent(num) {
    if (typeof num === 'number') {
      return (num * 100).toFixed(1) + '%';
    }
    return num;
  },

  // 获取目标状态图标
  getStatusIcon(achieved) {
    return achieved ? 'success' : 'warn';
  },

  // 获取目标状态颜色
  getStatusColor(achieved) {
    return achieved ? '#4CAF50' : '#F44336';
  },

  // 获取目标状态文本
  getStatusText(achieved) {
    return achieved ? '已达成' : '未达成';
  },

  // 查看详细指标
  viewDetailedMetrics() {
    wx.showModal({
      title: '详细性能指标',
      content: JSON.stringify(this.data.report.detailedMetrics, null, 2),
      showCancel: false,
      confirmText: '关闭',
      confirmColor: '#2E7D32'
    });
  },

  // 查看建议
  viewRecommendations() {
    if (!this.data.report || !this.data.report.recommendations) {
      wx.showToast({
        title: '无建议数据',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    const recommendations = this.data.report.recommendations;
    let content = '性能优化建议：\n\n';
    
    recommendations.forEach((rec, index) => {
      content += `${index + 1}. [${rec.priority}] ${rec.area}: ${rec.suggestion}\n\n`;
    });

    wx.showModal({
      title: '优化建议',
      content: content,
      showCancel: false,
      confirmText: '关闭',
      confirmColor: '#2E7D32'
    });
  },

  // 格式化时间戳
  formatTimestamp(timestamp) {
    if (!timestamp) return '未知时间';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  },

  // 详情键转中文
  detailKeyToChinese(key) {
    const map = {
      avgResponseTime: '平均响应时间',
      availabilityRate: '可用性率',
      cacheHitRate: '缓存命中率',
      networkReductionRate: '网络请求减少率',
      totalSecurityEvents: '安全事件总数',
      criticalEvents: '严重安全事件数',
      modularComponents: '模块化组件数',
      extensibilityScore: '可扩展性评分'
    };
    return map[key] || key;
  },

  // 格式化详情值
  formatDetailValue(key, value) {
    if (typeof value === 'number') {
      if (key.includes('Rate') || key.includes('Score')) {
        return (value * 100).toFixed(1) + '%';
      }
      if (key.includes('Time')) {
        return value.toFixed(1) + 'ms';
      }
      return value.toFixed(2);
    }
    return value;
  }
});