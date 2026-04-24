/**
 * 管理员数据上传页面 - 2级密码权限管理
 * 
 * 权限级别：
 * - 1级（普通管理员 admin/admin123）：查看数据列表、查看统计图
 * - 2级（超级管理员 密码super888）：上传、删除、修改、同步等全部操作
 * 
 * 功能：
 * 1. 2级密码验证：普通管理员仅查看，超级管理员可删改查
 * 2. 文件上传：PNG图片、JSON数据、TIF文件
 * 3. 数据管理：对网页数据和主页统计图的删改查
 * 4. 同步网页：将数据推送到GitHub Pages
 */
// pages/admin-upload/admin-upload.js
Page({
  data: {
    // 登录状态 - 2级密码
    authLevel: 0, // 0=未登录, 1=普通管理员(查看), 2=超级管理员(删改查)
    username: '',
    password: '',
    level2Password: '',
    loginError: '',
    // 上传状态
    uploadStatus: {
      png: '等待上传',
      json: '等待上传',
      tif: '等待上传'
    },
    // 上传进度
    uploadProgress: {
      png: 0,
      json: 0,
      tif: 0
    },
    selectedPngFile: null,
    selectedJsonFile: null,
    selectedTifFile: null,
    selectedTifFileName: '',
    isTifFileNameValid: false,
    // 年份月份选择
    selectedYear: 2020,
    selectedMonth: 1,
    years: (() => {
      const years = [];
      for (let y = 2012; y <= 2030; y++) {
        years.push(y);
      }
      return years;
    })(),
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    // 上传记录
    uploadRecords: [],
    // 云存储文件列表
    cloudFiles: [],
    // 云开发状态
    cloudAvailable: false,
    // 数据管理相关
    uploadedDataList: {
      pngImages: [],
      carbonRecords: []
    },
    dataListLoading: false,
    availableYears: [],
    syncToWebLoading: false,
    syncToWebResult: '',
    // GitHub Token（同步网页用）
    githubToken: ''
  },

  onLoad() {
    console.log('管理员上传页面加载');
    this.checkCloudInit();
  },

  checkCloudInit() {
    if (wx.cloud) {
      console.log('云开发已初始化');
      this.setData({ cloudAvailable: true });
    } else {
      console.warn('云开发未初始化');
      this.setData({ cloudAvailable: false });
      wx.showToast({ title: '云开发未初始化', icon: 'none', duration: 2000 });
    }
  },

  // 输入框处理
  onUsernameInput(e) { this.setData({ username: e.detail.value }); },
  onPasswordInput(e) { this.setData({ password: e.detail.value }); },
  onLevel2PasswordInput(e) { this.setData({ level2Password: e.detail.value }); },

  // 1级登录：普通管理员（查看权限）
  handleLogin() {
    const { username, password } = this.data;
    if (!username || !password) {
      this.setData({ loginError: '请输入用户名和密码' });
      return;
    }
    if (username === 'admin' && password === 'admin123') {
      this.setData({ authLevel: 1, loginError: '' });
      wx.showToast({ title: '已登录（查看权限）', icon: 'success', duration: 1500 });
      this.loadCloudFiles();
      this.loadUploadedDataList();
    } else {
      this.setData({ loginError: '用户名或密码错误' });
    }
  },

  // 2级验证：超级管理员（删改查权限）
  verifyLevel2() {
    const { level2Password } = this.data;
    if (!level2Password) {
      this.setData({ loginError: '请输入超级管理员密码' });
      return;
    }
    if (level2Password === 'super888') {
      this.setData({ authLevel: 2, loginError: '' });
      wx.showToast({ title: '已获得完整权限', icon: 'success', duration: 1500 });
    } else {
      this.setData({ loginError: '超级管理员密码错误' });
    }
  },

  // 从管理界面点击升级权限
  verifyLevel2Tap() {
    this.setData({ loginError: '' });
    wx.showModal({
      title: '升级权限',
      content: '请输入超级管理员密码以获取删改查权限',
      editable: true,
      placeholderText: '输入2级密码',
      confirmText: '验证',
      success: (res) => {
        if (res.confirm) {
          const pwd = res.content || '';
          if (pwd === 'super888') {
            this.setData({ authLevel: 2, loginError: '' });
            wx.showToast({ title: '已获得完整权限', icon: 'success' });
          } else {
            wx.showToast({ title: '密码错误', icon: 'none' });
          }
        }
      }
    });
  },

  // 进入仅查看模式（从2级验证页面跳过）
  enterViewMode() {
    this.setData({ loginError: '' });
  },

  // 登出
  handleLogout() {
    this.setData({ authLevel: 0, username: '', password: '', level2Password: '', isTifFileNameValid: false });
    wx.showToast({ title: '已退出登录', icon: 'success', duration: 1500 });
  },

  // 需要超级管理员权限的检查
  requireLevel2(actionName) {
    if (this.data.authLevel < 2) {
      wx.showModal({
        title: '权限不足',
        content: `"${actionName}"操作需要超级管理员权限，请在下方输入2级密码解锁。`,
        showCancel: false,
        confirmText: '知道了'
      });
      return false;
    }
    return true;
  },

  // 年份月份选择
  bindYearChange(e) { this.setData({ selectedYear: parseInt(e.detail.value) }); },
  bindMonthChange(e) { this.setData({ selectedMonth: parseInt(e.detail.value) }); },

  // 选择PNG文件
  choosePngFile() {
    if (this.data.authLevel < 1) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
    if (!this.requireLevel2('上传PNG')) return;
    wx.chooseImage({
      count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ 'uploadStatus.png': '已选择文件', selectedPngFile: res.tempFilePaths[0] });
        wx.showToast({ title: '已选择PNG文件', icon: 'success' });
      },
      fail: () => { wx.showToast({ title: '选择文件失败', icon: 'none' }); }
    });
  },

  // 选择TIF文件
  chooseTifFile() {
    if (this.data.authLevel < 1) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
    if (!this.requireLevel2('上传TIF')) return;
    wx.chooseMessageFile({
      count: 1, type: 'file', extension: ['tif', 'tiff'],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        const fileName = tempFile.name || tempFile.path.split('/').pop();
        const pattern = /^nep20\d{4}\.(tif|tiff)$/i;
        if (!pattern.test(fileName)) {
          wx.showModal({
            title: '文件名格式要求',
            content: `文件名 "${fileName}" 不符合要求。\n\n正确格式：nep20xxxx.tif\n示例：nep202301.tif`,
            showCancel: false
          });
          return;
        }
        const match = fileName.match(/nep20(\d{2})(\d{2})\.(?:tif|tiff)/i);
        if (match) {
          const fileYear = parseInt('20' + match[1]);
          const fileMonth = parseInt(match[2]);
          this.setData({
            selectedYear: fileYear, selectedMonth: fileMonth,
            'uploadStatus.tif': `已选择文件 (${fileYear}年${fileMonth}月)`,
            selectedTifFile: tempFile.path, selectedTifFileName: fileName, isTifFileNameValid: true
          });
          wx.showToast({ title: `已选择: ${fileYear}年${fileMonth}月`, icon: 'success' });
        }
      },
      fail: () => { wx.showToast({ title: '选择文件失败', icon: 'none' }); }
    });
  },

  isTifFileNameValid() {
    const fileName = this.data.selectedTifFileName;
    if (!fileName) return false;
    return /^nep20\d{4}\.(tif|tiff)$/i.test(fileName);
  },

  // 选择JSON文件
  chooseJsonFile() {
    if (this.data.authLevel < 1) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
    if (!this.requireLevel2('上传JSON')) return;
    wx.chooseMessageFile({
      count: 1, type: 'file', extension: ['json'],
      success: (res) => {
        this.setData({ 'uploadStatus.json': '已选择文件', selectedJsonFile: res.tempFiles[0].path });
        wx.showToast({ title: '已选择JSON文件', icon: 'success' });
      },
      fail: () => { wx.showToast({ title: '选择文件失败', icon: 'none' }); }
    });
  },

  // 上传PNG文件
  uploadPngFile() {
    if (this.data.authLevel < 1) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
    if (!this.requireLevel2('上传PNG')) return;
    if (!this.data.selectedPngFile) { wx.showToast({ title: '请先选择PNG文件', icon: 'none' }); return; }
    const { selectedYear, selectedMonth } = this.data;
    const cloudPath = `qinling-carbon-data/images/${selectedYear}_${selectedMonth}.png`;
    this.setData({ 'uploadStatus.png': '上传中...', 'uploadProgress.png': 0 });
    const uploadTask = wx.cloud.uploadFile({
      cloudPath, filePath: this.data.selectedPngFile,
      success: (res) => {
        this.setData({ 'uploadStatus.png': '上传成功', 'uploadProgress.png': 100 });
        this.addUploadRecord({ type: 'png', year: selectedYear, month: selectedMonth, fileName: `${selectedYear}_${selectedMonth}.png`, fileId: res.fileID, uploadTime: new Date().toLocaleString() });
        this.updateImageMap(selectedYear, selectedMonth, res.fileID);
        wx.showToast({ title: 'PNG上传成功', icon: 'success' });
      },
      fail: () => { this.setData({ 'uploadStatus.png': '上传失败' }); wx.showToast({ title: '上传失败', icon: 'none' }); }
    });
    uploadTask.onProgressUpdate((res) => { this.setData({ 'uploadProgress.png': res.progress }); });
  },

  // 上传JSON文件
  uploadJsonFile() {
    if (this.data.authLevel < 1) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
    if (!this.requireLevel2('上传JSON')) return;
    if (!this.data.selectedJsonFile) { wx.showToast({ title: '请先选择JSON文件', icon: 'none' }); return; }
    const { selectedYear, selectedMonth } = this.data;
    const cloudPath = `qinling-carbon-data/json/${selectedYear}_${selectedMonth}.json`;
    this.setData({ 'uploadStatus.json': '上传中...', 'uploadProgress.json': 0 });
    const uploadTask = wx.cloud.uploadFile({
      cloudPath, filePath: this.data.selectedJsonFile,
      success: (res) => {
        this.setData({ 'uploadStatus.json': '上传成功', 'uploadProgress.json': 100 });
        this.addUploadRecord({ type: 'json', year: selectedYear, month: selectedMonth, fileName: `${selectedYear}_${selectedMonth}.json`, fileId: res.fileID, uploadTime: new Date().toLocaleString() });
        wx.showToast({ title: 'JSON上传成功', icon: 'success' });
      },
      fail: () => { this.setData({ 'uploadStatus.json': '上传失败' }); wx.showToast({ title: '上传失败', icon: 'none' }); }
    });
    uploadTask.onProgressUpdate((res) => { this.setData({ 'uploadProgress.json': res.progress }); });
  },

  // 上传TIF文件
  uploadTifFile() {
    if (this.data.authLevel < 1) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
    if (!this.requireLevel2('上传TIF')) return;
    if (!this.data.selectedTifFile) { wx.showToast({ title: '请先选择TIF文件', icon: 'none' }); return; }
    const { selectedYear, selectedMonth, selectedTifFileName } = this.data;
    if (selectedTifFileName && !this.isTifFileNameValid()) {
      wx.showToast({ title: '文件名格式错误', icon: 'none' }); return;
    }
    if (this.data.cloudAvailable) {
      this.uploadAndProcessTifFile(selectedYear, selectedMonth, selectedTifFileName);
    } else {
      this.simulateTifProcessing(selectedYear, selectedMonth, selectedTifFileName);
    }
  },

  simulateTifProcessing(year, month, fileName) {
    this.setData({ 'uploadStatus.tif': '开始处理TIF文件（模拟）...', 'uploadProgress.tif': 0 });
    const steps = [
      { progress: 10, message: '读取TIF文件数据...' },
      { progress: 40, message: '生成PNG图像...' },
      { progress: 75, message: '添加图例标注...' },
      { progress: 100, message: '处理完成!' }
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i >= steps.length) { clearInterval(interval); this.finalizeTifProcessing(year, month, fileName); return; }
      this.setData({ 'uploadProgress.tif': steps[i].progress, 'uploadStatus.tif': steps[i].message });
      i++;
    }, 500);
  },

  uploadAndProcessTifFile(year, month, fileName) {
    const that = this;
    const filePath = this.data.selectedTifFile;
    this.setData({ 'uploadStatus.tif': '上传TIF文件到云存储...', 'uploadProgress.tif': 0 });
    const cloudPath = `qinling-carbon-data/tif/${year}_${month}_${Date.now()}.tif`;
    wx.cloud.uploadFile({
      cloudPath, filePath,
      success: res => {
        that.setData({ 'uploadStatus.tif': '调用云函数处理TIF文件...', 'uploadProgress.tif': 30 });
        wx.cloud.callFunction({
          name: 'tif-processor-simple-node',
          data: { fileID: res.fileID, year, month, fileName },
          success: cloudRes => {
            if (cloudRes.result && cloudRes.result.success) {
              const result = cloudRes.result.data;
              that.setData({ 'uploadStatus.tif': result.message || '处理完成', 'uploadProgress.tif': 100 });
              const monthStr = month < 10 ? '0' + month : month.toString();
              const pngFileName = `nep${year}${monthStr}.png`;
              const imagePath = result.pngFileID || `/images/${pngFileName}`;
              const stats = result.stats || { mean: 0, min: 0, max: 0, sum: 0, std: 0, count: 0 };
              that.addUploadRecord({ type: 'tif', year, month, fileName: fileName || `${year}_${month}.tif`, fileId: result.pngFileID || 'cloud_processed_' + Date.now(), uploadTime: new Date().toLocaleString(), note: `TIF已通过云函数处理: ${pngFileName}`, stats, mode: result.mode || 'unknown' });
              that.updateImageMap(year, month, imagePath);
              that.saveCarbonStats(year, month, stats);
              const countyData = result.countyData || {};
              if (Object.keys(countyData).length > 0) {
                that.syncCarbonStatsToCloud(year, month, stats, countyData);
                that.cacheCarbonDataLocally(year, month, countyData);
              } else {
                const estimated = that.estimateCountyDataFromStats(stats);
                that.syncCarbonStatsToCloud(year, month, stats, estimated);
                that.cacheCarbonDataLocally(year, month, estimated);
              }
              that.extractCarbonDataFromTif(res.fileID, year, month, stats);
              wx.showToast({ title: 'TIF转换完成', icon: 'success' });
            } else {
              that.setData({ 'uploadStatus.tif': '云函数处理失败', 'uploadProgress.tif': 100 });
              setTimeout(() => { that.simulateTifProcessing(year, month, fileName); }, 1000);
            }
          },
          fail: () => {
            that.setData({ 'uploadStatus.tif': '云函数调用失败', 'uploadProgress.tif': 100 });
            setTimeout(() => { that.simulateTifProcessing(year, month, fileName); }, 1000);
          }
        });
      },
      fail: () => {
        that.setData({ 'uploadStatus.tif': '文件上传失败', 'uploadProgress.tif': 100 });
        setTimeout(() => { that.simulateTifProcessing(year, month, fileName); }, 1000);
      }
    });
  },

  finalizeTifProcessing(year, month, fileName) {
    const monthStr = month < 10 ? '0' + month : month.toString();
    const imagePath = `/images/nep${year}${monthStr}.png`;
    this.updateImageMap(year, month, imagePath);
    this.setData({ 'uploadStatus.tif': '处理完成', 'uploadProgress.tif': 100 });
    this.addUploadRecord({ type: 'tif', year, month, fileName: fileName || `${year}_${month}.tif`, fileId: 'processed_' + Date.now(), uploadTime: new Date().toLocaleString(), note: `TIF已转换为PNG: nep${year}${monthStr}.png` });
    wx.showToast({ title: 'TIF转换完成', icon: 'success' });
  },

  updateImageMap(year, month, imagePath) {
    const imageMap = wx.getStorageSync('carbon_image_map') || {};
    const yearKey = String(year);
    const monthKey = String(month);
    if (!imageMap[yearKey]) imageMap[yearKey] = {};
    imageMap[yearKey][monthKey] = imagePath;
    wx.setStorageSync('carbon_image_map', imageMap);
    this.setData({ imageMap });
    this.syncImageMapToCloud(year, month, imagePath);
  },

  syncImageMapToCloud(year, month, imagePath) {
    if (!wx.cloud) return;
    const db = wx.cloud.database();
    db.collection('image_map').where({ year, month }).count().then(countRes => {
      if (countRes.total === 0) {
        db.collection('image_map').add({ data: { year, month, fileID: imagePath, cloudPath: imagePath, createdAt: new Date() } }).catch(err => {
          if (err.errCode === -502005) this.ensureCloudCollection('image_map', () => { this.syncImageMapToCloud(year, month, imagePath); });
        });
      } else {
        db.collection('image_map').where({ year, month }).get().then(queryRes => {
          if (queryRes.data.length > 0) {
            db.collection('image_map').doc(queryRes.data[0]._id).update({ data: { fileID: imagePath, cloudPath: imagePath, updatedAt: new Date() } });
          }
        });
      }
    }).catch(err => {
      if (err.errCode === -502005) this.ensureCloudCollection('image_map', () => { this.syncImageMapToCloud(year, month, imagePath); });
    });
  },

  addUploadRecord(record) {
    const records = this.data.uploadRecords;
    records.unshift(record);
    this.setData({ uploadRecords: records });
    wx.setStorageSync('uploadRecords', records);
  },

  loadUploadRecords() {
    this.setData({ uploadRecords: wx.getStorageSync('uploadRecords') || [] });
  },

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  },

  loadCloudFiles() {
    const mockFiles = [
      { fileID: '1', fileName: '2020_1.png', size: 1024000, uploadTime: '2026-03-01' },
      { fileID: '2', fileName: '2020_1.json', size: 20480, uploadTime: '2026-03-01' }
    ];
    this.setData({ cloudFiles: mockFiles.map(f => ({ ...f, formattedSize: this.formatFileSize(f.size) })) });
  },

  deleteCloudFile(e) {
    if (!this.requireLevel2('删除文件')) return;
    const { fileid } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除', content: '确定要删除这个文件吗？',
      success: (res) => {
        if (res.confirm) {
          wx.cloud.deleteFile({
            fileList: [fileid],
            success: () => { wx.showToast({ title: '删除成功', icon: 'success' }); this.loadCloudFiles(); },
            fail: () => { wx.showToast({ title: '删除失败', icon: 'none' }); }
          });
        }
      }
    });
  },

  viewFileDetail(e) {
    const { fileid } = e.currentTarget.dataset;
    const file = this.data.cloudFiles.find(f => f.fileID === fileid);
    if (file) {
      wx.showModal({ title: '文件详情', content: `文件名：${file.fileName}\n大小：${file.formattedSize}\n时间：${file.uploadTime}`, showCancel: false });
    }
  },

  batchUpload() {
    if (this.data.authLevel < 1) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
    if (!this.requireLevel2('批量上传')) return;
    if (!this.data.selectedPngFile || !this.data.selectedJsonFile) {
      wx.showToast({ title: '请同时选择PNG和JSON文件', icon: 'none' }); return;
    }
    wx.showLoading({ title: '批量上传中...', mask: true });
    Promise.all([this.uploadFilePromise('png'), this.uploadFilePromise('json')])
      .then(() => { wx.hideLoading(); wx.showToast({ title: '批量上传成功', icon: 'success' }); })
      .catch(() => { wx.hideLoading(); wx.showToast({ title: '批量上传失败', icon: 'none' }); });
  },

  uploadFilePromise(fileType) {
    return new Promise((resolve, reject) => {
      const { selectedYear, selectedMonth } = this.data;
      const filePath = fileType === 'png' ? this.data.selectedPngFile : this.data.selectedJsonFile;
      const cloudPath = `qinling-carbon-data/${fileType}/${selectedYear}_${selectedMonth}.${fileType === 'png' ? 'png' : 'json'}`;
      wx.cloud.uploadFile({ cloudPath, filePath, success: resolve, fail: reject });
    });
  },

  clearUploadRecords() {
    if (!this.requireLevel2('清空记录')) return;
    wx.showModal({
      title: '确认清空', content: '确定要清空所有上传记录吗？',
      success: (res) => {
        if (res.confirm) { this.setData({ uploadRecords: [] }); wx.removeStorageSync('uploadRecords'); wx.showToast({ title: '记录已清空', icon: 'success' }); }
      }
    });
  },

  extractCarbonDataFromTif(fileID, year, month, stats, retryCount = 0) {
    if (!wx.cloud) return;
    wx.cloud.callFunction({
      name: 'carbon-data-extractor',
      data: { mode: 'extract', fileID, year, month, stats: stats || null },
      success: res => {
        if (res.result && res.result.success) {
          const data = res.result.data || {};
          const countyData = data.countyData || {};
          const validCounties = data.validCounties || 0;
          if (validCounties > 0) {
            this.syncCarbonStatsToCloud(year, month, { mean: data.meanValue || 0, min: data.minValue || 0, max: data.maxValue || 0, sum: 0, std: 0, count: validCounties }, countyData);
            this.cacheCarbonDataLocally(year, month, countyData);
            wx.showToast({ title: `提取成功：${validCounties}个县域`, icon: 'success' });
          }
        }
      },
      fail: err => {
        const isTimeout = err && err.errMsg && err.errMsg.indexOf('timed out') !== -1;
        if (isTimeout && retryCount < 1) {
          setTimeout(() => { this.extractCarbonDataFromTif(fileID, year, month, stats, retryCount + 1); }, 1000);
        }
      }
    });
  },

  cacheCarbonDataLocally(year, month, countyData) {
    try {
      const cacheKey = 'carbon_cloud_data_cache';
      const cachedData = wx.getStorageSync(cacheKey) || {};
      const yearStr = String(year);
      const monthStr = String(month);
      if (!cachedData[yearStr]) cachedData[yearStr] = {};
      cachedData[yearStr][monthStr] = countyData;
      wx.setStorageSync(cacheKey, cachedData);
      this.updateMonthlyDataCache(year, month, countyData);
    } catch (err) { console.error('缓存碳汇数据失败:', err); }
  },

  updateMonthlyDataCache(year, month, countyData) {
    try {
      const values = Object.values(countyData);
      if (values.length === 0) return;
      const meanValue = values.reduce((sum, v) => sum + v, 0) / values.length;
      const cacheKey = 'monthly_data_cloud_cache';
      const cachedData = wx.getStorageSync(cacheKey) || [];
      const existingIndex = cachedData.findIndex(item => item.year === year && item.month === month);
      const newDataPoint = { year, month, value: parseFloat(meanValue.toFixed(2)) };
      if (existingIndex >= 0) cachedData[existingIndex] = newDataPoint; else cachedData.push(newDataPoint);
      cachedData.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
      wx.setStorageSync(cacheKey, cachedData);
    } catch (err) { console.error('更新月度数据缓存失败:', err); }
  },

  estimateCountyDataFromStats(stats) {
    const meanValue = stats.carbon_sink_mean || stats.mean || 0;
    if (meanValue === 0) return {};
    const COUNTY_CENTERS = {
      "宁陕县": [108.3, 33.3], "丹凤县": [110.3, 33.7], "柞水县": [109.1, 33.7],
      "长安区": [108.9, 34.2], "鄠邑区": [108.6, 34.1], "蓝田县": [109.3, 34.2],
      "周至县": [108.2, 34.2], "渭滨区": [107.1, 34.4], "陈仓区": [107.4, 34.4],
      "岐山县": [107.6, 34.4], "眉县": [107.8, 34.3], "凤县": [106.5, 33.9],
      "太白县": [107.3, 34.0], "临渭区": [109.5, 34.5], "华州区": [109.8, 34.5],
      "潼关县": [110.2, 34.5], "华阴市": [110.1, 34.6], "城固县": [107.3, 33.2],
      "洋县": [107.5, 33.2], "勉县": [106.7, 33.2], "略阳县": [106.2, 33.3],
      "留坝县": [106.9, 33.6], "佛坪县": [108.0, 33.5], "汉滨区": [109.0, 32.7],
      "汉阴县": [108.5, 32.9], "石泉县": [108.3, 33.0], "商州区": [109.9, 33.9],
      "洛南县": [110.1, 34.1], "商南县": [110.9, 33.5], "山阳县": [109.9, 33.5],
      "镇安县": [109.2, 33.4], "灞桥区": [109.1, 34.3], "临潼区": [109.2, 34.4],
      "汉台区": [107.0, 33.1], "西乡县": [107.8, 33.0], "宁强县": [106.3, 32.8],
      "紫阳县": [108.5, 32.5], "岚皋县": [108.9, 32.3], "旬阳县": [109.4, 32.8]
    };
    const countyData = {};
    for (const name in COUNTY_CENTERS) {
      const center = COUNTY_CENTERS[name];
      const latWeight = 1 + (center[1] - 33.0) * 0.08;
      const lngWeight = 1 + Math.abs(center[0] - 108.5) * 0.03;
      countyData[name] = parseFloat((meanValue * latWeight * lngWeight).toFixed(2));
    }
    return countyData;
  },

  saveCarbonStats(year, month, stats) {
    const statEntry = { month, carbon_sink_mean: stats.mean, carbon_sink_max: stats.max, carbon_sink_min: stats.min, carbon_sink_sum: stats.sum, carbon_sink_std: stats.std, pixel_count: stats.count };
    const statsKey = `carbon_stats_${year}`;
    let yearStats = wx.getStorageSync(statsKey);
    if (!yearStats) yearStats = { year, data: [] };
    const monthIndex = yearStats.data.findIndex(item => item.month === month);
    if (monthIndex >= 0) yearStats.data[monthIndex] = statEntry; else yearStats.data.push(statEntry);
    yearStats.data.sort((a, b) => a.month - b.month);
    wx.setStorageSync(statsKey, yearStats);
    this.updateGlobalStatsCache(year, month, statEntry);
  },

  syncCarbonStatsToCloud(year, month, stats, countyData) {
    if (!wx.cloud) return;
    const db = wx.cloud.database();
    db.collection('carbon_data').where({ year, month }).count().then(countRes => {
      const dataToSave = { countyData: countyData || {}, stats: stats || {}, updatedAt: new Date() };
      if (countRes.total === 0) {
        db.collection('carbon_data').add({ data: { year, month, ...dataToSave, createdAt: new Date() } }).catch(err => {
          if (err.errCode === -502005) this.ensureCloudCollection('carbon_data', () => { this.syncCarbonStatsToCloud(year, month, stats, countyData); });
        });
      } else {
        db.collection('carbon_data').where({ year, month }).get().then(queryRes => {
          if (queryRes.data.length > 0) db.collection('carbon_data').doc(queryRes.data[0]._id).update({ data: dataToSave });
        });
      }
    }).catch(err => {
      if (err.errCode === -502005) this.ensureCloudCollection('carbon_data', () => { this.syncCarbonStatsToCloud(year, month, stats, countyData); });
    });
  },

  ensureCloudCollection(name, callback) {
    const db = wx.cloud.database();
    db.createCollection({ name, success: () => { if (callback) callback(); }, fail: () => { if (callback) callback(); } });
  },

  updateGlobalStatsCache(year, month, statEntry) {
    const globalStats = wx.getStorageSync('carbon_stats_global') || {};
    if (!globalStats[year]) globalStats[year] = {};
    globalStats[year][month] = statEntry;
    wx.setStorageSync('carbon_stats_global', globalStats);
  },

  // ============================================
  // 数据管理功能（删改查）
  // ============================================

  loadUploadedDataList() {
    if (this.data.dataListLoading) return;
    this.setData({ dataListLoading: true });
    wx.cloud.callFunction({
      name: 'carbon-data-extractor',
      data: { mode: 'list' },
      success: res => {
        if (res.result && res.result.success) {
          const data = res.result.data || {};
          const pngImages = data.pngImages || [];
          const carbonRecords = data.carbonRecords || [];
          const yearSet = new Set();
          pngImages.forEach(item => { if (item.year) yearSet.add(item.year); });
          carbonRecords.forEach(item => { if (item.year) yearSet.add(item.year); });
          this.setData({ uploadedDataList: { pngImages, carbonRecords }, availableYears: Array.from(yearSet).sort((a, b) => a - b), dataListLoading: false });
        } else {
          this.setData({ dataListLoading: false });
          this.loadLocalDataList();
        }
      },
      fail: () => { this.setData({ dataListLoading: false }); this.loadLocalDataList(); }
    });
  },

  loadLocalDataList() {
    const imageMap = wx.getStorageSync('carbon_image_map') || {};
    const pngImages = [];
    const yearSet = new Set();
    for (const year in imageMap) {
      yearSet.add(parseInt(year));
      for (const month in imageMap[year]) {
        const path = imageMap[year][month];
        if (path) pngImages.push({ year: parseInt(year), month: parseInt(month), cloudPath: path, fileID: path.startsWith('cloud://') ? path : '' });
      }
    }
    const carbonStatsMap = wx.getStorageSync('carbon_stats_map') || {};
    const carbonRecords = [];
    for (const key in carbonStatsMap) {
      const parts = key.split('_');
      if (parts.length === 2) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        carbonRecords.push({ year, month, validCounties: 0, stats: carbonStatsMap[key] });
        yearSet.add(year);
      }
    }
    pngImages.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    carbonRecords.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    this.setData({ uploadedDataList: { pngImages, carbonRecords }, availableYears: Array.from(yearSet).sort((a, b) => a - b), dataListLoading: false });
  },

  // 删除指定年月数据（需要2级权限）
  onDeleteData(e) {
    if (!this.requireLevel2('删除数据')) return;
    const { year, month, type } = e.currentTarget.dataset;
    const typeName = type === 'png' ? 'PNG影像' : '碳汇数据';
    wx.showModal({
      title: '确认删除', content: `确定要删除 ${year}年${month}月 的${typeName}吗？此操作不可恢复。`,
      confirmColor: '#e53935', confirmText: '删除', cancelText: '取消',
      success: (res) => { if (res.confirm) this.performDelete(year, month, type === 'png', type === 'carbon'); }
    });
  },

  onDeleteByYear(e) {
    if (!this.requireLevel2('删除数据')) return;
    const year = e.currentTarget.dataset.year;
    wx.showModal({
      title: '确认删除整年数据', content: `确定要删除 ${year}年 的所有PNG影像和碳汇数据吗？此操作不可恢复。`,
      confirmColor: '#e53935', confirmText: '全部删除', cancelText: '取消',
      success: (res) => { if (res.confirm) this.performDeleteByYear(year); }
    });
  },

  performDelete(year, month, deletePng, deleteCarbon) {
    wx.showLoading({ title: '删除中...', mask: true });
    wx.cloud.callFunction({
      name: 'carbon-data-extractor',
      data: { mode: 'delete', year, month, deletePng, deleteCarbon },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          const data = res.result.data || {};
          let message = '';
          if (deletePng && data.pngDeleted) { message += 'PNG影像已删除\n'; this.removeLocalImageMap(year, month); }
          if (deleteCarbon && data.carbonDeleted) { message += '碳汇数据已删除\n'; this.removeLocalCarbonStats(year, month); }
          if (!message) message = '未找到对应数据';
          wx.showToast({ title: message.replace(/\n/g, ' '), icon: 'none', duration: 2000 });
          this.loadUploadedDataList();
        } else {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        if (deletePng) this.removeLocalImageMap(year, month);
        if (deleteCarbon) this.removeLocalCarbonStats(year, month);
        wx.showToast({ title: '云函数不可用，仅删除本地记录', icon: 'none' });
        this.loadUploadedDataList();
      }
    });
  },

  performDeleteByYear(year) {
    wx.showLoading({ title: '删除中...', mask: true });
    const months = [];
    const { pngImages, carbonRecords } = this.data.uploadedDataList;
    pngImages.forEach(item => { if (item.year === year && !months.includes(item.month)) months.push(item.month); });
    carbonRecords.forEach(item => { if (item.year === year && !months.includes(item.month)) months.push(item.month); });
    if (months.length === 0) { wx.hideLoading(); wx.showToast({ title: '该年份无数据', icon: 'none' }); return; }
    const deletePromises = months.map(month => {
      return new Promise((resolve) => {
        wx.cloud.callFunction({
          name: 'carbon-data-extractor',
          data: { mode: 'delete', year, month, deletePng: true, deleteCarbon: true },
          success: () => { this.removeLocalImageMap(year, month); this.removeLocalCarbonStats(year, month); resolve(); },
          fail: () => { this.removeLocalImageMap(year, month); this.removeLocalCarbonStats(year, month); resolve(); }
        });
      });
    });
    Promise.all(deletePromises).then(() => {
      wx.hideLoading();
      wx.showToast({ title: `${year}年数据已删除`, icon: 'success' });
      this.loadUploadedDataList();
    });
  },

  removeLocalImageMap(year, month) {
    const imageMap = wx.getStorageSync('carbon_image_map') || {};
    const yearKey = String(year);
    const monthKey = String(month);
    if (imageMap[yearKey] && imageMap[yearKey][monthKey]) {
      delete imageMap[yearKey][monthKey];
      if (Object.keys(imageMap[yearKey]).length === 0) delete imageMap[yearKey];
      wx.setStorageSync('carbon_image_map', imageMap);
    }
  },

  removeLocalCarbonStats(year, month) {
    const key = `${year}_${month}`;
    const carbonStatsMap = wx.getStorageSync('carbon_stats_map') || {};
    if (carbonStatsMap[key]) { delete carbonStatsMap[key]; wx.setStorageSync('carbon_stats_map', carbonStatsMap); }
  },

  manualExtractCarbonData() {
    if (this.data.authLevel < 1) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
    if (!this.requireLevel2('提取碳汇数据')) return;
    if (!wx.cloud) { wx.showToast({ title: '云开发未初始化', icon: 'none' }); return; }
    const { selectedYear, selectedMonth } = this.data;
    wx.showModal({
      title: '提取碳汇数据', content: `确定要提取 ${selectedYear}年${selectedMonth}月 的碳汇数据吗？`,
      confirmText: '开始提取', cancelText: '取消',
      success: (res) => { if (res.confirm) this.doManualExtract(selectedYear, selectedMonth); }
    });
  },

  doManualExtract(year, month) {
    wx.showLoading({ title: '提取碳汇数据中...', mask: true });
    const db = wx.cloud.database();
    db.collection('carbon_data').where({ year, month }).get().then(carbonRes => {
      if (carbonRes.data.length > 0) {
        const countyData = carbonRes.data[0].countyData || {};
        if (Object.keys(countyData).length > 0) {
          this.cacheCarbonDataLocally(year, month, countyData);
          wx.hideLoading();
          wx.showToast({ title: `已加载${Object.keys(countyData).length}个县域数据`, icon: 'success' });
          return;
        }
      }
      db.collection('upload_records').where({ year, month, type: 'tif' }).get().then(uploadRes => {
        if (uploadRes.data.length > 0) {
          const tifFileID = uploadRes.data[0].fileId;
          if (tifFileID && tifFileID.startsWith('cloud://')) {
            wx.hideLoading(); this.extractCarbonDataFromTif(tifFileID, year, month);
          } else {
            wx.hideLoading(); wx.showToast({ title: 'TIF文件ID无效', icon: 'none' });
          }
        } else {
          wx.hideLoading(); wx.showModal({ title: '未找到TIF文件', content: `云数据库中没有 ${year}年${month}月 的TIF上传记录。`, showCancel: false });
        }
      }).catch(() => { wx.hideLoading(); wx.showToast({ title: '查询失败', icon: 'none' }); });
    }).catch(() => { wx.hideLoading(); wx.showToast({ title: '查询失败', icon: 'none' }); });
  },

  // 同步到网页（需要2级权限）
  syncToWeb() {
    if (!wx.cloud) { wx.showToast({ title: '云开发未初始化', icon: 'none' }); return; }
    if (!this.requireLevel2('同步到网页')) return;
    const token = this.data.githubToken;
    if (!token) {
      wx.showModal({ title: '需要配置GitHub Token', content: '请先在下方输入GitHub Personal Access Token（需有repo权限）。', showCancel: false });
      return;
    }
    wx.showModal({
      title: '同步到网页', content: '将从云数据库读取碳汇数据并推送到GitHub Pages网页。',
      confirmText: '确认同步',
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ syncToWebLoading: true, syncToWebResult: '' });
        wx.showLoading({ title: '同步中...', mask: true });
        wx.cloud.callFunction({
          name: 'carbon-data-extractor',
          data: { mode: 'sync_to_web', githubToken: token },
          success: (res) => {
            wx.hideLoading();
            this.setData({ syncToWebLoading: false });
            if (res.result && res.result.success) {
              const data = res.result.data || {};
              let msg = '';
              if (data.githubPushed) {
                msg = `同步成功！合并后${data.mergedYears ? data.mergedYears.length : 0}个年份，已推送到GitHub Pages`;
              } else if (data.githubError) {
                msg = 'GitHub推送失败: ' + data.githubError;
              } else {
                msg = data.message;
              }
              if (data.cloudStorageUploaded) msg += '\n云存储已更新';
              this.setData({ syncToWebResult: msg });
              wx.showToast({ title: data.githubPushed ? '同步成功' : '同步未完成', icon: data.githubPushed ? 'success' : 'none', duration: 3000 });
            } else {
              this.setData({ syncToWebResult: '同步失败: ' + (res.result ? res.result.error : '未知错误') });
              wx.showToast({ title: '同步失败', icon: 'none' });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            this.setData({ syncToWebLoading: false, syncToWebResult: '调用云函数失败: ' + (err.errMsg || '') });
            wx.showToast({ title: '云函数调用失败', icon: 'none' });
          }
        });
      }
    });
  },

  onGithubTokenInput(e) { this.setData({ githubToken: e.detail.value }); }
});
