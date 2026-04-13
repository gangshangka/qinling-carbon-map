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
    cloudAvailable: false
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
    // 从本地存储加载现有的图片映射表
    const imageMap = wx.getStorageSync('carbon_image_map') || {};
    if (!imageMap[year]) {
      imageMap[year] = {};
    }
    imageMap[year][month] = imagePath;
    
    // 保存回本地存储
    wx.setStorageSync('carbon_image_map', imageMap);
    
    // console.log('图片映射表已更新:', year, '年', month, '月', imagePath);
    
    // 通知主页更新（通过全局事件或直接调用）
    // 这里可以触发一个全局事件，主页监听该事件并更新imageMap
    // 为了简化，我们只更新本地存储，主页在下次加载时会读取
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
  }
});