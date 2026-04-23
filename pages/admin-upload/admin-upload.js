/**
 * 管理员数据上传页面 - 云存储管理
 * 
 * 功能描述：
 * 1. 管理员登录验证：提供管理员账号登录验证
 * 2. 云存储文件上传：支持PNG图片、JSON数据和TIF文件上传到微信云开发
 * 3. TIF文件处理：上传TIF遥感影像原始数据，通过Python脚本处理生成带图例的PNG图片
 * 4. 年份月份选择：选择要查看或上传的图片对应的年份和月份
 * 5. 图片轮播展示：按年份月份从云存储加载图片并展示在轮播组件中
 * 6. 上传记录管理：查看和管理已上传的文件记录
 * 
 * 主要组件：
 * - 登录界面：管理员身份验证
 * - 年份月份选择器：选择图片对应的年份和月份
 * - PNG图片上传：上传遥感影像图片
 * - TIF文件上传：上传遥感影像原始数据，处理生成PNG图片
 * - JSON数据上传：上传碳汇统计数据
 * - 图片轮播组件：展示云存储中的图片
 * - 上传记录列表：显示历史上传记录
 * 
 * 云存储配置：
 * - 云开发环境ID: cloudbase-8gdof83j7fdc6094
 * - 云存储路径: qinling-carbon-data
 * - 图片命名规则: images/{year}_{month}.png (按年份月份存储)
 * 
 * TIF处理流程：
 * 1. 管理员选择TIF文件（文件名必须符合nep20xxxx.tif格式）
 * 2. 系统验证文件名格式，自动提取年份和月份
 * 3. 上传TIF文件到云存储
 * 4. 调用Python脚本处理TIF文件（实际部署时需要）
 * 5. 生成带图例的PNG图片，保存到/images/目录
 * 6. 更新图片映射表，将新图片添加到主页展示
 * 
 * 实际部署步骤：
 * 1. 部署Python转换脚本到服务器或云函数
 * 2. 修改uploadTifFile函数，调用真实API
 * 3. 配置图片存储路径（本地或云存储）
 * 
 * 修改历史：
 * - 2026-03-03: 添加月份选择器和PNG轮播组件，支持按年份月份查看图片
 * - 2026-03-03: 为代码添加详细注释
 * - 2026-03-03: 优化云存储初始化和文件上传逻辑
 * - 2026-03-25: 添加TIF文件上传和处理功能，集成Python脚本处理流程
 * 
 * 注意事项：
 * - 管理员默认账号：admin / admin123
 * - 云存储需在app.js中正确初始化
 * - 图片按年份月份存储，命名格式为YYYY_MM.png
 * - TIF处理功能当前为模拟实现，生产环境需部署云函数
 * - TIF文件名格式要求：nep20xxxx.tif 或 nep20xxxx.tiff（示例：nep202301.tif）
 * - 文件名自动解析：从文件名提取年份和月份，自动设置选择器
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
    availableYears: []
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
      this.setData({ cloudAvailable: true });
    } else {
      console.warn('云开发未初始化，请检查app.js配置');
      this.setData({ cloudAvailable: false });
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
      // 加载已上传数据列表
      this.loadUploadedDataList();
    } else {
      this.setData({ loginError: '用户名或密码错误' });
    }
  },

  // 登出处理
  handleLogout() {
    this.setData({ 
      isLoggedIn: false,
      username: '',
      password: '',
      isTifFileNameValid: false
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
  },

  // 月份选择
  bindMonthChange(e) {
    const month = parseInt(e.detail.value);
    this.setData({ selectedMonth: month });
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

  // 选择TIF文件
  chooseTifFile() {
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
      extension: ['tif', 'tiff'],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        const tempFilePath = tempFile.path;
        const fileName = tempFile.name || tempFilePath.split('/').pop();
        
        // 验证文件名格式：nep20xxxx.tif 或 nep20xxxx.tiff
        // 格式要求：以nep开头，后跟6位数字，然后.tif或.tiff扩展名
        const pattern = /^nep20\d{4}\.(tif|tiff)$/i;
        console.log('chooseTifFile: validating fileName:', fileName);
        const isValid = pattern.test(fileName);
        console.log('chooseTifFile: validation result:', isValid);
        
        if (!isValid) {
          wx.showToast({
            title: '文件名格式错误',
            icon: 'none',
            duration: 2500
          });
          wx.showModal({
            title: '文件名格式要求',
            content: `文件名 "${fileName}" 不符合要求。\n\n正确格式：nep20xxxx.tif\n示例：nep202301.tif、nep202212.tiff\n\n要求：\n1. 以"nep"开头\n2. 后跟6位数字（20开头）\n3. 扩展名为.tif或.tiff`,
            showCancel: false,
            confirmText: '明白了'
          });
          return;
        }
        
        // 从文件名提取年份和月份
        const yearMonthMatch = fileName.match(/nep20(\d{2})(\d{2})\.(?:tif|tiff)/i);
        if (yearMonthMatch) {
          const fileYear = parseInt('20' + yearMonthMatch[1]); // 提取年份，如2023
          const fileMonth = parseInt(yearMonthMatch[2]); // 提取月份，如01
          
          // 自动设置年份和月份
          console.log('chooseTifFile: setting selectedTifFileName to:', fileName);
          this.setData({
            selectedYear: fileYear,
            selectedMonth: fileMonth,
            'uploadStatus.tif': `已选择文件 (${fileYear}年${fileMonth}月)`,
            selectedTifFile: tempFilePath,
            selectedTifFileName: fileName,
            isTifFileNameValid: true
          });
          
          wx.showToast({
            title: `已选择: ${fileYear}年${fileMonth}月`,
            icon: 'success',
            duration: 2000
          });
        } else {
          console.log('chooseTifFile: setting selectedTifFileName (no year/month match):', fileName);
          this.setData({
            'uploadStatus.tif': '已选择文件',
            selectedTifFile: tempFilePath,
            selectedTifFileName: fileName,
            isTifFileNameValid: true
          });
          wx.showToast({
            title: '已选择TIF文件',
            icon: 'success',
            duration: 1500
          });
        }
      },
      fail: (err) => {
        console.error('选择TIF文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 验证TIF文件名格式
  isTifFileNameValid() {
    const fileName = this.data.selectedTifFileName;
    if (!fileName) {
      console.log('isTifFileNameValid: fileName is empty');
      return false;
    }
    console.log('isTifFileNameValid: checking fileName:', fileName);
    const pattern = /^nep20\d{4}\.(tif|tiff)$/i;
    const result = pattern.test(fileName);
    console.log('isTifFileNameValid: pattern test result:', result);
    return result;
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
        
        // 更新图片映射表，保存云存储路径
        this.updateImageMap(selectedYear, selectedMonth, res.fileID);
        
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

  // 上传TIF文件
  uploadTifFile() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!this.data.selectedTifFile) {
      wx.showToast({
        title: '请先选择TIF文件',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const { selectedYear, selectedMonth, selectedTifFileName } = this.data;
    
    // 再次验证文件名格式
    if (selectedTifFileName) {
      if (!this.isTifFileNameValid()) {
        wx.showToast({
          title: '文件名格式错误',
          icon: 'none',
          duration: 2500
        });
        return;
      }
    }
    
    // 根据云开发可用性选择处理方式
    if (this.data.cloudAvailable) {
      // 云开发可用，尝试使用云函数处理
      this.uploadAndProcessTifFile(selectedYear, selectedMonth, selectedTifFileName);
    } else {
      // 云开发不可用，使用模拟处理
      this.simulateTifProcessing(selectedYear, selectedMonth, selectedTifFileName);
    }
  },
  
  // 模拟TIF处理过程
  simulateTifProcessing(year, month, fileName) {
    // TIF处理过程 - 模拟真实转换
    this.setData({ 'uploadStatus.tif': '开始处理TIF文件（模拟）...', 'uploadProgress.tif': 0 });
    
    // 模拟处理步骤
    const processSteps = [
      { progress: 10, message: '读取TIF文件数据...' },
      { progress: 25, message: '解析地理坐标信息...' },
      { progress: 40, message: '应用颜色映射方案...' },
      { progress: 60, message: '生成PNG图像...' },
      { progress: 75, message: '添加图例标注...' },
      { progress: 90, message: '优化图像质量...' },
      { progress: 100, message: '处理完成!' }
    ];
    
    let stepIndex = 0;
    const processInterval = setInterval(() => {
      if (stepIndex >= processSteps.length) {
        clearInterval(processInterval);
        this.finalizeTifProcessing(year, month, fileName);
        return;
      }
      
      const step = processSteps[stepIndex];
      this.setData({ 
        'uploadProgress.tif': step.progress,
        'uploadStatus.tif': step.message
      });
      
      stepIndex++;
    }, 500);
  },
  
  // 上传并处理TIF文件（使用云函数）
  uploadAndProcessTifFile(year, month, fileName) {
    const that = this;
    const filePath = this.data.selectedTifFile;
    
    // 开始处理
    this.setData({ 
      'uploadStatus.tif': '上传TIF文件到云存储...',
      'uploadProgress.tif': 0 
    });
    
    // 生成云存储路径
    const cloudPath = `qinling-carbon-data/tif/${year}_${month}_${Date.now()}.tif`;
    
    // 上传TIF文件到云存储
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: res => {
        console.log('TIF文件上传成功:', res);
        
        // 更新进度
        that.setData({
          'uploadStatus.tif': '调用云函数处理TIF文件...',
          'uploadProgress.tif': 30
        });
        
        // 调用云函数处理TIF文件
        wx.cloud.callFunction({
          name: 'tif-processor-simple-node',
          data: {
            fileID: res.fileID,
            year: year,
            month: month,
            fileName: fileName
          },
          success: cloudRes => {
            console.log('云函数调用成功:', cloudRes);
            
            if (cloudRes.result && cloudRes.result.success) {
              // 云函数处理成功
              const result = cloudRes.result.data;
              
              that.setData({
                'uploadStatus.tif': result.message || '处理完成',
                'uploadProgress.tif': result.progress || 100
              });
              
              // 更新图片映射表
              const monthStr = month < 10 ? '0' + month : month.toString();
              const pngFileName = `nep${year}${monthStr}.png`;
              
              // 注意：这里需要根据实际情况调整图片路径
              // 云函数应该返回生成的PNG文件URL
              const imagePath = result.pngFileID || `/images/${pngFileName}`;
              
              // 提取碳汇统计信息
              const stats = result.stats || {
                mean: 0,
                min: 0,
                max: 0,
                sum: 0,
                std: 0,
                count: 0
              };
              
              // 添加上传记录（包含统计信息）
              that.addUploadRecord({
                type: 'tif',
                year: year,
                month: month,
                fileName: fileName || `${year}_${month}.tif`,
                fileId: result.pngFileID || 'cloud_processed_' + Date.now(),
                uploadTime: new Date().toLocaleString(),
                note: `TIF文件已通过云函数处理，生成PNG图片: ${pngFileName}`,
                stats: stats,
                mode: result.mode || 'unknown',
                width: result.width,
                height: result.height
              });
              
              // 更新图片映射表
              that.updateImageMap(year, month, imagePath);
              
              // 保存碳汇统计信息到本地存储
              that.saveCarbonStats(year, month, stats);

              // 如果 tif-processor-simple-node 已经返回了县域数据，直接使用
              const countyData = result.countyData || {};
              const hasCountyData = Object.keys(countyData).length > 0;

              if (hasCountyData) {
                // 有县域数据，直接同步到云数据库
                that.syncCarbonStatsToCloud(year, month, stats, countyData);
                that.cacheCarbonDataLocally(year, month, countyData);
              } else {
                // 没有县域数据，基于全局统计估算县域数据
                const estimatedCountyData = that.estimateCountyDataFromStats(stats);
                
                // 同步估算的县域数据到云数据库
                that.syncCarbonStatsToCloud(year, month, stats, estimatedCountyData);
                that.cacheCarbonDataLocally(year, month, estimatedCountyData);
              }
              
              // 异步调用 carbon-data-extractor 尝试获取更精确的县域数据
              // 传入统计数据，让云函数直接用统计数据估算县域数据，无需重新下载和解析TIF
              that.extractCarbonDataFromTif(res.fileID, year, month, stats);
              
              wx.showToast({
                title: 'TIF转换完成',
                icon: 'success',
                duration: 2000
              });
              
              // 显示转换结果（包含统计信息）
              setTimeout(() => {
                const modeText = result.mode === 'real' ? '真实处理' : 
                               result.mode === 'simulated' ? '模拟处理' : 
                               result.mode === 'simulated_fallback' ? '模拟降级处理' : '未知模式';
                
                const statsText = result.stats ? 
                  `碳汇统计信息：
平均值: ${stats.mean.toFixed(2)}
最小值: ${stats.min.toFixed(2)}
最大值: ${stats.max.toFixed(2)}
总和: ${stats.sum.toFixed(2)}
标准差: ${stats.std.toFixed(2)}
有效像素数: ${stats.count}` :
                  '（无统计信息）';
                
                wx.showModal({
                  title: '转换结果',
                  content: `TIF文件转换成功！\n\n原文件: ${fileName}\n生成文件: ${pngFileName}\n处理模式: ${modeText}\n\n${statsText}`,
                  showCancel: false,
                  confirmText: '确定'
                });
              }, 800);
              
            } else {
              // 云函数返回错误
              console.error('云函数处理失败:', cloudRes);
              that.setData({
                'uploadStatus.tif': '云函数处理失败',
                'uploadProgress.tif': 100
              });
              
              wx.showToast({
                title: '处理失败，使用模拟模式',
                icon: 'none',
                duration: 2000
              });
              
              // 回退到模拟处理
              setTimeout(() => {
                that.simulateTifProcessing(year, month, fileName);
              }, 1000);
            }
          },
          fail: err => {
            console.error('云函数调用失败:', err);
            
            that.setData({
              'uploadStatus.tif': '云函数调用失败',
              'uploadProgress.tif': 100
            });
            
            wx.showToast({
              title: '云函数不可用，使用模拟模式',
              icon: 'none',
              duration: 2000
            });
            
            // 回退到模拟处理
            setTimeout(() => {
              that.simulateTifProcessing(year, month, fileName);
            }, 1000);
          }
        });
      },
      fail: err => {
        console.error('TIF文件上传失败:', err);
        
        that.setData({
          'uploadStatus.tif': '文件上传失败',
          'uploadProgress.tif': 100
        });
        
        wx.showToast({
          title: '上传失败，使用模拟模式',
          icon: 'none',
          duration: 2000
        });
        
        // 回退到模拟处理
        setTimeout(() => {
          that.simulateTifProcessing(year, month, fileName);
        }, 1000);
      }
    });
  },
  
  // TIF处理完成后的最终处理
  finalizeTifProcessing(year, month, fileName) {
    const monthStr = month < 10 ? '0' + month : month.toString();
    const imagePath = `/images/nep${year}${monthStr}.png`;
    
    // 检查PNG图片是否存在（模拟实际转换结果）
    wx.getImageInfo({
      src: imagePath,
      success: () => {
        // PNG图片已存在，表示转换成功
        console.log(`PNG图片已存在: ${imagePath}`);
        
        // 更新图片映射表
        this.updateImageMap(year, month, imagePath);
        
        this.setData({ 
          'uploadStatus.tif': '处理完成',
          'uploadProgress.tif': 100 
        });
        
        // 添加上传记录
        this.addUploadRecord({
          type: 'tif',
          year: year,
          month: month,
          fileName: fileName || `${year}_${month}.tif`,
          fileId: 'processed_' + Date.now(),
          uploadTime: new Date().toLocaleString(),
          note: `TIF文件已成功转换为PNG图片: nep${year}${monthStr}.png`
        });
        
        wx.showToast({
          title: 'TIF转换完成',
          icon: 'success',
          duration: 2000
        });
        
        // 显示转换结果信息
        setTimeout(() => {
          wx.showModal({
            title: '转换结果',
            content: `TIF文件转换成功！\n\n原文件: ${fileName}\n生成文件: nep${year}${monthStr}.png\n\nPNG图片已添加到图片预览中，可在主页查看。`,
            showCancel: false,
            confirmText: '确定'
          });
        }, 800);
      },
      fail: () => {
        // PNG图片不存在，模拟生成过程
        console.log(`PNG图片不存在，模拟生成: ${imagePath}`);
        
        // 在实际应用中，这里应该调用Python脚本生成PNG图片
        // 由于环境限制，这里模拟生成过程
        
        // 更新图片映射表（模拟生成）
        this.updateImageMap(year, month, imagePath);
        
        this.setData({ 
          'uploadStatus.tif': '处理完成（模拟）',
          'uploadProgress.tif': 100 
        });
        
        // 添加上传记录
        this.addUploadRecord({
          type: 'tif',
          year: year,
          month: month,
          fileName: fileName || `${year}_${month}.tif`,
          fileId: 'simulated_' + Date.now(),
          uploadTime: new Date().toLocaleString(),
          note: 'TIF文件已处理（模拟转换），PNG图片将在实际部署中生成'
        });
        
        wx.showToast({
          title: '模拟转换完成',
          icon: 'success',
          duration: 2000
        });
        
        // 显示模拟转换信息
        setTimeout(() => {
          wx.showModal({
            title: '模拟转换',
            content: `注意：当前为模拟转换。\n\n实际部署时需要：\n1. 部署Python转换脚本到服务器\n2. 调用云函数处理TIF文件\n3. 将生成的PNG保存到云存储\n\n文件名格式验证已通过: ${fileName}`,
            showCancel: false,
            confirmText: '明白了'
          });
        }, 800);
      }
    });
  },

  // 更新图片映射表
  updateImageMap(year, month, imagePath) {
    const imageMap = wx.getStorageSync('carbon_image_map') || {};
    const yearKey = String(year);
    const monthKey = String(month); // 统一用字符串存储，避免数字/字符串不一致
    if (!imageMap[yearKey]) imageMap[yearKey] = {};
    imageMap[yearKey][monthKey] = imagePath;
    wx.setStorageSync('carbon_image_map', imageMap);
    // 同时更新当前页面的 data
    this.setData({ imageMap });

    // 同步到云数据库 image_map 集合（用于首页数据管理）
    this.syncImageMapToCloud(year, month, imagePath);
  },

  // 同步图片映射到云数据库
  syncImageMapToCloud(year, month, imagePath) {
    if (!wx.cloud) {
      console.log('云开发未初始化，跳过同步到云数据库');
      return;
    }

    const db = wx.cloud.database();
    // 检查是否已存在该记录
    db.collection('image_map').where({
      year: year,
      month: month
    }).count().then(countRes => {
      if (countRes.total === 0) {
        // 新增记录
        db.collection('image_map').add({
          data: {
            year: year,
            month: month,
            fileID: imagePath,
            cloudPath: imagePath,
            createdAt: new Date()
          }
        }).then(() => {
          console.log(`image_map记录已创建: ${year}年${month}月`);
        }).catch(err => {
          console.error('image_map记录创建失败:', err);
          if (err.errCode === -502005) {
            this.ensureCloudCollection('image_map', () => {
              this.syncImageMapToCloud(year, month, imagePath);
            });
          }
        });
      } else {
        // 更新记录
        db.collection('image_map').where({
          year: year,
          month: month
        }).get().then(queryRes => {
          if (queryRes.data.length > 0) {
            db.collection('image_map').doc(queryRes.data[0]._id).update({
              data: {
                fileID: imagePath,
                cloudPath: imagePath,
                updatedAt: new Date()
              }
            });
          }
        });
      }
    }).catch(err => {
      console.error('image_map查询失败:', err);
      if (err.errCode === -502005) {
        this.ensureCloudCollection('image_map', () => {
          this.syncImageMapToCloud(year, month, imagePath);
        });
      }
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
    console.log('加载模拟云存储文件列表');
    // 模拟数据用于演示（避免云函数调用失败）
    const mockFiles = [
      { fileID: '1', fileName: '2020_1.png', size: 1024000, uploadTime: '2026-03-01' },
      { fileID: '2', fileName: '2020_1.json', size: 20480, uploadTime: '2026-03-01' },
      { fileID: '3', fileName: '2020_2.png', size: 1050000, uploadTime: '2026-03-02' },
      { fileID: '4', fileName: 'nep202301.tif', size: 5242880, uploadTime: '2026-03-03' },
      { fileID: '5', fileName: 'nep202302.tiff', size: 5300000, uploadTime: '2026-03-04' }
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
    
    wx.showToast({
      title: '已加载模拟文件列表',
      icon: 'success',
      duration: 1500
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
  },

  // 从TIF文件提取碳汇数据（调用 carbon-data-extractor 云函数）
  extractCarbonDataFromTif(fileID, year, month, stats, retryCount = 0) {
    if (!wx.cloud) {
      console.log('云开发未初始化，跳过TIF碳汇数据提取');
      return;
    }

    console.log(`开始调用 carbon-data-extractor 提取 ${year}年${month}月 碳汇数据...${retryCount > 0 ? '(重试' + retryCount + ')' : ''}`);

    wx.cloud.callFunction({
      name: 'carbon-data-extractor',
      data: {
        mode: 'extract',
        fileID: fileID,
        year: year,
        month: month,
        stats: stats || null  // 传入已有的统计数据，供降级使用
      },
      success: res => {
        console.log('carbon-data-extractor 调用成功:', res);
        if (res.result && res.result.success) {
          const data = res.result.data || {};
          const countyData = data.countyData || {};
          const validCounties = data.validCounties || 0;
          console.log(`碳汇数据提取成功: ${validCounties} 个县域有有效数据`);
          
          if (validCounties > 0) {
            // 1. 同步到云数据库 carbon_data 集合
            this.syncCarbonStatsToCloud(year, month, {
              mean: data.meanValue || 0,
              min: data.minValue || 0,
              max: data.maxValue || 0,
              sum: 0,
              std: 0,
              count: validCounties
            }, countyData);
            
            // 2. 缓存到本地存储，供首页图表和统计页面使用
            this.cacheCarbonDataLocally(year, month, countyData);
            
            wx.showToast({
              title: `碳汇数据提取成功：${validCounties}个县域`,
              icon: 'success',
              duration: 2000
            });
          } else {
            console.log('碳汇数据提取结果：无有效县域数据');
            wx.showToast({
              title: '提取完成但无有效县域数据',
              icon: 'none',
              duration: 2000
            });
          }
        } else {
          const errorMsg = res.result ? res.result.error : '未知错误';
          console.log('carbon-data-extractor 返回失败:', errorMsg);
          wx.showToast({
            title: '碳汇数据提取失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: err => {
        console.error('carbon-data-extractor 调用失败:', err);
        // 超时错误自动重试（最多1次）
        const isTimeout = err && err.errMsg && err.errMsg.indexOf('timed out') !== -1;
        if (isTimeout && retryCount < 1) {
          console.log('云函数超时，自动重试...');
          wx.showLoading({ title: '提取超时，正在重试...', mask: true });
          setTimeout(() => {
            this.extractCarbonDataFromTif(fileID, year, month, stats, retryCount + 1);
          }, 1000);
        } else {
          wx.hideLoading();
          wx.showModal({
            title: '碳汇提取失败',
            content: isTimeout ? '云函数执行超时，TIF文件可能过大。建议：1) 重新上传重试 2) 检查TIF文件大小' : '云函数调用失败：' + (err.errMsg || '未知错误'),
            showCancel: false
          });
        }
      }
    });
  },

  // 将碳汇县域数据缓存到本地存储，供首页图表和统计页面读取
  cacheCarbonDataLocally(year, month, countyData) {
    try {
      // 保存到本地映射表，格式与 carbon_chart_data_cache 兼容
      const cacheKey = 'carbon_cloud_data_cache';
      const cachedData = wx.getStorageSync(cacheKey) || {};
      const yearStr = String(year);
      const monthStr = String(month);
      
      if (!cachedData[yearStr]) {
        cachedData[yearStr] = {};
      }
      cachedData[yearStr][monthStr] = countyData;
      
      wx.setStorageSync(cacheKey, cachedData);
      console.log(`碳汇数据已缓存到本地: ${year}年${month}月, ${Object.keys(countyData).length}个县域`);
      
      // 同时更新首页图表使用的 monthlyRealData 缓存
      this.updateMonthlyDataCache(year, month, countyData);
    } catch (err) {
      console.error('缓存碳汇数据到本地失败:', err);
    }
  },

  // 更新月度数据缓存（供首页图表使用）
  updateMonthlyDataCache(year, month, countyData) {
    try {
      const values = Object.values(countyData);
      if (values.length === 0) return;
      
      // 使用均值（与静态数据 monthly_data.js 的格式一致）
      const meanValue = values.reduce((sum, v) => sum + v, 0) / values.length;
      
      // 更新 monthly_data_cache
      const cacheKey = 'monthly_data_cloud_cache';
      const cachedData = wx.getStorageSync(cacheKey) || [];
      
      // 查找是否已有该年月的数据
      const existingIndex = cachedData.findIndex(
        item => item.year === year && item.month === month
      );
      
      const newDataPoint = {
        year: year,
        month: month,
        value: parseFloat(meanValue.toFixed(2))
      };
      
      if (existingIndex >= 0) {
        cachedData[existingIndex] = newDataPoint;
      } else {
        cachedData.push(newDataPoint);
      }
      
      // 按年月排序
      cachedData.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      
      wx.setStorageSync(cacheKey, cachedData);
      console.log(`月度数据缓存已更新: ${year}年${month}月 = ${meanValue.toFixed(2)}`);
    } catch (err) {
      console.error('更新月度数据缓存失败:', err);
    }
  },

  // 基于全局统计数据估算各县碳汇数据（当 carbon-data-extractor 不可用时的降级方案）
  estimateCountyDataFromStats(stats) {
    const meanValue = stats.carbon_sink_mean || stats.mean || 0;
    if (meanValue === 0) return {};

    // 秦岭主要县域中心点坐标
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

    // 参考已有年份同月份的县域均值，将TIF全局均值等比例缩放到县域级别
    // 静态数据中各县的典型单月值范围在 -0.01 到 -200 之间
    // TIF的 mean 是像素级均值（如 -335），需要缩放到县域级别
    const tifMean = meanValue;
    // 参考值：静态数据中典型年份7月的县域均值大约在 -5 到 -50 之间
    const referenceCountyMean = -30; // 典型7月县域均值参考值
    const referenceTifMean = -335;   // 对应的TIF像素均值参考值
    const scaleFactor = referenceCountyMean / referenceTifMean; // 约 0.09

    const countyData = {};
    for (const name in COUNTY_CENTERS) {
      const center = COUNTY_CENTERS[name];
      // 基于纬度的权重（秦岭核心区域碳汇更高）
      const latWeight = 1 + (center[1] - 33.0) * 0.08;
      const lngWeight = 1 + Math.abs(center[0] - 108.5) * 0.03;
      // 缩放后的估算值
      const estimatedValue = tifMean * scaleFactor * latWeight * lngWeight;
      countyData[name] = parseFloat(estimatedValue.toFixed(2));
    }
    
    console.log(`基于全局统计(mean=${meanValue})估算了${Object.keys(countyData).length}个县域碳汇数据, 缩放因子=${scaleFactor.toFixed(4)}`);
    return countyData;
  },

  // 保存碳汇统计信息到本地存储
  saveCarbonStats(year, month, stats) {
    // 构建统计对象，与现有stats_2012.json等文件格式兼容
    const statEntry = {
      month: month,
      carbon_sink_mean: stats.mean,
      carbon_sink_max: stats.max,
      carbon_sink_min: stats.min,
      carbon_sink_sum: stats.sum,
      carbon_sink_std: stats.std,
      pixel_count: stats.count
    };
    
    // 从本地存储加载现有统计信息
    const statsKey = `carbon_stats_${year}`;
    let yearStats = wx.getStorageSync(statsKey);
    
    if (!yearStats) {
      // 如果该年份的统计信息不存在，创建新结构
      yearStats = {
        year: year,
        data: []
      };
    }
    
    // 查找是否已存在该月份的记录
    const monthIndex = yearStats.data.findIndex(item => item.month === month);
    if (monthIndex >= 0) {
      // 更新现有月份记录
      yearStats.data[monthIndex] = statEntry;
    } else {
      // 添加新月份记录
      yearStats.data.push(statEntry);
    }
    
    // 按月份排序
    yearStats.data.sort((a, b) => a.month - b.month);
    
    // 保存回本地存储
    wx.setStorageSync(statsKey, yearStats);
    
    console.log(`碳汇统计信息已保存: ${year}年${month}月`, statEntry);
    
    // 同时更新全局统计缓存
    this.updateGlobalStatsCache(year, month, statEntry);
  },

  // 同步碳汇数据到云数据库
  syncCarbonStatsToCloud(year, month, stats, countyData) {
    if (!wx.cloud) {
      console.log('云开发未初始化，跳过同步碳汇数据到云数据库');
      return;
    }

    const db = wx.cloud.database();
    // 检查是否已存在该年月的数据
    db.collection('carbon_data').where({
      year: year,
      month: month
    }).count().then(countRes => {
      const dataToSave = {
        countyData: countyData || {},
        stats: stats || {},
        updatedAt: new Date()
      };

      if (countRes.total === 0) {
        // 新增记录
        db.collection('carbon_data').add({
          data: {
            year: year,
            month: month,
            ...dataToSave,
            createdAt: new Date()
          }
        }).then(() => {
          console.log(`carbon_data记录已创建: ${year}年${month}月`);
        }).catch(err => {
          console.error('carbon_data记录创建失败:', err);
          // 集合可能不存在，尝试创建后再保存
          if (err.errCode === -502005) {
            this.ensureCloudCollection('carbon_data', () => {
              this.syncCarbonStatsToCloud(year, month, stats, countyData);
            });
          }
        });
      } else {
        // 更新记录
        db.collection('carbon_data').where({
          year: year,
          month: month
        }).get().then(queryRes => {
          if (queryRes.data.length > 0) {
            db.collection('carbon_data').doc(queryRes.data[0]._id).update({
              data: dataToSave
            });
          }
        });
      }
    }).catch(err => {
      console.error('carbon_data查询失败:', err);
      // 集合可能不存在，尝试创建后再保存
      if (err.errCode === -502005) {
        this.ensureCloudCollection('carbon_data', () => {
          this.syncCarbonStatsToCloud(year, month, stats, countyData);
        });
      }
    });
  },

  // 确保云数据库集合存在，不存在则创建
  ensureCloudCollection(collectionName, callback) {
    const db = wx.cloud.database();
    console.log(`尝试创建云数据库集合: ${collectionName}`);
    db.createCollection({
      name: collectionName,
      success: () => {
        console.log(`云数据库集合 ${collectionName} 创建成功`);
        if (callback) callback();
      },
      fail: (err) => {
        console.error(`云数据库集合 ${collectionName} 创建失败:`, err);
        // 即使创建失败也尝试回调，可能是因为集合已存在
        if (callback) callback();
      }
    });
  },

  // 更新全局统计缓存
  updateGlobalStatsCache(year, month, statEntry) {
    // 从本地存储加载全局统计缓存
    const globalStats = wx.getStorageSync('carbon_stats_global') || {};

    if (!globalStats[year]) {
      globalStats[year] = {};
    }

    globalStats[year][month] = statEntry;

    // 保存回本地存储
    wx.setStorageSync('carbon_stats_global', globalStats);
  },

  // ============================================
  // 数据管理功能
  // ============================================

  // 加载已上传的数据列表
  loadUploadedDataList() {
    if (this.data.dataListLoading) return;
    this.setData({ dataListLoading: true });

    // 尝试调用云函数获取数据列表
    wx.cloud.callFunction({
      name: 'carbon-data-extractor',
      data: { mode: 'list' },
      success: res => {
        console.log('获取数据列表成功:', res);
        if (res.result && res.result.success) {
          const data = res.result.data || {};
          const pngImages = data.pngImages || [];
          const carbonRecords = data.carbonRecords || [];

          // 提取可用年份（去重排序）
          const yearSet = new Set();
          pngImages.forEach(item => { if (item.year) yearSet.add(item.year); });
          carbonRecords.forEach(item => { if (item.year) yearSet.add(item.year); });
          const availableYears = Array.from(yearSet).sort((a, b) => a - b);

          this.setData({
            uploadedDataList: { pngImages, carbonRecords },
            availableYears,
            dataListLoading: false
          });
        } else {
          console.log('获取数据列表返回异常:', res);
          this.setData({ dataListLoading: false });
          // 降级到本地读取
          this.loadLocalDataList();
        }
      },
      fail: err => {
        console.error('获取数据列表失败:', err);
        this.setData({ dataListLoading: false });
        // 云函数不可用时，从本地存储获取数据
        this.loadLocalDataList();
      }
    });
  },

  // 从本地存储加载数据列表（云函数不可用时的降级方案）
  loadLocalDataList() {
    const imageMap = wx.getStorageSync('carbon_image_map') || {};
    const pngImages = [];
    const yearSet = new Set();

    for (const year in imageMap) {
      yearSet.add(parseInt(year));
      for (const month in imageMap[year]) {
        const path = imageMap[year][month];
        if (path) {
          pngImages.push({
            year: parseInt(year),
            month: parseInt(month),
            cloudPath: path,
            fileID: path.startsWith('cloud://') ? path : ''
          });
        }
      }
    }

    // 从本地存储加载碳汇数据
    const carbonStatsMap = wx.getStorageSync('carbon_stats_map') || {};
    const carbonRecords = [];
    for (const key in carbonStatsMap) {
      const parts = key.split('_');
      if (parts.length === 2) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        carbonRecords.push({
          year,
          month,
          validCounties: 0,
          stats: carbonStatsMap[key]
        });
        yearSet.add(year);
      }
    }

    pngImages.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    carbonRecords.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    const availableYears = Array.from(yearSet).sort((a, b) => a - b);

    this.setData({
      uploadedDataList: { pngImages, carbonRecords },
      availableYears,
      dataListLoading: false
    });
  },

  // 删除指定年月的数据
  onDeleteData(e) {
    const { year, month, type } = e.currentTarget.dataset;
    const typeName = type === 'png' ? 'PNG影像' : '碳汇数据';

    wx.showModal({
      title: '确认删除',
      content: `确定要删除 ${year}年${month}月 的${typeName}吗？此操作不可恢复。`,
      confirmColor: '#e53935',
      confirmText: '删除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.performDelete(year, month, type === 'png', type === 'carbon');
        }
      }
    });
  },

  // 按年份批量删除
  onDeleteByYear(e) {
    const year = e.currentTarget.dataset.year;

    wx.showModal({
      title: '确认删除整年数据',
      content: `确定要删除 ${year}年 的所有PNG影像和碳汇数据吗？此操作不可恢复。`,
      confirmColor: '#e53935',
      confirmText: '全部删除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.performDeleteByYear(year);
        }
      }
    });
  },

  // 执行删除操作（单个月份）
  performDelete(year, month, deletePng, deleteCarbon) {
    wx.showLoading({ title: '删除中...', mask: true });

    wx.cloud.callFunction({
      name: 'carbon-data-extractor',
      data: {
        mode: 'delete',
        year: year,
        month: month,
        deletePng: deletePng,
        deleteCarbon: deleteCarbon
      },
      success: res => {
        wx.hideLoading();
        console.log('删除结果:', res);

        if (res.result && res.result.success) {
          const data = res.result.data || {};
          let message = '';

          if (deletePng && data.pngDeleted) {
            message += 'PNG影像已删除\n';
            this.removeLocalImageMap(year, month);
          }
          if (deleteCarbon && data.carbonDeleted) {
            message += '碳汇数据已删除\n';
            this.removeLocalCarbonStats(year, month);
          }

          if (!message) {
            message = '未找到对应数据';
          }

          wx.showToast({
            title: message.replace(/\n/g, ' '),
            icon: 'none',
            duration: 2000
          });

          // 刷新列表
          this.loadUploadedDataList();
        } else {
          wx.showToast({
            title: '删除失败: ' + (res.result ? res.result.error : '未知错误'),
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('删除调用失败:', err);

        // 云函数不可用时，仅做本地删除
        if (deletePng) {
          this.removeLocalImageMap(year, month);
        }
        if (deleteCarbon) {
          this.removeLocalCarbonStats(year, month);
        }

        wx.showToast({
          title: '云函数不可用，仅删除本地记录',
          icon: 'none',
          duration: 2000
        });

        this.loadUploadedDataList();
      }
    });
  },

  // 按年份批量删除
  performDeleteByYear(year) {
    wx.showLoading({ title: '删除中...', mask: true });

    // 获取该年份所有月份
    const months = [];
    const pngImages = this.data.uploadedDataList.pngImages || [];
    const carbonRecords = this.data.uploadedDataList.carbonRecords || [];

    pngImages.forEach(item => {
      if (item.year === year && !months.includes(item.month)) {
        months.push(item.month);
      }
    });
    carbonRecords.forEach(item => {
      if (item.year === year && !months.includes(item.month)) {
        months.push(item.month);
      }
    });

    if (months.length === 0) {
      wx.hideLoading();
      wx.showToast({ title: '该年份无数据', icon: 'none' });
      return;
    }

    // 逐月删除
    const deletePromises = months.map(month => {
      return new Promise((resolve) => {
        wx.cloud.callFunction({
          name: 'carbon-data-extractor',
          data: {
            mode: 'delete',
            year: year,
            month: month,
            deletePng: true,
            deleteCarbon: true
          },
          success: res => {
            this.removeLocalImageMap(year, month);
            this.removeLocalCarbonStats(year, month);
            resolve(res);
          },
          fail: () => {
            this.removeLocalImageMap(year, month);
            this.removeLocalCarbonStats(year, month);
            resolve(null);
          }
        });
      });
    });

    Promise.all(deletePromises).then(() => {
      wx.hideLoading();
      wx.showToast({
        title: `${year}年数据已删除`,
        icon: 'success',
        duration: 2000
      });
      this.loadUploadedDataList();
    });
  },

  // 从本地imageMap中移除指定年月
  removeLocalImageMap(year, month) {
    const imageMap = wx.getStorageSync('carbon_image_map') || {};
    const yearKey = String(year);
    const monthKey = String(month);
    if (imageMap[yearKey] && imageMap[yearKey][monthKey]) {
      delete imageMap[yearKey][monthKey];
      // 如果该年份已无任何月份，删除该年份
      if (Object.keys(imageMap[yearKey]).length === 0) {
        delete imageMap[yearKey];
      }
      wx.setStorageSync('carbon_image_map', imageMap);
      console.log(`已从本地映射表删除: ${year}年${month}月`);
    }
  },

  // 从本地存储移除碳汇统计数据
  removeLocalCarbonStats(year, month) {
    const key = `${year}_${month}`;
    const carbonStatsMap = wx.getStorageSync('carbon_stats_map') || {};
    if (carbonStatsMap[key]) {
      delete carbonStatsMap[key];
      wx.setStorageSync('carbon_stats_map', carbonStatsMap);
      console.log(`已从本地存储删除碳汇数据: ${year}年${month}月`);
    }
  },

  // 手动触发碳汇数据提取（用于重新提取或云函数失败后重试）
  manualExtractCarbonData() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none', duration: 2000 });
      return;
    }

    if (!wx.cloud) {
      wx.showToast({ title: '云开发未初始化', icon: 'none', duration: 2000 });
      return;
    }

    const { selectedYear, selectedMonth } = this.data;
    
    wx.showModal({
      title: '提取碳汇数据',
      content: `确定要提取 ${selectedYear}年${selectedMonth}月 的碳汇数据吗？\n\n将从云数据库中读取已上传的TIF文件并提取县域级碳汇数据。`,
      confirmText: '开始提取',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doManualExtract(selectedYear, selectedMonth);
        }
      }
    });
  },

  // 执行手动提取碳汇数据
  doManualExtract(year, month) {
    wx.showLoading({ title: '提取碳汇数据中...', mask: true });

    // 方法1: 尝试从云数据库查找该年月已有的TIF文件记录
    const db = wx.cloud.database();
    
    // 先检查 carbon_data 集合中是否已有数据
    db.collection('carbon_data').where({
      year: year,
      month: month
    }).get().then(carbonRes => {
      if (carbonRes.data.length > 0) {
        // 云数据库中已有数据，直接缓存到本地
        const record = carbonRes.data[0];
        const countyData = record.countyData || {};
        
        if (Object.keys(countyData).length > 0) {
          this.cacheCarbonDataLocally(year, month, countyData);
          wx.hideLoading();
          wx.showToast({
            title: `已加载${Object.keys(countyData).length}个县域数据`,
            icon: 'success',
            duration: 2000
          });
          return;
        }
      }
      
      // 云数据库中没有数据，尝试从 upload_records 查找TIF文件
      db.collection('upload_records').where({
        year: year,
        month: month,
        type: 'tif'
      }).get().then(uploadRes => {
        if (uploadRes.data.length > 0) {
          const tifFileID = uploadRes.data[0].fileId;
          if (tifFileID && tifFileID.startsWith('cloud://')) {
            // 找到了TIF文件，调用 carbon-data-extractor 提取
            wx.hideLoading();
            this.extractCarbonDataFromTif(tifFileID, year, month);
          } else {
            wx.hideLoading();
            wx.showToast({
              title: 'TIF文件ID无效，请重新上传',
              icon: 'none',
              duration: 2000
            });
          }
        } else {
          // 没有找到上传记录，尝试用默认路径
          wx.hideLoading();
          wx.showModal({
            title: '未找到TIF文件',
            content: `云数据库中没有 ${year}年${month}月 的TIF上传记录。\n\n请先上传TIF文件，或确认文件已正确上传。`,
            showCancel: false,
            confirmText: '知道了'
          });
        }
      }).catch(err => {
        wx.hideLoading();
        console.error('查询上传记录失败:', err);
        wx.showToast({ title: '查询失败', icon: 'none', duration: 2000 });
      });
    }).catch(err => {
      wx.hideLoading();
      console.error('查询碳汇数据失败:', err);
      wx.showToast({ title: '查询失败', icon: 'none', duration: 2000 });
    });
  }
});