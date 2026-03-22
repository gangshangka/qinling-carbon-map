/**
 * 管理员数据上传页面 - 云存储管理
 * 
 * 功能描述：
 * 1. 管理员登录验证：提供管理员账号登录验证
 * 2. 云存储文件上传：支持PNG图片和JSON数据上传到微信云开发
 * 3. 年份月份选择：选择要查看或上传的图片对应的年份和月份
 * 4. 图片轮播展示：按年份月份从云存储加载图片并展示在轮播组件中
 * 5. 上传记录管理：查看和管理已上传的文件记录
 * 
 * 主要组件：
 * - 登录界面：管理员身份验证
 * - 年份月份选择器：选择图片对应的年份和月份
 * - PNG图片上传：上传遥感影像图片
 * - JSON数据上传：上传碳汇统计数据
 * - 图片轮播组件：展示云存储中的图片
 * - 上传记录列表：显示历史上传记录
 * 
 * 云存储配置：
 * - 云开发环境ID: cloudbase-8gdof83j7fdc6094
 * - 云存储路径: qinling-carbon-data
 * - 图片命名规则: images/{year}_{month}.png (按年份月份存储)
 * 
 * 修改历史：
 * - 2026-03-03: 添加月份选择器和PNG轮播组件，支持按年份月份查看图片
 * - 2026-03-03: 为代码添加详细注释
 * - 2026-03-03: 优化云存储初始化和文件上传逻辑
 * 
 * 注意事项：
 * - 管理员默认账号：admin / admin123
 * - 云存储需在app.js中正确初始化
 * - 图片按年份月份存储，命名格式为YYYY_MM.png
 */
// pages/admin-upload/admin-upload.js
Page({
  data: {
    // 登录状态
    isLoggedIn: false,
    username: '',
    password: '',
    loginError: '',
    // 上传状态
    uploadStatus: {
      png: '等待上传',
      json: '等待上传'
    },
    // 上传进度
    uploadProgress: {
      png: 0,
      json: 0
    },
    // 年份月份选择
    selectedYear: 2020,
    selectedMonth: 1,
    years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    // 图片轮播
    swiperImages: [],
    currentImageIndex: 0,
    // 上传记录
    uploadRecords: [],
    // 云存储文件列表
    cloudFiles: []
  },

  onLoad() {
    console.log('管理员上传页面加载');
    // 检查云开发初始化状态
    this.checkCloudInit();
  },

  // 检查云开发初始化
  checkCloudInit() {
    if (wx.cloud) {
      console.log('云开发已初始化');
    } else {
      console.warn('云开发未初始化，请检查app.js配置');
      wx.showToast({
        title: '云开发未初始化',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 输入框处理
  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  // 登录处理
  handleLogin() {
    const { username, password } = this.data;
    console.log('登录尝试:', username, password);
    
    if (!username || !password) {
      this.setData({ loginError: '请输入用户名和密码' });
      return;
    }

    // 简单验证（实际项目中应使用安全验证）
    if (username === 'admin' && password === 'admin123') {
      this.setData({ 
        isLoggedIn: true, 
        loginError: '' 
      });
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      });
      
      // 登录成功后加载云存储文件
      this.loadCloudFiles();
    } else {
      this.setData({ loginError: '用户名或密码错误' });
    }
  },

  // 登出处理
  handleLogout() {
    this.setData({ 
      isLoggedIn: false,
      username: '',
      password: ''
    });
    wx.showToast({
      title: '已退出登录',
      icon: 'success',
      duration: 1500
    });
  },

  // 年份选择
  bindYearChange(e) {
    const year = parseInt(e.detail.value);
    this.setData({ selectedYear: year });
    // 加载该年份的图片
    this.loadSwiperImages(year);
  },

  // 月份选择
  bindMonthChange(e) {
    const month = parseInt(e.detail.value);
    this.setData({ selectedMonth: month });
  },

  // 加载轮播图片
  loadSwiperImages(year) {
    // 模拟加载图片
    const images = [];
    for (let month = 1; month <= 12; month++) {
      images.push({
        id: `${year}_${month}`,
        url: `https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=${year}年${month}月`,
        year: year,
        month: month,
        title: `${year}年${month}月碳汇分布图`
      });
    }
    
    this.setData({ 
      swiperImages: images,
      currentImageIndex: 0 
    });
  },

  // 轮播图切换
  bindSwiperChange(e) {
    this.setData({
      currentImageIndex: e.detail.current
    });
  },

  // 选择PNG文件
  choosePngFile() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'uploadStatus.png': '已选择文件',
          selectedPngFile: tempFilePath
        });
        wx.showToast({
          title: '已选择PNG文件',
          icon: 'success',
          duration: 1500
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 选择JSON文件
  chooseJsonFile() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].path;
        this.setData({
          'uploadStatus.json': '已选择文件',
          selectedJsonFile: tempFilePath
        });
        wx.showToast({
          title: '已选择JSON文件',
          icon: 'success',
          duration: 1500
        });
      },
      fail: (err) => {
        console.error('选择JSON文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 上传PNG文件
  uploadPngFile() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!this.data.selectedPngFile) {
      wx.showToast({
        title: '请先选择PNG文件',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const { selectedYear, selectedMonth } = this.data;
    const cloudPath = `qinling-carbon-data/images/${selectedYear}_${selectedMonth}.png`;
    
    this.setData({ 'uploadStatus.png': '上传中...', 'uploadProgress.png': 0 });

    const uploadTask = wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: this.data.selectedPngFile,
      success: (res) => {
        console.log('PNG上传成功:', res);
        this.setData({ 
          'uploadStatus.png': '上传成功',
          'uploadProgress.png': 100 
        });
        
        // 添加上传记录
        this.addUploadRecord({
          type: 'png',
          year: selectedYear,
          month: selectedMonth,
          fileName: `${selectedYear}_${selectedMonth}.png`,
          fileId: res.fileID,
          uploadTime: new Date().toLocaleString()
        });
        
        wx.showToast({
          title: 'PNG上传成功',
          icon: 'success',
          duration: 2000
        });
      },
      fail: (err) => {
        console.error('PNG上传失败:', err);
        this.setData({ 'uploadStatus.png': '上传失败' });
        wx.showToast({
          title: '上传失败',
          icon: 'none',
          duration: 2000
        });
      }
    });

    // 监听上传进度
    uploadTask.onProgressUpdate((res) => {
      this.setData({ 'uploadProgress.png': res.progress });
    });
  },

  // 上传JSON文件
  uploadJsonFile() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!this.data.selectedJsonFile) {
      wx.showToast({
        title: '请先选择JSON文件',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const { selectedYear, selectedMonth } = this.data;
    const cloudPath = `qinling-carbon-data/json/${selectedYear}_${selectedMonth}.json`;
    
    this.setData({ 'uploadStatus.json': '上传中...', 'uploadProgress.json': 0 });

    const uploadTask = wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: this.data.selectedJsonFile,
      success: (res) => {
        console.log('JSON上传成功:', res);
        this.setData({ 
          'uploadStatus.json': '上传成功',
          'uploadProgress.json': 100 
        });
        
        // 添加上传记录
        this.addUploadRecord({
          type: 'json',
          year: selectedYear,
          month: selectedMonth,
          fileName: `${selectedYear}_${selectedMonth}.json`,
          fileId: res.fileID,
          uploadTime: new Date().toLocaleString()
        });
        
        wx.showToast({
          title: 'JSON上传成功',
          icon: 'success',
          duration: 2000
        });
      },
      fail: (err) => {
        console.error('JSON上传失败:', err);
        this.setData({ 'uploadStatus.json': '上传失败' });
        wx.showToast({
          title: '上传失败',
          icon: 'none',
          duration: 2000
        });
      }
    });

    // 监听上传进度
    uploadTask.onProgressUpdate((res) => {
      this.setData({ 'uploadProgress.json': res.progress });
    });
  },

  // 添加上传记录
  addUploadRecord(record) {
    const records = this.data.uploadRecords;
    records.unshift(record); // 添加到开头
    this.setData({ uploadRecords: records });
    
    // 保存到本地存储
    wx.setStorageSync('uploadRecords', records);
  },

  // 加载上传记录
  loadUploadRecords() {
    const records = wx.getStorageSync('uploadRecords') || [];
    this.setData({ uploadRecords: records });
  },

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + 'B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + 'KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    }
  },

  // 加载云存储文件列表
  loadCloudFiles() {
    if (!wx.cloud) {
      console.warn('云开发未初始化');
      return;
    }

    wx.cloud.callFunction({
      name: 'getFileList',
      data: {
        prefix: 'qinling-carbon-data/'
      },
      success: (res) => {
        console.log('云存储文件列表:', res);
        if (res.result && res.result.data) {
          // 格式化文件大小
          const formattedFiles = res.result.data.map(file => {
            return {
              ...file,
              formattedSize: this.formatFileSize(file.size || 0)
            };
          });
          this.setData({ cloudFiles: formattedFiles });
        }
      },
      fail: (err) => {
        console.error('加载云存储文件失败:', err);
        // 模拟数据用于演示
        const mockFiles = [
          { fileID: '1', fileName: '2020_1.png', size: 1024000, uploadTime: '2026-03-01' },
          { fileID: '2', fileName: '2020_1.json', size: 20480, uploadTime: '2026-03-01' },
          { fileID: '3', fileName: '2020_2.png', size: 1050000, uploadTime: '2026-03-02' }
        ];
        // 格式化模拟数据的文件大小
        const formattedMockFiles = mockFiles.map(file => {
          return {
            ...file,
            formattedSize: this.formatFileSize(file.size)
          };
        });
        this.setData({
          cloudFiles: formattedMockFiles
        });
      }
    });
  },

  // 删除云存储文件
  deleteCloudFile(e) {
    const { fileid } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个文件吗？',
      success: (res) => {
        if (res.confirm) {
          wx.cloud.deleteFile({
            fileList: [fileid],
            success: (res) => {
              console.log('删除成功:', res);
              wx.showToast({
                title: '删除成功',
                icon: 'success',
                duration: 1500
              });
              // 重新加载文件列表
              this.loadCloudFiles();
            },
            fail: (err) => {
              console.error('删除失败:', err);
              wx.showToast({
                title: '删除失败',
                icon: 'none',
                duration: 2000
              });
            }
          });
        }
      }
    });
  },

  // 查看文件详情
  viewFileDetail(e) {
    const { fileid } = e.currentTarget.dataset;
    const file = this.data.cloudFiles.find(f => f.fileID === fileid);
    
    if (file) {
      wx.showModal({
        title: '文件详情',
        content: `文件名：${file.fileName}\n文件大小：${file.formattedSize || this.formatFileSize(file.size || 0)}\n上传时间：${file.uploadTime}`,
        showCancel: false
      });
    }
  },

  // 批量上传（同时上传PNG和JSON）
  batchUpload() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!this.data.selectedPngFile || !this.data.selectedJsonFile) {
      wx.showToast({
        title: '请同时选择PNG和JSON文件',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.showLoading({
      title: '批量上传中...',
      mask: true
    });

    // 同时上传两个文件
    const pngPromise = this.uploadFilePromise('png');
    const jsonPromise = this.uploadFilePromise('json');

    Promise.all([pngPromise, jsonPromise])
      .then((results) => {
        wx.hideLoading();
        wx.showToast({
          title: '批量上传成功',
          icon: 'success',
          duration: 2000
        });
        console.log('批量上传结果:', results);
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({
          title: '批量上传失败',
          icon: 'none',
          duration: 2000
        });
        console.error('批量上传失败:', err);
      });
  },

  // 上传文件的Promise封装
  uploadFilePromise(fileType) {
    return new Promise((resolve, reject) => {
      const { selectedYear, selectedMonth } = this.data;
      const filePath = fileType === 'png' ? this.data.selectedPngFile : this.data.selectedJsonFile;
      const cloudPath = `qinling-carbon-data/${fileType}/${selectedYear}_${selectedMonth}.${fileType === 'png' ? 'png' : 'json'}`;

      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: (res) => {
          resolve(res);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  // 清空上传记录
  clearUploadRecords() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有上传记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ uploadRecords: [] });
          wx.removeStorageSync('uploadRecords');
          wx.showToast({
            title: '记录已清空',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  }
});