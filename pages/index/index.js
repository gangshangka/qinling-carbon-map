// 导入月度数据（从 data 目录下的 monthly_data.js 文件）
import monthlyData from '../../data/monthly_data.js';

// 定义页面对象
Page({
  // 页面数据（相当于组件的状态）
  data: {
    // 双图层交叉淡入系统：A/B两层交替显示，切换时始终有一层覆盖占位图
    imageLayerA: '',        // 图层A的图片URL
    imageLayerB: '',        // 图层B的图片URL
    opacityA: 0,            // 图层A透明度
    opacityB: 0,            // 图层B透明度
    activeLayer: '',        // 当前显示的图层（'A'或'B'），空表示尚未初始化
    layerALoaded: false,    // 图层A图片是否加载完成
    layerBLoaded: false,    // 图层B图片是否加载完成
    // 保留 currentImageUrl 用于外部兼容引用
    currentImageUrl: '',
    // 占位图路径（固定，使用/images/nep201201.png作为永久占位图）
    placeholderImageUrl: '/images/nep201201.png',
    // 当前选中的年份
    currentYear: 2012,
    // 当前选中的月份
    currentMonth: 1,
    // 最小年份
    minYear: 2012,
    // 最大年份
    maxYear: 2024,
    // 年份选项卡列表（从2012到2024，包含2024）
    yearTabs: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2024],
    // 月份选项卡列表（1到12）
    monthTabs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    // 图片是否加载完成（图层系统中用于判断当前图是否已显示）
    imageLoaded: false,
    // 图片是否加载失败
    imageError: false,
    // 图片信息（宽高比等）
    imageInfo: { width: 0, height: 0, ratio: '0%' },
    // 所有月度数据（从导入的 monthlyData 得到）
    monthlyRealData: monthlyData,
    // 当前年份的月度数据（用于图表）
    currentMonthlyData: [],
    // 图片缩放比例（1为原始大小）
    imageScale: 1.0,
    // 缩放百分比显示
    scalePercent: 100,
    // 预加载完成的年份数组
    preloadedYears: [],
    // 预加载进度
    loadProgress: 0,
    // 图片映射表：存储已上传的图片路径，格式: {年份: {月份: 图片路径}}
    imageMap: {},
    
    // 自动播放相关
    autoPlay: false,            // 是否正在自动播放
    autoPlayStatus: '停止',     // 自动播放状态文本
    autoPlayTimer: null,        // 定时器ID
    autoPlayInterval: 30,        // 切换过渡时间（毫秒），极短仅用于图片间切换过渡
    autoPlayDisplayTime: 1500,   // 单张图片保持显示时间（毫秒），图片加载完成后保持展示的时间
    waitingForImageLoad: false, // 是否在等待图片加载完成（用于自动播放）
    // 占位图失败最短展示时间（毫秒），避免占位图停留过久
    placeholderMinDisplayTime: 200,
    showMonthPicker: false,     // 是否显示月份选择弹窗
    showYearPicker: false,      // 是否显示年份选择弹窗

    // 图表绘制状态
    chartDrawn: false,          // 图表是否已绘制
    chartHidden: false,         // 图表是否隐藏（用于页面切换时避免遮挡动画）
    lastDrawnYear: null,        // 上次绘制的年份，用于避免重复绘制
    drawTimer: null,            // 延迟绘制的定时器
      // ...原有字段
      cloudTempUrlCache: {},      // 云存储临时URL缓存 { cloudPath: { url, expireTime } }
      localFileCache: {},         // 本地文件缓存 { cacheKey: { filePath, lastAccessTime, size } }
      allCloudUrlsPreloaded: false, // 是否已完成全部预加载
      localImagesPreloaded: false,   // 本地图片是否已预加载完成
      localPreloadStarted: false,    // 本地图片预加载是否已开始
      allImagesPreloaded: false,     // 是否所有图片（本地和云端）都已预加载
      allCloudFilesCached: false,
      loggedMissingImages: {},      // 记录已经输出过"无图片"日志的年份月份，避免重复输出
  },

  // 页面加载时触发
  onLoad() {
    // 控制台输出页面标题，用于调试
    console.log('=== 秦岭碳汇遥感影像查看器 ===');
    // 加载当前选中的图片（默认2012年1月）
    this.loadImage();
    // 初始化图片映射表（从本地存储读取管理员上传的图片信息）
    this.initImageMap();
    // 预加载所有年份的图片（提高体验）- 在初始化图片映射表之后，确保年份列表已更新
    // 注意：预加载将在 updateYearTabsFromImageMap 中自动触发，无需手动调用
    // 获取系统信息（屏幕尺寸等）
    this.getSystemInfo();
    
    // 同时启动：预加载云端URL + 预下载缓存到本地（并行，不再串行等待）
    this.preloadAllCloudImages().then(() => {
      console.log('云端图片临时URL预加载完成');
    }).catch(err => {
      console.log('云端URL预加载失败:', err);
    });
    
    // 立即开始预下载并缓存云端图片到本地（与URL预加载并行）
    this.preDownloadAndCacheAllCloudImages().then(() => {
      console.log('云端图片本地缓存完成，后续切换将使用本地缓存');
    }).catch(err => {
      console.log('预缓存失败，但不影响正常使用:', err);
    });
    
    // 监听本地存储变化，当图片映射表更新时重新加载
    if (wx.onStorageChange) {
      // 如果微信支持存储变化监听
      wx.onStorageChange((res) => {
        // 当存储变化时，检查变化的键是否为 carbon_image_map
        if (res.key === 'carbon_image_map') {
          // 控制台输出检测到更新
          console.log('检测到图片映射表更新，重新加载');
          // 重新初始化图片映射表
          this.initImageMap();
          // 如果当前显示的年份月份有更新，重新加载图片
          const { currentYear, currentMonth } = this.data;
          // 从存储中获取最新的图片映射表
          const imageMap = wx.getStorageSync('carbon_image_map') || {};
          // 如果当前年份月份有对应的上传图片，则重新加载图片
          if (imageMap[currentYear] && imageMap[currentYear][currentMonth]) {
            this.loadImage(currentYear, currentMonth);

          }
        }
      });
    }
  },
  
  // 页面初次渲染完成时触发（此时可以操作DOM）
  onReady() {
    // 控制台输出渲染完成
    console.log('页面渲染完成，开始初始化统计图');
    // 等待年份选择器加载完成后绘制统计图（确保canvas可用）
    this.waitForYearSelectorAndDraw();
  },
  
  // 页面显示时触发（每次进入页面都会调用）
  onShow() {
    // 控制台输出页面显示
    console.log('主页显示，恢复统计图层级');
    // 显示图表容器（解除隐藏）
    this.setData({ chartHidden: false });
    
    // 每次显示页面时检查图片映射表是否有更新（确保新上传的图片能立即显示）
    // 使用防抖机制，避免频繁调用
    if (!this._lastImageMapCheck || Date.now() - this._lastImageMapCheck > 1000) {
      console.log('检查图片映射表更新...');
      this.initImageMap();
      this._lastImageMapCheck = Date.now();
    }
    
    // 清除之前的延迟绘制任务
    if (this.data.drawTimer) {
      clearTimeout(this.data.drawTimer);
    }
    
    // 延迟300ms再绘制图表，避开页面切换动画，避免卡顿
    const timer = setTimeout(() => {
      // 调用等待并绘制图表的方法
      this.waitForYearSelectorAndDraw();
      // 将定时器ID置空
      this.setData({ drawTimer: null });
    }, 300);
    // 保存定时器ID到数据中，便于清除
    this.setData({ drawTimer: timer });
  },
  
  // 页面隐藏时触发（如切换到其他页面）
  onHide() {
    // 控制台输出页面隐藏
    console.log('主页隐藏，降低统计图层级');
    // 清除延迟绘制定时器，避免在隐藏时还在绘制
    if (this.data.drawTimer) {
      clearTimeout(this.data.drawTimer);
      this.setData({ drawTimer: null });
    }
    // 隐藏图表容器，防止其遮挡页面切换动画，并重置绘制年份缓存
    this.setData({ chartHidden: true, lastDrawnYear: null });
    
    // 关闭月份选择器弹窗
    if (this.data.showMonthPicker) {
      this.setData({ showMonthPicker: false });
    }
    // 关闭年份选择器弹窗
    if (this.data.showYearPicker) {
      this.setData({ showYearPicker: false });
    }
    
    // 如果正在自动播放，停止它（避免后台消耗资源）
    if (this.data.autoPlayTimer) {
      this.stopAutoPlay();
    }
    // 清理显示提示的定时器
    if (this._showTimer) {
      clearTimeout(this._showTimer);
      this._showTimer = null;
    }
  },
  
  // 页面卸载时触发（销毁前清理资源）
  onUnload() {
    // 控制台输出页面卸载
    console.log('主页卸载，清理资源');
    // 清除延迟绘制定时器
    if (this.data.drawTimer) {
      clearTimeout(this.data.drawTimer);
      this.setData({ drawTimer: null });
    }
  
    // 关闭月份选择器弹窗
    if (this.data.showMonthPicker) {
      this.setData({ showMonthPicker: false });
    }
    // 关闭年份选择器弹窗
    if (this.data.showYearPicker) {
      this.setData({ showYearPicker: false });
    }
    // 清理所有定时器
    if (this.data.autoPlayTimer) {
      this.stopAutoPlay();
    }
    if (this._showTimer) {
      clearTimeout(this._showTimer);
      this._showTimer = null;
    }
  },
  
  // 等待年份选择器加载完成后绘制统计图（因为canvas需要DOM就绪）
  waitForYearSelectorAndDraw() {
    // 最大重试次数
    const maxRetries = 20;
    // 重试间隔（毫秒）
    const retryDelay = 100;
    // 当前重试次数
    let retryCount = 0;
    
    // 检查年份选择器容器是否存在
    const checkYearSelector = () => {
      // 创建选择器查询
      const query = wx.createSelectorQuery();
      // 选择 .year-selector-container 容器并获取其边界信息
      query.select('.year-selector-container').boundingClientRect().exec((res) => {
        // 如果查询结果存在且第一个元素存在
        if (res && res[0]) {
          // 控制台输出年份选择器已加载
          console.log('年份选择器已加载，开始绘制统计图');
          // 年份选择器已加载，更新月度数据并绘制图表
          this.updateMonthlyData(this.data.currentYear);
          // 标记图表已绘制
          this.setData({ chartDrawn: true });
        } else {
          // 年份选择器未加载，重试
          if (retryCount < maxRetries) {
            // 增加重试次数
            retryCount++;
            // 控制台输出重试信息
            console.log(`年份选择器未准备好，第${retryCount}次重试...`);
            // 延迟后再次检查
            setTimeout(checkYearSelector, retryDelay);
          } else {
            // 超过最大重试次数，直接绘制
            console.warn('年份选择器多次重试后仍未准备好，直接绘制统计图');
            this.updateMonthlyData(this.data.currentYear);
            this.setData({ chartDrawn: true });
          }
        }
      });
    };
    
    // 开始检查
    checkYearSelector();
  },

  // 切换年份（选项卡点击）【注意：此方法可能在wxml中被调用，但实际代码中switchYear未使用，保留以备后用】
  switchYear(e) {
    // 从事件目标中获取年份并转为数字
    const year = Number(e.currentTarget.dataset.year);
    // 如果年份无效或与当前年份相同，直接返回
    if (!year || year === this.data.currentYear) return;
    
    // 控制台输出切换年份
    console.log('切换年份:', year);
    // 更新当前年份
    this.setData({ currentYear: year });
    // 加载该年份、当前月份的图片
    this.loadImage(year, this.data.currentMonth);
    // 更新月度数据（图表）
    this.updateMonthlyData(year);
  },

  // 切换月份（选项卡点击）【注意：此方法可能在wxml中被调用，但实际代码中switchMonth未使用，保留以备后用】
  switchMonth(e) {
    // 从事件目标中获取月份并转为数字
    const month = Number(e.currentTarget.dataset.month);
    // 如果月份无效或与当前月份相同，直接返回
    if (!month || month === this.data.currentMonth) return;
    
    // 控制台输出切换月份
    console.log('切换月份:', month);
    // 更新当前月份
    this.setData({ currentMonth: month });
    // 加载当前年份、该月份的图片
    this.loadImage(this.data.currentYear, month);
  },

  // 年份滑动条变化（滑块改变时触发）
  onYearSliderChange(e) {
    // 获取滑动条的值（年份）
    const year = e.detail.value;
    // 更新当前年份
    this.setData({ currentYear: year });
    // 加载该年份、当前月份的图片
    this.loadImage(year, this.data.currentMonth);
    // 切换年份时更新图表
    this.updateMonthlyData(year);
  },

  // 年份滑动条滑动中（实时预览）
  onYearSliderChanging(e) {
    // 获取滑动条的值并四舍五入为整数
    const year = Math.round(e.detail.value);
    // 如果年份与当前年份不同
    if (year !== this.data.currentYear) {
      // 更新当前年份
      this.setData({ currentYear: year });
      // 实时预览年份，更新图表
      this.updateMonthlyData(year);
      // 如果该年份已预加载，则切换到该年份的图片（当前月份）
      if (this.data.preloadedYears.includes(year)) {
        this.switchToImage(year, this.data.currentMonth);
      }
    }
  },

  // 加载指定年份和月份的图片
  loadImage(year = this.data.currentYear, month = this.data.currentMonth) {
    // 设置图片未加载、未失败状态
    this.setData({ imageError: false, imageLoaded: false });
    
    // 检查年份是否超出数据范围（2012-2022）且没有上传图片
    const hasUploadedImage = this.data.imageMap[year] && this.data.imageMap[year][month];
    if ((year < 2012 || year > 2022) && !hasUploadedImage) {
      this.useLocalPlaceholder();
      return;
    }
    
    // 检测图片路径（优先使用上传图片）
    const imagePath = this.detectImagePath(year, month);
    
    // 检查是否是云存储路径（cloud://开头）
    if (imagePath && imagePath.startsWith('cloud://')) {
      // 如果是云路径，获取临时URL
      this.getCloudImageTempUrl(imagePath, year, month);
    } else {
      // 本地路径（包括本地缓存文件），直接设置到非活跃图层
      this._setNextLayerImage(imagePath);
    }
    
    // 异步预缓存接下来5张图片（实现无缝切换）
    setTimeout(() => {
      this.preCacheNextImages(year, month);
    }, 100);
  },
  
  // 设置下一图层的图片URL（核心：交叉淡入逻辑）
  _setNextLayerImage(imageUrl) {
    const activeLayer = this.data.activeLayer;
    if (!activeLayer) {
      // 首次加载：放到A层，加载完成后直接显示
      this.setData({
        imageLayerA: imageUrl,
        opacityA: 0,
        layerALoaded: false,
        currentImageUrl: imageUrl
      });
    } else if (activeLayer === 'A') {
      // 当前A层显示，下一张放到B层
      this.setData({
        imageLayerB: imageUrl,
        opacityB: 0,          // B层先不可见
        layerBLoaded: false,
        currentImageUrl: imageUrl
      });
    } else {
      // 当前B层显示，下一张放到A层
      this.setData({
        imageLayerA: imageUrl,
        opacityA: 0,          // A层先不可见
        layerALoaded: false,
        currentImageUrl: imageUrl
      });
    }
  },
  
  // 交叉淡入：淡入新图层，淡出旧图层
  _crossFadeToNextLayer() {
    const activeLayer = this.data.activeLayer;
    if (activeLayer === 'A') {
      // 切换到B层
      this.setData({
        opacityA: 0,   // 淡出A
        opacityB: 1,   // 淡入B
        activeLayer: 'B',
        imageLoaded: true
      });
    } else {
      // 切换到A层
      this.setData({
        opacityB: 0,   // 淡出B
        opacityA: 1,   // 淡入A
        activeLayer: 'A',
        imageLoaded: true
      });
    }
  },
  
  // 获取云存储图片的临时URL
// 在Page的data中添加缓存对象


// 修改getCloudImageTempUrl方法，增加缓存逻辑
getCloudImageTempUrl(cloudPath, year, month) {
  const now = Date.now();
  const cache = this.data.cloudTempUrlCache[cloudPath];
  if (cache && cache.expireTime && cache.expireTime > now + 30000) {
    // 缓存命中：直接设置新图URL到非活跃图层
    this._setNextLayerImage(cache.url);
    this.setData({ imageScale: 1.0, scalePercent: 100 });
    
    // 即使临时URL缓存有效，也异步检查是否需要下载缓存（如果本地缓存不存在）
    const cachedFilePath = this.getCachedFilePath(year, month);
    if (!cachedFilePath) {
      // 异步下载并缓存
      this.downloadAndCacheImage(cache.url, year, month).catch(err => {
        console.log('异步缓存失败:', err);
      });
    }
    
    // 预缓存接下来5张图片
    setTimeout(() => {
      this.preCacheNextImages(year, month);
    }, 300);
    return;
  }
  // 无缓存或过期：不闪占位图，保持旧图，等新URL获取后替换
  wx.cloud.getTempFileURL({
    fileList: [{ fileID: cloudPath, maxAge: 3600 }],
    success: res => {
      if (res.fileList?.[0]?.tempFileURL) {
        const tempUrl = res.fileList[0].tempFileURL;
        const expireTime = now + (3600 - 60) * 1000;
        const newCache = { ...this.data.cloudTempUrlCache, [cloudPath]: { url: tempUrl, expireTime } };
        this.setData({ cloudTempUrlCache: newCache });
        this._setNextLayerImage(tempUrl);
        
        // 异步下载并缓存图片到本地
        this.downloadAndCacheImage(tempUrl, year, month).catch(err => {
          console.log('下载缓存失败:', err);
        });
        
        // 预缓存接下来5张图片
        setTimeout(() => {
          this.preCacheNextImages(year, month);
        }, 500);
      } else this.fallbackToLocalImage(year, month);
    },
    fail: () => this.fallbackToLocalImage(year, month)
  });
},

// 新增：预加载所有云端图片（获取临时URL并缓存）
// 在onLoad中调用预加载（在initImageMap之后）
onLoad() {
  // ... 原有代码
  this.initImageMap();
  // 预加载云端图片（异步，不阻塞页面）
  this.preloadAllCloudImages();
  // ... 其他原有代码
},

// 同时，当管理员上传新图片时，也应触发预加载（可选）
addImageToMap(year, month, imagePath) {
  // ... 原有代码
  // 如果新图片是云存储路径，立即预加载它
  if (imagePath && imagePath.startsWith('cloud://')) {
    this.getCloudImageTempUrl(imagePath, year, month); // 会触发缓存
  }
},

  // ============================================
  // 本地文件缓存系统
  // ============================================
  
  // 生成缓存键
  getCacheKey(year, month) {
    return `cloud_image_${year}_${month}`;
  },
  
  // 检查本地文件缓存
  getCachedFilePath(year, month) {
    const cacheKey = this.getCacheKey(year, month);
    const cache = this.data.localFileCache[cacheKey];
    
    if (!cache || !cache.filePath) {
      return null;
    }
    
    // 检查文件是否存在
    try {
      // 尝试访问文件信息（小程序中可以直接检查文件是否存在）
      const fs = wx.getFileSystemManager();
      try {
        fs.accessSync(cache.filePath);
        // 更新最后访问时间
        this.updateCacheAccessTime(cacheKey);
        return cache.filePath;
      } catch (err) {
        // 文件不存在，清除缓存
        this.clearCacheEntry(cacheKey);
        return null;
      }
    } catch (err) {
      console.error('检查缓存文件失败:', err);
      return null;
    }
  },
  
  // 更新缓存访问时间
  updateCacheAccessTime(cacheKey) {
    const cache = this.data.localFileCache[cacheKey];
    if (cache) {
      const newCache = { ...this.data.localFileCache };
      newCache[cacheKey] = {
        ...cache,
        lastAccessTime: Date.now()
      };
      this.setData({ localFileCache: newCache });
    }
  },
  
  // 清除缓存条目
  clearCacheEntry(cacheKey) {
    const newCache = { ...this.data.localFileCache };
    delete newCache[cacheKey];
    this.setData({ localFileCache: newCache });
  },
  
  // 下载并缓存图片
  downloadAndCacheImage(tempUrl, year, month) {
    const cacheKey = this.getCacheKey(year, month);
    
    // 如果已经存在缓存，跳过下载
    if (this.getCachedFilePath(year, month)) {
      //console.log(`图片 ${year}年${month}月 已缓存，跳过下载`);
      return Promise.resolve();
    }
    
    //console.log(`开始下载并缓存图片: ${year}年${month}月`);
    
    return new Promise((resolve, reject) => {
      // 下载文件
      wx.downloadFile({
        url: tempUrl,
        success: (res) => {
          if (res.statusCode === 200) {
            // 保存文件到本地
            const fs = wx.getFileSystemManager();
            const tempFilePath = res.tempFilePath;
            const savedFilePath = `${wx.env.USER_DATA_PATH}/${cacheKey}.png`;
            
            try {
              fs.saveFileSync(tempFilePath, savedFilePath);
              
              // 更新缓存记录
              const newCache = { ...this.data.localFileCache };
              newCache[cacheKey] = {
                filePath: savedFilePath,
                lastAccessTime: Date.now(),
                size: res.totalBytes || 0,
                sourceUrl: tempUrl
              };
              this.setData({ localFileCache: newCache });
              
              //console.log(`图片缓存成功: ${year}年${month}月, 路径: ${savedFilePath}`);
              resolve(savedFilePath);
            } catch (saveErr) {
              console.error('保存文件失败:', saveErr);
              reject(saveErr);
            }
          } else {
            console.error(`下载失败，状态码: ${res.statusCode}`);
            reject(new Error(`下载失败: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          console.error('下载文件失败:', err);
          reject(err);
        }
      });
    });
  },
  
  //   },

  // 预缓存接下来5张图片（实现无缝切换）
  preCacheNextImages(currentYear, currentMonth) {
    //console.log(`开始预缓存接下来5张图片，从 ${currentYear}年${currentMonth}月开始`);
    
    const maxYear = this.data.maxYear;
    const imageMap = this.data.imageMap;
    const preCacheCount = 5;
    let year = currentYear;
    let month = currentMonth;
    
    // 收集接下来5张有效图片的信息
    const imagesToPreCache = [];
    let count = 0;
    let iterations = 0;
    const maxIterations = 20; // 安全限制，最多查找20张图片
    
    while (count < preCacheCount && iterations < maxIterations) {
      iterations++;
      
      // 计算下一张图片的年份月份
      if (month < 12) {
        month++;
      } else {
        month = 1;
        if (year < maxYear) {
          year++;
        } else {
          // 已经达到最大年份，停止预缓存
          break;
        }
      }
      
      // 检查这张图片是否需要预缓存
      // 1. 首先检查是否已经有本地缓存
      const cachedFilePath = this.getCachedFilePath(year, month);
      if (cachedFilePath) {
        //console.log(`图片 ${year}年${month}月 已有缓存，跳过`);
        continue;
      }
      
      // 2. 检查是否有图片（在imageMap中或数据范围内）
      const hasUploadedImage = imageMap[year] && imageMap[year][month];
      const inDataRange = year >= 2012 && year <= 2022;
      
      if (!hasUploadedImage && !inDataRange) {
        // 没有上传图片且不在数据范围内，跳过这张图片
        continue;
      }
      
      // 获取图片路径
      const imagePath = this.detectImagePath(year, month);
      
      // 判断是否为云存储图片
      let cloudPath = null;
      if (hasUploadedImage && imageMap[year][month] && imageMap[year][month].startsWith('cloud://')) {
        // 从imageMap中获取原始云存储路径
        cloudPath = imageMap[year][month];
      }
      
      if (cloudPath) {
        // 云存储图片，需要获取临时URL并下载缓存
        imagesToPreCache.push({
          year,
          month,
          cloudPath: cloudPath,
          type: 'cloud'
        });
        count++;
        //console.log(`计划预缓存云存储图片: ${year}年${month}月`);
      } else if (imagePath && !imagePath.includes('nep201201.png') && !imagePath.startsWith('http')) {
        // 本地图片（非默认占位图，非HTTP URL），如果已经在本地就不需要缓存
        // 这里主要处理/pages/index/images/下的图片，这些图片已经存在
        //console.log(`图片 ${year}年${month}月 是本地图片，无需额外缓存`);
      }
    }
    
    if (imagesToPreCache.length === 0) {
      //console.log('没有需要预缓存的云存储图片');
      return;
    }
    
    //console.log(`需要预缓存 ${imagesToPreCache.length} 张云存储图片`);
    
    // 异步预缓存这些图片（不阻塞当前图片加载）
    setTimeout(() => {
      this._preCacheCloudImages(imagesToPreCache);
    }, 500); // 延迟500ms开始，确保当前图片加载优先
  },

  // 实际预缓存云存储图片的内部方法
  _preCacheCloudImages(imagesToPreCache) {
    if (!imagesToPreCache || imagesToPreCache.length === 0) {
      return;
    }
    
    const batchSize = 2; // 小批量处理，避免影响性能
    const processBatch = (batchIndex) => {
      if (batchIndex >= imagesToPreCache.length) {
        console.log('预缓存完成');
        return;
      }
      
      const endIndex = Math.min(batchIndex + batchSize, imagesToPreCache.length);
      const batch = imagesToPreCache.slice(batchIndex, endIndex);
      
      const promises = batch.map(item => {
        return new Promise((resolve) => {
          // 获取临时URL
          wx.cloud.getTempFileURL({
            fileList: [{ fileID: item.cloudPath, maxAge: 3600 }],
            success: (res) => {
              if (res.fileList?.[0]?.tempFileURL) {
                // 下载并缓存
                this.downloadAndCacheImage(res.fileList[0].tempFileURL, item.year, item.month)
                  .then(() => {
                    //console.log(`预缓存成功: ${item.year}年${item.month}月`);
                    resolve();
                  })
                  .catch((err) => {
                    //console.log(`预缓存失败: ${item.year}年${item.month}月`, err);
                    resolve(); // 即使失败也继续
                  });
              } else {
                resolve();
              }
            },
            fail: () => resolve() // 即使失败也继续
          });
        });
      });
      
      Promise.all(promises).then(() => {
        // 处理下一批
        setTimeout(() => {
          processBatch(endIndex);
        }, 300); // 批次间延迟
      });
    };
    
    processBatch(0);
  },

  // 预下载并缓存所有云端图片（优化版本）
  preDownloadAndCacheAllCloudImages() {
    const imageMap = this.data.imageMap;
    const cloudPaths = [];
    
    for (const year in imageMap) {
      for (const month in imageMap[year]) {
        const path = imageMap[year][month];
        if (path && path.startsWith('cloud://')) {
          cloudPaths.push({ year: parseInt(year), month: parseInt(month), cloudPath: path });
        }
      }
    }
    
    if (cloudPaths.length === 0) {
      console.log('没有需要缓存的云端图片');
      this.setData({ allCloudFilesCached: true });
      this.checkAllImagesPreloaded();
      return Promise.resolve();
    }
    
    console.log(`开始预缓存 ${cloudPaths.length} 张云端图片`);
    
    const batchSize = 6;
    const batches = [];
    for (let i = 0; i < cloudPaths.length; i += batchSize) {
      batches.push(cloudPaths.slice(i, i + batchSize));
    }
    
    let completed = 0;
    
    const processBatch = (batchIndex) => {
      if (batchIndex >= batches.length) {
        console.log('🎉 所有云端图片预缓存完成');
        // ===== 关键修改：全部缓存完成后设置标志并检查 =====
        this.setData({ allCloudFilesCached: true });
        this.checkAllImagesPreloaded();
        return Promise.resolve();
      }
      
      const batch = batches[batchIndex];
      console.log(`处理批次 ${batchIndex + 1}/${batches.length}, 大小: ${batch.length}`);
      
      const promises = batch.map(item => {
        return new Promise((resolve) => {
          wx.cloud.getTempFileURL({
            fileList: [{ fileID: item.cloudPath, maxAge: 3600 }],
            success: (res) => {
              if (res.fileList?.[0]?.tempFileURL) {
                this.downloadAndCacheImage(res.fileList[0].tempFileURL, item.year, item.month)
                  .then(() => {
                    completed++;
                    console.log(`缓存进度: ${completed}/${cloudPaths.length}`);
                    resolve();
                  })
                  .catch(() => resolve());
              } else {
                resolve();
              }
            },
            fail: () => resolve()
          });
        });
      });
      
      return Promise.all(promises).then(() => {
        return processBatch(batchIndex + 1);
      });
    };
    
    return processBatch(0);
  },
  // 回退到本地图片（当云存储图片获取失败时）
  fallbackToLocalImage(year, month) {
    console.log('云图片加载失败，直接使用默认占位图');
    // 设置占位图到非活跃图层并直接淡入
    this._setNextLayerImage('/images/nep201201.png');
    this._crossFadeToNextLayer();
  },

  // 保持向后兼容的方法（只传年份）
  loadImageForYear(year) {
    // 调用完整加载方法，月份使用当前月份
    this.loadImage(year, this.data.currentMonth);
  },



  // 图层A图片加载成功回调
  onLayerALoad(e) {
    const info = e.detail || { width: 800, height: 600 };
    const ratio = info.height && info.width ? ((info.height / info.width) * 100).toFixed(1) + '%' : '未知';
    this.setData({
      layerALoaded: true,
      imageError: false,
      imageInfo: { width: info.width || 800, height: info.height || 600, ratio: ratio }
    });
    const activeLayer = this.data.activeLayer;
    if (!activeLayer) {
      // 首次加载：直接淡入A层
      this.setData({ opacityA: 1, activeLayer: 'A', imageLoaded: true });
      this._onImageReady();
    } else if (activeLayer === 'B') {
      // A层是下一个要显示的图层，执行交叉淡入
      this._crossFadeToNextLayer();
      this._onImageReady();
    }
    // 如果activeLayer === 'A'，说明A层已经是活跃层，这次load是刷新，不需要操作
  },

  // 图层B图片加载成功回调
  onLayerBLoad(e) {
    const info = e.detail || { width: 800, height: 600 };
    const ratio = info.height && info.width ? ((info.height / info.width) * 100).toFixed(1) + '%' : '未知';
    this.setData({
      layerBLoaded: true,
      imageError: false,
      imageInfo: { width: info.width || 800, height: info.height || 600, ratio: ratio }
    });
    const activeLayer = this.data.activeLayer;
    if (activeLayer === 'A') {
      // B层是下一个要显示的图层，执行交叉淡入
      this._crossFadeToNextLayer();
      this._onImageReady();
    }
    // 如果activeLayer === 'B'，说明B层已经是活跃层，这次load是刷新，不需要操作
  },

  // 图层A图片加载失败回调
  onLayerAError(e) {
    console.error('❌ 图层A影像加载失败', e.detail);
    this.setData({ layerALoaded: false });
    this._onImageError();
  },

  // 图层B图片加载失败回调
  onLayerBError(e) {
    console.error('❌ 图层B影像加载失败', e.detail);
    this.setData({ layerBLoaded: false });
    this._onImageError();
  },

  // 图片就绪后的统一处理（替代原onImageLoad的后半段）
  _onImageReady() {
    // 自动播放处理：如果正在自动播放且等待图片加载，则继续下一步
    if (this.data.autoPlay && this.data.waitingForImageLoad) {
      console.log('自动播放：当前图片加载完成，保持展示后播放下一张');
      
      // 图片已就绪，现在同步更新年份/月份UI和图表
      if (this._pendingYear !== undefined && this._pendingMonth !== undefined) {
        this.setData({
          currentYear: this._pendingYear,
          currentMonth: this._pendingMonth
        });
        this.updateMonthlyData(this._pendingYear);
        this._pendingYear = undefined;
        this._pendingMonth = undefined;
      }
      
      // 清除之前的定时器
      if (this._autoPlayWaitTimer) {
        clearTimeout(this._autoPlayWaitTimer);
        this._autoPlayWaitTimer = null;
      }
      
      // 保持展示 autoPlayDisplayTime 毫秒后切换到下一张
      this._autoPlayWaitTimer = setTimeout(() => {
        this._autoPlayNextWithWait();
      }, this.data.autoPlayDisplayTime);
    }
  },

  // 图片加载失败的统一处理
  _onImageError() {
    // 自动播放处理
    if (this.data.autoPlay && this.data.waitingForImageLoad) {
      console.log('自动播放：当前图片加载失败，直接继续下一张');
      this.setData({ imageLoaded: true, imageError: true });
      
      // 即使失败，也同步更新年份/月份UI（与成功时保持一致）
      if (this._pendingYear !== undefined && this._pendingMonth !== undefined) {
        this.setData({
          currentYear: this._pendingYear,
          currentMonth: this._pendingMonth
        });
        this.updateMonthlyData(this._pendingYear);
        this._pendingYear = undefined;
        this._pendingMonth = undefined;
      }
      
      if (this._autoPlayWaitTimer) {
        clearTimeout(this._autoPlayWaitTimer);
        this._autoPlayWaitTimer = null;
      }
      
      // 失败/占位图使用最短展示时间，避免占位图停留过长
      this._autoPlayWaitTimer = setTimeout(() => {
        this._autoPlayNextWithWait();
      }, this.data.placeholderMinDisplayTime);
      return;
    }
    
    // 非自动播放时的错误处理
    const { currentYear, currentMonth, imageMap } = this.data;
    const isUploadedImage = imageMap[currentYear] && imageMap[currentYear][currentMonth];
    
    if (isUploadedImage) {
      const uploadedPath = imageMap[currentYear][currentMonth];
      if (uploadedPath && uploadedPath.startsWith('cloud://')) {
        console.log('云存储图片临时URL加载失败，尝试重新获取临时URL');
        if (this.data.autoPlay) {
          this.fallbackToLocalImage(currentYear, currentMonth);
          return;
        }
        const newCache = { ...this.data.cloudTempUrlCache };
        delete newCache[uploadedPath];
        this.setData({ cloudTempUrlCache: newCache });
        this.getCloudImageTempUrl(uploadedPath, currentYear, currentMonth);
      } else {
        this.fallbackToLocalImage(currentYear, currentMonth);
      }
    } else {
      if (currentYear < 2012 || currentYear > 2022) {
        const rangeText = currentYear < 2012 ? '早于' : '晚于';
        wx.showToast({
          title: `${currentYear}年数据${currentYear < 2012 ? '不可用' : '尚未收录'}`,
          icon: 'none',
          duration: 2000
        });
        this.useLocalPlaceholder();
        return;
      }
      this.useLocalPlaceholder();
    }
  },

  // 自动播放下一张（等待图片加载完成版本）
  _autoPlayNextWithWait() {
    // 如果自动播放已停止，不再继续
    if (!this.data.autoPlay) {
      console.log('自动播放已停止，不再继续下一张');
      return;
    }
    
    // 获取当前年份、月份、最大年份
    let { currentYear, currentMonth, maxYear } = this.data;
    
    // 先尝试增加月份
    if (currentMonth < 12) {
      currentMonth++;
    } else {
      // 月份到12月，增加到下一年1月
      currentMonth = 1;
      if (currentYear < maxYear) {
        currentYear++;
      } else {
        // 已经到最大年份的12月，停止播放
        this.stopAutoPlay();
        // 显示提示
        wx.showToast({
          title: '已播放到最后一张',
          icon: 'none'
        });
        return;
      }
    }
    
    // 控制台输出播放下一张的信息
    console.log('自动播放下一张（等待加载）:', currentYear, '年', currentMonth, '月');
    
    // 记住目标年份月份，但不立即更新UI（等图片加载完成后再同步）
    this._pendingYear = currentYear;
    this._pendingMonth = currentMonth;
    
    this.setData({
      waitingForImageLoad: true
    });
    
    // 只加载新图片，不更新currentYear/currentMonth（等图片就绪后再同步）
    this.loadImage(currentYear, currentMonth);
  },

  // 使用本地占位图（当图片不存在时）
  useLocalPlaceholder() {
    // 获取当前年份和图片映射表
    const { currentYear, imageMap, currentMonth } = this.data;
    
    // 检查是否是上传的图片（在imageMap中）
    const isUploadedImage = imageMap[currentYear] && imageMap[currentYear][currentMonth];
    
    // 如果是上传的图片，保持当前路径但显示错误状态
    if (isUploadedImage) {
      console.log('上传的图片加载失败，保持当前路径但显示错误状态');
      this.setData({
        imageLoaded: false,
        imageError: true,
        imageInfo: { width: 800, height: 600, ratio: '75%' }
      });
      return;
    }
    
    // 检查年份是否超出数据范围（2012-2022）且不是上传图片
    if (currentYear < 2012 || currentYear > 2022) {
      // 年份超出数据范围，直接使用默认占位图
      console.log(`年份 ${currentYear} 超出数据范围（2012-2022），使用默认占位图`);
      const defaultPlaceholderUrl = '/images/nep201201.png';
      this._setNextLayerImage(defaultPlaceholderUrl);
      this._crossFadeToNextLayer();
      this.setData({ imageError: true, imageInfo: { width: 800, height: 600, ratio: '75%' } });
      this.updateMonthlyData(2012);
      return;
    }
    
    // 尝试使用当前年份1月的本地图片作为占位图
    const yearFirstMonthPath = `/images/nep${currentYear}01.png`;
    const defaultPlaceholderUrl = '/images/nep201201.png';
    
    // 先检查当前年份1月图片是否存在
    wx.getImageInfo({
      src: yearFirstMonthPath,
      success: () => {
        console.log('使用当前年份1月图片作为占位图:', yearFirstMonthPath);
        this._setNextLayerImage(yearFirstMonthPath);
        this._crossFadeToNextLayer();
        this.setData({ imageError: true, imageInfo: { width: 800, height: 600, ratio: '75%' } });
        this.updateMonthlyData(currentYear);
      },
      fail: () => {
        console.log('使用默认占位图:', defaultPlaceholderUrl);
        this._setNextLayerImage(defaultPlaceholderUrl);
        this._crossFadeToNextLayer();
        this.setData({ imageError: true, imageInfo: { width: 800, height: 600, ratio: '75%' } });
        this.updateMonthlyData(2012);
      }
    });
  },

  // 从真实月度数据中筛选当前年份的数据，并触发图表绘制
  updateMonthlyData(year) {
    // 如果年份与上次绘制的年份相同，跳过绘制（避免重复绘制）
    if (this.data.lastDrawnYear === year) {
      console.log(`年份 ${year} 图表已绘制，跳过重复绘制`);
      return;
    }
    
    // 过滤出当前年份的数据
    const yearData = this.data.monthlyRealData.filter(item => item.year === year);
    // 按月份排序
    yearData.sort((a, b) => a.month - b.month);
    // 更新当前年份的月度数据
    this.setData({ 
      currentMonthlyData: yearData,
      lastDrawnYear: year  // 记录本次绘制的年份
    });
    
    // 确保图表容器已准备好再绘制（带重试机制）
    this.drawChartWithRetry(year, yearData);
  },
  
  // 带重试的图表绘制（等待canvas节点就绪）
  drawChartWithRetry(year, data, retryCount = 0) {
    // 最大重试次数
    const maxRetries = 10;
    // 重试间隔（毫秒）
    const retryDelay = 100;
    
    // 检查图表容器是否存在
    const query = wx.createSelectorQuery();
    // 选择 id 为 monthlyChart 的 canvas 节点，获取节点和尺寸信息
    query.select('#monthlyChart').fields({ node: true, size: true }).exec((res) => {
      // 如果查询结果不存在或节点不存在
      if (!res || !res[0] || !res[0].node) {
        // 容器未准备好，重试
        if (retryCount < maxRetries) {
          // 控制台输出重试信息
          console.log(`图表容器未准备好，第${retryCount + 1}次重试...`);
          // 延迟后再次调用自身
          setTimeout(() => {
            this.drawChartWithRetry(year, data, retryCount + 1);
          }, retryDelay);
        } else {
          // 超过最大重试次数，使用降级方法
          console.warn('图表容器多次重试后仍未准备好，使用降级方法');
          this.drawChartLegacy(year, data);
        }
        return;
      }
      
      // 容器已准备好，使用新版绘图方法
      this.drawChart(year, data);
    });
  },

  // 根据数值获取柱状图颜色（用于图表）
  getColorForValue(value) {
    // 处理负值：使用冷色系
    if (value < -1500) return '#283593'; // 深靛蓝
    if (value < -1000) return '#4527a0'; // 深紫色
    if (value < -500) return '#5e35b1';  // 紫色
    if (value < -200) return '#7e57c2';  // 中紫色
    if (value < -100) return '#9575cd';  // 浅紫色
    if (value < 0) return '#b39ddb';     // 淡紫色
    
    // 处理正值：使用暖色系
    if (value > 3000) return '#004d40';  // 深青色
    if (value > 2000) return '#00695c';  // 青色
    if (value > 1500) return '#2e7d32';  // 深绿色
    if (value > 1000) return '#43a047';  // 绿色
    if (value > 500) return '#66bb6a';   // 浅绿色
    if (value > 200) return '#a5d6a7';   // 淡绿色
    if (value > 100) return '#fff59d';   // 淡黄色
    
    // 0到100之间的值：温和的橙色
    return '#ffcc80';
  },

  // 判断颜色是否为深色（用于文字颜色反白）
  isDarkColor(color) {
    // 将十六进制颜色转换为RGB
    let r, g, b;
    if (color.startsWith('#')) {
      // 获取十六进制部分
      const hex = color.slice(1);
      if (hex.length === 3) {
        // 短格式 #RGB 转为长格式
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        // 长格式 #RRGGBB
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else {
        // 无效格式，默认视为深色
        return true;
      }
      // 计算亮度（YIQ公式）
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      // 亮度小于128视为深色
      return brightness < 128;
    }
    // 非十六进制颜色，默认视为深色
    return true;
  },

  // 高分辨率绘图方法（支持负值、高清文字）
  drawChart(year, data) {
    // 如果没有数据，直接返回
    if (!data || data.length === 0) return;
    
    // 创建选择器查询
    const query = wx.createSelectorQuery();
    // 选择 canvas 节点，获取节点和尺寸
    query.select('#monthlyChart').fields({ node: true, size: true }).exec((res) => {
      // 如果查询结果无效或节点不存在
      if (!res || !res[0] || !res[0].node) {
        // 降级到旧方法
        this.drawChartLegacy(year, data);
        return;
      }
      
      // 获取 canvas 节点
      const canvas = res[0].node;
      // 获取 2D 上下文
      const ctx = canvas.getContext('2d');
      // 获取设备像素比，用于高清绘制
      const dpr = wx.getWindowInfo().pixelRatio || 1;
      
      // 获取Canvas的显示尺寸（逻辑尺寸）
      const width = res[0].width || canvas.width;
      const height = res[0].height || canvas.height;
      
      // 设置Canvas实际像素尺寸（考虑dpr，保证清晰）
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      // 缩放上下文以匹配实际像素
      ctx.scale(dpr, dpr);
      
      // 使用逻辑尺寸进行绘制
      const canvasWidth = width;
      const canvasHeight = height;
      
      // 清除Canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // 绘制背景
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 定义边距（为Y轴标签留更多空间）
      const margin = {
        left: canvasWidth * 0.12,
        right: canvasWidth * 0.04,
        top: canvasHeight * 0.08,
        bottom: canvasHeight * 0.08
      };
      // 图表区域的宽度
      const chartWidth = canvasWidth - margin.left - margin.right;
      // 图表区域的高度
      const chartHeight = canvasHeight - margin.top - margin.bottom;
      // 每个柱子的间距
      const spacing = chartWidth / data.length;
      // 柱子的宽度
      const barWidth = spacing * 0.7;

      // 标题
      ctx.font = `bold ${canvasHeight * 0.05}px sans-serif`;
      ctx.fillStyle = '#333';
      ctx.fillText(`${year}年 月度碳汇`, margin.left, margin.top - canvasHeight * 0.01);
      ctx.font = `${canvasHeight * 0.04}px sans-serif`;
      ctx.fillStyle = '#666';
      ctx.fillText('单位: 吨', margin.left + chartWidth - 70, margin.top - canvasHeight * 0.01);

      // 计算最小值和最大值
      const values = data.map(d => d.value);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      
      // 确定Y轴范围，为负值和正值留出空间
      let yMin, yMax;
      if (minValue < 0 && maxValue > 0) {
        // 既有负值又有正值，以零为中心扩展
        const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));
        yMin = -absMax * 1.2;
        yMax = absMax * 1.2;
      } else if (minValue < 0) {
        // 只有负值
        yMin = minValue * 1.2;
        yMax = Math.abs(minValue) * 0.2; // 留出一些正空间
      } else {
        // 只有正值
        yMin = 0;
        yMax = maxValue * 1.1;
      }
      
      // Y轴数值范围
      const yRange = yMax - yMin;

      // 绘制基线（零线或X轴）
      let baselineY = margin.top + chartHeight; // 默认在底部（只有正值）
      if (minValue < 0) {
        // 有负值，基线在零值位置
        baselineY = margin.top + chartHeight * (1 - (-yMin) / yRange);
      } else if (maxValue <= 0) {
        // 只有负值，基线在顶部
        baselineY = margin.top;
      }
      
      // 设置线条样式并绘制基线
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin.left, baselineY);
      ctx.lineTo(margin.left + chartWidth, baselineY);
      ctx.stroke();

      // 绘制坐标轴
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1.5;
      // 绘制X轴（底部水平线）
      ctx.beginPath();
      ctx.moveTo(margin.left, margin.top + chartHeight);
      ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
      ctx.stroke();
      // 绘制Y轴（左侧垂直线）
      ctx.beginPath();
      ctx.moveTo(margin.left, margin.top);
      ctx.lineTo(margin.left, margin.top + chartHeight);
      ctx.stroke();

      // 绘制柱状图
      // 计算基线位置（与上面绘制的基线一致）
      let zeroY = margin.top + chartHeight; // 默认在底部（只有正值）
      if (minValue < 0) {
        zeroY = margin.top + chartHeight * (1 - (-yMin) / yRange);
      } else if (maxValue <= 0) {
        zeroY = margin.top;
      }
      
      // 计算正负值各自的范围和高度比例
      const positiveHeight = Math.max(0, zeroY - margin.top); // 零线以上的高度
      const negativeHeight = Math.max(0, margin.top + chartHeight - zeroY); // 零线以下的高度
      const positiveRange = Math.max(yMax, 1); // 正值范围，避免除零
      const negativeRange = Math.max(Math.abs(yMin), 1); // 负值范围（绝对值），避免除零
      
      // 遍历每个数据点绘制柱子
      data.forEach((item, index) => {
        // 计算柱子左上角x坐标
        const x = margin.left + index * spacing + (spacing - barWidth) / 2;
        let barHeight, y;
        
        if (item.value >= 0) {
          // 正值：从零线向上
          barHeight = (item.value / positiveRange) * positiveHeight;
          y = zeroY - barHeight;
          // 确保柱子不会超出顶部
          if (y < margin.top) {
            barHeight = zeroY - margin.top;
            y = margin.top;
          }
        } else {
          // 负值：从零线向下
          barHeight = (Math.abs(item.value) / negativeRange) * negativeHeight;
          y = zeroY;
          // 确保柱子不会超出底部
          if (y + barHeight > margin.top + chartHeight) {
            barHeight = margin.top + chartHeight - zeroY;
          }
        }
        
        // 获取柱子颜色
        const barColor = this.getColorForValue(item.value);
        ctx.fillStyle = barColor;
        // 绘制矩形柱子
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // 月份标签
        ctx.font = `${canvasHeight * 0.04}px sans-serif`;
        ctx.fillStyle = '#333';
        ctx.fillText(item.month + '月', x, margin.top + chartHeight + canvasHeight * 0.045);
        
        // 数值标签（根据柱子颜色选择文字颜色）
        const text = item.value.toFixed(0);
        const textX = x + 4;
        let labelY;
        
        // 智能调整标签位置
        const minBarHeightForInsideLabel = 15;
        
        if (item.value >= 0) {
          // 正值柱子
          if (barHeight >= minBarHeightForInsideLabel) {
            // 柱子较高，标签在柱子顶部内部
            labelY = y + 16;
          } else {
            // 柱子较矮，标签在柱子顶部上方
            labelY = y - 5;
          }
        } else {
          // 负值柱子
          if (barHeight >= minBarHeightForInsideLabel) {
            // 柱子较高，标签在柱子底部内部
            labelY = y + barHeight - 4;
          } else {
            // 柱子较矮，标签在柱子底部下方
            labelY = y + barHeight + 12;
          }
        }
        
        ctx.font = `${canvasHeight * 0.035}px sans-serif`;
        
        // 根据柱子颜色选择文字颜色
        const isDarkBar = this.isDarkColor(barColor);
        if (isDarkBar) {
          // 深色柱子用白色文字，添加黑色阴影增强可读性
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 2;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, textX, labelY);
          // 重置阴影
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else {
          // 浅色柱子用深色文字，添加白色阴影
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
          ctx.shadowBlur = 2;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = '#333333';
          ctx.fillText(text, textX, labelY);
          // 重置阴影
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      });

      // Y轴刻度（简化显示）
      ctx.font = `${canvasHeight * 0.035}px sans-serif`;
      ctx.fillStyle = '#666';
      
      // 显示最大值
      ctx.fillText(yMax.toFixed(0), margin.left - canvasWidth * 0.08, margin.top + canvasHeight * 0.01);
      
      // 显示最小值
      ctx.fillText(yMin.toFixed(0), margin.left - canvasWidth * 0.08, margin.top + chartHeight + canvasHeight * 0.01);
      
      // 如果有负值，显示零线标签
      if (minValue < 0) {
        const zeroY = margin.top + chartHeight * (1 - (-yMin) / yRange);
        ctx.fillText('0', margin.left - canvasWidth * 0.08, zeroY + canvasHeight * 0.01);
      }
      
      // 如果范围较大，显示中间值
      if (yRange > 1000) {
        const midY = margin.top + chartHeight / 2;
        const midVal = (yMax + yMin) / 2;
        ctx.fillText(midVal.toFixed(0), margin.left - canvasWidth * 0.08, midY + canvasHeight * 0.01);
      }
    });
  },

  // 降级绘图方法（兼容旧设备，使用旧版canvas API）
  drawChartLegacy(year, data) {
    // 如果没有数据，直接返回
    if (!data || data.length === 0) return;
    // 创建旧版 canvas 上下文
    const ctx = wx.createCanvasContext('monthlyChart', this);
    // 获取窗口信息
    const windowInfo = wx.getWindowInfo();
    // 获取屏幕宽度
    const screenWidth = windowInfo.windowWidth;
    // 容器高度（rpx单位，假设为550）
    const containerHeightRpx = 550;
    // 将 rpx 转换为 px
    const containerHeightPx = containerHeightRpx * screenWidth / 750;
    // canvas 宽度为屏幕宽度减去左右边距（假设各20px）
    const canvasWidth = screenWidth - 40;
    // canvas 高度为容器高度
    const canvasHeight = containerHeightPx;

    // 清除画布
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // 设置填充色为浅灰色背景
    ctx.setFillStyle('#fafafa');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 定义边距
    const margin = {
      left: canvasWidth * 0.12,
      right: canvasWidth * 0.04,
      top: canvasHeight * 0.08,
      bottom: canvasHeight * 0.08
    };
    // 图表区域宽度
    const chartWidth = canvasWidth - margin.left - margin.right;
    // 图表区域高度
    const chartHeight = canvasHeight - margin.top - margin.bottom;
    // 间距
    const spacing = chartWidth / data.length;
    // 柱宽
    const barWidth = spacing * 0.7;

    // 标题
    ctx.setFontSize(canvasHeight * 0.05);
    ctx.setFillStyle('#333');
    ctx.fillText(`${year}年 月度碳汇`, margin.left, margin.top - canvasHeight * 0.01);
    ctx.setFontSize(canvasHeight * 0.04);
    ctx.setFillStyle('#666');
    ctx.fillText('单位: 吨', margin.left + chartWidth - 70, margin.top - canvasHeight * 0.01);

    // 提取数值并计算范围
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    let yMin, yMax;
    if (minValue < 0 && maxValue > 0) {
      const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));
      yMin = -absMax * 1.2;
      yMax = absMax * 1.2;
    } else if (minValue < 0) {
      yMin = minValue * 1.2;
      yMax = Math.abs(minValue) * 0.2;
    } else {
      yMin = 0;
      yMax = maxValue * 1.1;
    }
    
    const yRange = yMax - yMin;

    let baselineY = margin.top + chartHeight;
    if (minValue < 0) {
      baselineY = margin.top + chartHeight * (1 - (-yMin) / yRange);
    } else if (maxValue <= 0) {
      baselineY = margin.top;
    }
    
    // 绘制基线
    ctx.setStrokeStyle('#888');
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(margin.left, baselineY);
    ctx.lineTo(margin.left + chartWidth, baselineY);
    ctx.stroke();

    // 绘制坐标轴
    ctx.setStrokeStyle('#aaa');
    ctx.setLineWidth(1.5);
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();

    // 计算零线位置
    let zeroY = margin.top + chartHeight;
    if (minValue < 0) {
      zeroY = margin.top + chartHeight * (1 - (-yMin) / yRange);
    } else if (maxValue <= 0) {
      zeroY = margin.top;
    }
    
    const positiveHeight = Math.max(0, zeroY - margin.top);
    const negativeHeight = Math.max(0, margin.top + chartHeight - zeroY);
    const positiveRange = Math.max(yMax, 1);
    const negativeRange = Math.max(Math.abs(yMin), 1);
    
    // 绘制每个柱子
    data.forEach((item, index) => {
      const x = margin.left + index * spacing + (spacing - barWidth) / 2;
      let barHeight, y;
      
      if (item.value >= 0) {
        barHeight = (item.value / positiveRange) * positiveHeight;
        y = zeroY - barHeight;
        if (y < margin.top) {
          barHeight = zeroY - margin.top;
          y = margin.top;
        }
      } else {
        barHeight = (Math.abs(item.value) / negativeRange) * negativeHeight;
        y = zeroY;
        if (y + barHeight > margin.top + chartHeight) {
          barHeight = margin.top + chartHeight - zeroY;
        }
      }
      
      const barColor = this.getColorForValue(item.value);
      ctx.setFillStyle(barColor);
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // 月份标签
      ctx.setFontSize(canvasHeight * 0.04);
      ctx.setFillStyle('#333');
      ctx.fillText(item.month + '月', x, margin.top + chartHeight + canvasHeight * 0.045);
      
      // 数值标签（所有柱子都显示）- 兼容版本
      const text = item.value.toFixed(0);
      let labelY;
      
      const minBarHeightForInsideLabel = 15;
      
      if (item.value >= 0) {
        if (barHeight >= minBarHeightForInsideLabel) {
          labelY = y + 16;
        } else {
          labelY = y - 5;
        }
      } else {
        if (barHeight >= minBarHeightForInsideLabel) {
          labelY = y + barHeight - 4;
        } else {
          labelY = y + barHeight + 12;
        }
      }
      
      ctx.setFontSize(canvasHeight * 0.035);
      
      // 降级方法中，根据柱子颜色选择文字颜色
      const isDarkBar = this.isDarkColor(barColor);
      if (isDarkBar) {
        // 深色柱子用白色文字，模拟阴影
        ctx.setFillStyle('rgba(0, 0, 0, 0.3)');
        ctx.fillText(text, x + 5, labelY + 1);
        ctx.setFillStyle('#ffffff');
        ctx.fillText(text, x + 4, labelY);
      } else {
        // 浅色柱子用深色文字，模拟阴影
        ctx.setFillStyle('rgba(255, 255, 255, 0.8)');
        ctx.fillText(text, x + 5, labelY + 1);
        ctx.setFillStyle('#333333');
        ctx.fillText(text, x + 4, labelY);
      }
    });

    // Y轴刻度
    ctx.setFontSize(canvasHeight * 0.035);
    ctx.setFillStyle('#666');
    ctx.fillText(yMax.toFixed(0), margin.left - canvasWidth * 0.08, margin.top + canvasHeight * 0.01);
    ctx.fillText(yMin.toFixed(0), margin.left - canvasWidth * 0.08, margin.top + chartHeight + canvasHeight * 0.01);
    
    if (minValue < 0) {
      const zeroY = margin.top + chartHeight * (1 - (-yMin) / yRange);
      ctx.fillText('0', margin.left - canvasWidth * 0.08, zeroY + canvasHeight * 0.01);
    }
    
    if (yRange > 1000) {
      const midY = margin.top + chartHeight / 2;
      const midVal = (yMax + yMin) / 2;
      ctx.fillText(midVal.toFixed(0), margin.left - canvasWidth * 0.08, midY + canvasHeight * 0.01);
    }
    
    // 执行绘制
    ctx.draw();
  },
  startConcurrentPreload(tasks) {
    if (!tasks || tasks.length === 0) {
      console.warn('没有预加载任务，直接标记完成');
      this.setData({ localImagesPreloaded: true });
      this.checkAllImagesPreloaded();
      return;
    }
  
    const MAX_CONCURRENT = 6;
    let currentConcurrent = 0;
    let taskIndex = 0;
    let loadedCount = 0;
    const totalImages = tasks.length;
    let isFinished = false; // 防止重复完成
  
    // 超时保护（增加到60秒，适应更多图片）
    const forceFinishTimeout = setTimeout(() => {
      if (!isFinished) {
        console.warn('预加载总超时，强制完成');
        isFinished = true;
        this.setData({ localImagesPreloaded: true });
        this.checkAllImagesPreloaded();
      }
    }, 60000); // 60秒
  
    const runNextTask = () => {
      // 如果已经强制完成，不再执行新任务
      if (isFinished) return;
  
      // 所有任务完成
      if (taskIndex >= tasks.length) {
        if (currentConcurrent === 0 && !isFinished) {
          isFinished = true;
          clearTimeout(forceFinishTimeout);
          this.setData({ localImagesPreloaded: true });
          this.checkAllImagesPreloaded();
        }
        return;
      }
  
      // 达到最大并发数，等待
      if (currentConcurrent >= MAX_CONCURRENT) {
        return;
      }
  
      const task = tasks[taskIndex];
      taskIndex++;
      currentConcurrent++;
  
      let taskCompleted = false; // 防止单个任务重复完成
      const taskTimeoutId = setTimeout(() => {
        if (!taskCompleted && !isFinished) {
          taskCompleted = true;
          currentConcurrent--;
          loadedCount++;
          this.setData({
            loadProgress: Math.min(100, Math.round((loadedCount / totalImages) * 100))
          });
          runNextTask();
        }
      }, 3000); // 单张图片超时3秒
  
      wx.getImageInfo({
        src: task.imagePath,
        success: () => {
          if (!taskCompleted && !isFinished) {
            taskCompleted = true;
            clearTimeout(taskTimeoutId);
            currentConcurrent--;
            loadedCount++;
            this.setData({
              loadProgress: Math.min(100, Math.round((loadedCount / totalImages) * 100))
            });
            runNextTask();
          }
        },
        fail: () => {
          if (!taskCompleted && !isFinished) {
            taskCompleted = true;
            clearTimeout(taskTimeoutId);
            // 尝试备用路径（如果有）
            wx.getImageInfo({
              src: task.alternativePath,
              success: () => {
                currentConcurrent--;
                loadedCount++;
                this.setData({
                  loadProgress: Math.min(100, Math.round((loadedCount / totalImages) * 100))
                });
                runNextTask();
              },
              fail: () => {
                currentConcurrent--;
                loadedCount++;
                this.setData({
                  loadProgress: Math.min(100, Math.round((loadedCount / totalImages) * 100))
                });
                runNextTask();
              }
            });
          }
        }
      });
    };
  
    // 启动并发
    for (let i = 0; i < MAX_CONCURRENT; i++) {
      runNextTask();
    }
  },
  // 预加载所有年份和月份的所有图片（本地图片）
  preloadAllImages() {
    console.log('开始预加载所有云端图片（尝试两种命名格式）');
    
    const years = this.data.yearTabs.filter(y => y >= 2012 && y <= 2022);
    const months = this.data.monthTabs;
    
    const cloudFileItems = [];
    
    years.forEach(year => {
      months.forEach(month => {
        const monthStr = month < 10 ? '0' + month : month.toString();
        
        // 格式1: nep{year}{monthStr}.png
        const fileID1 = `cloud://cloudbase-8gdof83j7fdc6094.636c-cloudbase-8gdof83j7fdc6094-1406189579/qinling-carbon-data/images/nep${year}${monthStr}.png`;
        // 格式2: {year}_{month}.png
        const fileID2 = `cloud://cloudbase-8gdof83j7fdc6094.636c-cloudbase-8gdof83j7fdc6094-1406189579/qinling-carbon-data/images/${year}_${month}.png`;
        
        cloudFileItems.push({ year, month, fileIDs: [fileID1, fileID2] });
      });
    });
    
    if (cloudFileItems.length === 0) {
      console.warn('没有需要预加载的年份月份');
      this.setData({ allCloudUrlsPreloaded: true, localImagesPreloaded: true });
      this.checkAllImagesPreloaded();
      return;
    }
    
    // 将所有 fileID 扁平化，每个元素保留年月信息以便后续匹配
    const flatFileList = [];
    cloudFileItems.forEach(item => {
      item.fileIDs.forEach(fileID => {
        flatFileList.push({ year: item.year, month: item.month, fileID });
      });
    });
    
    // 分批，每批最多 50 个
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < flatFileList.length; i += BATCH_SIZE) {
      batches.push(flatFileList.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`共尝试 ${flatFileList.length} 个可能文件（2种格式×132个月），分为 ${batches.length} 批`);
    
    let allTasks = [];
    
    const processBatch = (batchIndex) => {
      if (batchIndex >= batches.length) {
        console.log(`所有批次完成，有效图片任务数: ${allTasks.length}`);
        
        if (allTasks.length === 0) {
          // 没有任何有效云端图片，直接标记完成
          console.warn('没有有效云端图片，直接完成预加载');
          this.setData({ localImagesPreloaded: true, allCloudUrlsPreloaded: true });
          this.checkAllImagesPreloaded();
          return;
        }
        
        this.setData({ preloadTasks: allTasks });
        this.startConcurrentPreload(allTasks);
        
        this.setData({ allCloudUrlsPreloaded: true });
        this.checkAllImagesPreloaded();
        return;
      }
      
      const batch = batches[batchIndex];
      const fileList = batch.map(item => ({ fileID: item.fileID, maxAge: 3600 }));
      
      wx.cloud.getTempFileURL({
        fileList: fileList,
        success: res => {
          const tempUrlMap = {};
          (res.fileList || []).forEach(item => {
            if (item.tempFileURL) {
              tempUrlMap[item.fileID] = item.tempFileURL;
            }
          });
          
          batch.forEach(item => {
            const tempURL = tempUrlMap[item.fileID];
            if (tempURL) {
              allTasks.push({
                year: item.year,
                month: item.month,
                imagePath: tempURL,
                alternativePath: tempURL
              });
            }
          });
          
          console.log(`批次 ${batchIndex + 1}/${batches.length} 完成，累计有效 tasks: ${allTasks.length}`);
          processBatch(batchIndex + 1);
        },
        fail: err => {
          console.error(`批次 ${batchIndex + 1} 获取临时链接失败:`, err);
          processBatch(batchIndex + 1);
        }
      });
    };
    
    processBatch(0);
  },
  // 检查所有图片（本地和云端）是否都已预加载完成
  checkAllImagesPreloaded() {
    console.log(`检查预加载状态: localPreload=${this.data.localImagesPreloaded}, cloudUrlReady=${this.data.allCloudUrlsPreloaded}, cloudCached=${this.data.allCloudFilesCached}, progress=${this.data.loadProgress}`);
    
    // 必须同时满足三个条件才算真正完成
    if (this.data.localImagesPreloaded && this.data.allCloudUrlsPreloaded && this.data.allCloudFilesCached) {
      this.setData({ allImagesPreloaded: true });
      console.log('✅ 所有图片（本地预加载 + 云端链接 + 云端缓存）全部完成');
    }
    
    // 应急超时保护：如果进度已达到99%且链接已就绪，但缓存迟迟未完成（超过30秒），强制放行
    // 你可以根据实际情况调整或删除这段，保留也无妨
    if (this.data.loadProgress >= 99 && this.data.allCloudUrlsPreloaded) {
      if (!this._cacheTimeoutId) {
        this._cacheTimeoutId = setTimeout(() => {
          if (!this.data.allCloudFilesCached) {
            console.warn('⚠️ 云端缓存超时，强制标记完成');
            this.setData({ allCloudFilesCached: true });
            this.checkAllImagesPreloaded();
          }
        }, ); // 30秒超时
      }
    }
  },

  // 切换到指定年份月份的图片（不改变当前选中的年份月份数据）
  switchToImage(year, month = this.data.currentMonth) {
    // 检测图片路径（优先使用上传图片）
    const imagePath = this.detectImagePath(year, month);
    
    // 检查是否是云存储路径（cloud://开头）
    if (imagePath && imagePath.startsWith('cloud://')) {
      // 云存储路径，需要获取临时URL
      console.log('switchToImage: 检测到云存储路径，获取临时URL:', imagePath);
      this.getCloudImageTempUrl(imagePath, year, month);
    } else {
      // 本地路径，设置到非活跃图层
      console.log('switchToImage: 使用本地图片路径:', imagePath);
      this._setNextLayerImage(imagePath);
      this.setData({ imageScale: 1.0, scalePercent: 100 });
    }
  },

  // 放大图片
  zoomIn() {
    // 计算新的缩放比例，最大3.0
    const newScale = Math.min(3.0, this.data.imageScale + 0.2);
    // 更新缩放比例和百分比显示
    this.setData({ imageScale: newScale, scalePercent: Math.round(newScale * 100) });
  },

  // 缩小图片
  zoomOut() {
    // 计算新的缩放比例，最小0.3
    const newScale = Math.max(0.3, this.data.imageScale - 0.2);
    // 更新缩放比例和百分比显示
    this.setData({ imageScale: newScale, scalePercent: Math.round(newScale * 100) });
  },

  // 重置缩放
  resetZoom() {
    // 重置缩放比例为1.0
    this.setData({ imageScale: 1.0, scalePercent: 100 });
  },

  // 切换透明度（用于调试或特殊效果）
  toggleOpacity() {
    // 调试用：切换当前活跃图层的透明度
    const activeLayer = this.data.activeLayer;
    if (!activeLayer) return;
    const currentOpacity = activeLayer === 'A' ? this.data.opacityA : this.data.opacityB;
    const newOpacity = currentOpacity === 1 ? 0.7 : 1;
    if (activeLayer === 'A') {
      this.setData({ opacityA: newOpacity });
    } else {
      this.setData({ opacityB: newOpacity });
    }
  },

  // 切换信息覆盖层（可能用于显示图片信息，但未完全实现）
  toggleInfoOverlay() {
    // 切换信息覆盖层显示状态（注：showInfoOverlay未在data中定义，此处可能无效，保留以备扩展）
    this.setData({ showInfoOverlay: !this.data.showInfoOverlay });
  },

  // 跳转到指定年份（通过ActionSheet选择）
  jumpToYear() {
    // 将年份数组转为字符串数组
    const years = this.data.yearTabs.map(year => year.toString());
    // 显示操作菜单
    wx.showActionSheet({
      itemList: years,
      success: (res) => {
        // 获取选中的年份
        const year = parseInt(years[res.tapIndex]);
        // 更新当前年份
        this.setData({ currentYear: year });
        // 加载该年份、当前月份的图片
        this.loadImage(year, this.data.currentMonth);
        // 更新月度数据（图表）
        this.updateMonthlyData(year);
      }
    });
  },

  // 获取系统信息并打印（调试用）
  getSystemInfo() {
    try {
      // 获取窗口信息（替换已弃用的 getSystemInfoSync）
      const windowInfo = wx.getWindowInfo();
      // 控制台输出窗口信息
      console.log('窗口信息:', windowInfo);
    } catch (err) {
      // 捕获异常并输出错误
      console.error('获取窗口信息失败:', err);
    }
  },

  // 跳转到曲线统计页面（未使用）
  navigateToCurveStatistics() {
    // 页面跳转
    wx.navigateTo({
      url: '/pages/curve-statistics/curve-statistics'
    });
  },

  // 显示系统信息弹窗（调试用）
  showSystemInfo() {
    // 构建信息字符串
    const info = `
系统状态:
当前日期: ${this.data.currentYear}年${this.data.currentMonth}月
影像尺寸: ${this.data.imageInfo.width} × ${this.data.imageInfo.height}
缩放比例: ${this.data.scalePercent}%
当前图层: ${this.data.activeLayer}
预加载: ${this.data.preloadedYears.length} 个年份
数据状态: ${this.data.currentMonthlyData.length} 个月度数据点
图片映射: ${Object.keys(this.data.imageMap).length} 个年份
    `.trim();
    // 显示模态框
    wx.showModal({ title: '系统信息', content: info, showCancel: false });
  },

  // 跳转到碳汇统计页面（包含县城统计数据）
  navigateToCarbonChart() {
    // 页面跳转
    wx.navigateTo({
      url: '/pages/carbon-chart/carbon-chart'
    });
  },
  preloadAllCloudImages() {
    const imageMap = this.data.imageMap;
    const cloudPaths = [];
    for (const year in imageMap) {
      for (const month in imageMap[year]) {
        const path = imageMap[year][month];
        if (path && path.startsWith('cloud://')) cloudPaths.push(path);
      }
    }
    const uniquePaths = [...new Set(cloudPaths)];
    if (uniquePaths.length === 0) {
      this.setData({ allCloudUrlsPreloaded: true });
      // 检查所有图片是否已预加载完成
      this.checkAllImagesPreloaded();
      return Promise.resolve();
    }
    
    // 分批请求，每批最多50个
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < uniquePaths.length; i += batchSize) {
      batches.push(uniquePaths.slice(i, i + batchSize));
    }
    
    const promises = batches.map(batch => {
      return new Promise((resolve, reject) => {
        wx.cloud.getTempFileURL({
          fileList: batch.map(fileID => ({ fileID, maxAge: 3600 })),
          success: res => {
            const now = Date.now();
            const newCache = { ...this.data.cloudTempUrlCache };
            (res.fileList || []).forEach(item => {
              if (item.tempFileURL) {
                newCache[item.fileID] = {
                  url: item.tempFileURL,
                  expireTime: now + (3600 - 60) * 1000 // 缓存59分钟
                };
              }
            });
            this.setData({ cloudTempUrlCache: newCache });
            resolve();
          },
          fail: err => {
            console.error('预加载批次失败:', err);
            resolve(); // 即使失败也不阻塞
          }
        });
      });
    });
    
    return Promise.all(promises).then(() => {
      this.setData({ allCloudUrlsPreloaded: true });
      console.log('所有云端图片预加载完成');
      // 检查所有图片是否已预加载完成
      this.checkAllImagesPreloaded();
    });
  },
  // 初始化图片映射表（从本地存储加载管理员上传的图片信息）
  initImageMap() {
    // 从本地存储加载图片映射表（同步读取，速度快）
    const imageMap = wx.getStorageSync('carbon_image_map') || {};
    // 控制台输出加载的年份数量
    console.log('加载图片映射表:', Object.keys(imageMap).length, '个年份');
    
    // 详细输出每个年份的月份数据
    for (const year in imageMap) {
      const months = Object.keys(imageMap[year] || {});
      console.log(`  年份 ${year}: ${months.length} 个月份, 月份: ${months.join(', ')}`);
      for (const month in imageMap[year]) {
        console.log(`    ${year}年${month}月: ${imageMap[year][month]}`);
      }
    }
    
    // 更新数据中的图片映射表
    this.setData({ imageMap });
    
    // 更新年份选项卡，基于imageMap中的年份
    this.updateYearTabsFromImageMap(imageMap);
    
    // 如果没有图片映射表，初始化默认结构
    if (Object.keys(imageMap).length === 0) {
      this.initDefaultImageMap();
    }
  },

  // 根据图片映射表更新年份选项卡
  updateYearTabsFromImageMap(imageMap) {
    // 获取映射表中的年份，转为数字并排序
    const imageYears = Object.keys(imageMap).map(year => parseInt(year)).sort((a, b) => a - b);
    
    // 始终包含默认年份（2012-2024）
    const defaultYears = [];
    for (let y = 2012; y <= 2024; y++) {
      defaultYears.push(y);
    }
    
    // 合并两个年份列表，去重排序（不再过滤超过2024年的年份）
    const allYears = [...new Set([...defaultYears, ...imageYears])]
      .sort((a, b) => a - b);
    
    // 计算动态的最小年份和最大年份
    const minYear = allYears.length > 0 ? Math.min(...allYears) : 2012;
    const maxYear = allYears.length > 0 ? Math.max(...allYears) : 2024;
    
    // 控制台输出更新后的年份选项卡
    console.log('更新年份选项卡:', allYears, '（默认年份:', defaultYears, '，图片年份:', imageYears, '，最小年份:', minYear, '，最大年份:', maxYear, '）');
    
    // 更新年份选项卡列表和年份范围
    this.setData({ 
      yearTabs: allYears,
      minYear: minYear,
      maxYear: maxYear
    }, () => {
      // 年份选项卡更新后，开始预加载本地图片（如果尚未开始）
      if (!this.data.localPreloadStarted) {
        console.log('年份选项卡更新完成，开始预加载本地图片');
        this.preloadAllImages();
      }
    });
    
    // 如果当前年份不在新的年份列表中，调整到第一个可用年份
    if (allYears.length > 0 && !allYears.includes(this.data.currentYear)) {
      const newYear = allYears[0]; // 使用第一个可用年份
      // 控制台输出年份切换
      console.log('当前年份不在列表中，切换到第一个可用年份:', newYear);
      // 更新当前年份
      this.setData({ currentYear: newYear });
      // 加载图片和更新图表
      this.loadImage(newYear, this.data.currentMonth);
      this.updateMonthlyData(newYear);
    }
  },

  // 初始化默认图片映射表（基于现有图片文件）
  initDefaultImageMap() {
    // 只创建空的映射表结构，不预设任何图片路径
    const imageMap = {};
    
    // 如果需要预设年份范围（便于后续判断），只创建空对象
    const years = this.data.yearTabs;
    const filteredYears = years.filter(year => year >= 2012 && year <= 2022);
    
    for (const year of filteredYears) {
      imageMap[year] = {};  // 空对象，不包含任何月份路径
    }
    
    this.setData({ imageMap });
    wx.setStorageSync('carbon_image_map', imageMap);
    console.log('初始化空的图片映射表完成，后续上传会填充实际云存储路径');
  },
  // 添加图片到映射表（管理员上传新图片后调用）
  addImageToMap(year, month, imagePath) {
    // 获取当前映射表
    const imageMap = this.data.imageMap;
    // 如果该年份不存在，创建空对象
    if (!imageMap[year]) {
      imageMap[year] = {};
    }
    // 设置对应月份的图片路径
    imageMap[year][month] = imagePath;
    
    // 更新数据中的映射表
    this.setData({ imageMap });
    // 保存到本地存储
    wx.setStorageSync('carbon_image_map', imageMap);
    // 控制台输出添加信息
    console.log('添加图片到映射表:', year, '年', month, '月', imagePath);
    
    // 更新年份选项卡
    this.updateYearTabsFromImageMap(imageMap);
    
    // 如果当前显示的是这个年份月份，重新加载图片
    if (this.data.currentYear === year && this.data.currentMonth === month) {
      this.loadImage(year, month);
    }
  },

  // 跳转区县统计页面（含图片轮播）
  navigateToCountyStats() {
    // 页面跳转
    wx.navigateTo({
      url: '/pages/county-stats/county-stats'
    });
  },

  // 跳转3D地图页面
  navigateTo3DMap() {
    // 页面跳转
    wx.navigateTo({
      url: '/pages/3d-map/3d-map'
    });
  },

  // 跳转碳汇地图页面（2D平面地图）
  navigateToCarbonMap() {
    // 页面跳转
    wx.navigateTo({
      url: '/pages/terrain-webview/terrain-webview'
    });
  },

  // 跳转管理员页面（上传图片）
  navigateToAdmin() {
    // 页面跳转
    wx.navigateTo({
      url: '/pages/admin-upload/admin-upload'
    });
  },

  // 跳转3D行政区划柱状图页面（现在整合到地形图页面中）
  navigateTo3DBarChart() {
    // 页面跳转到地形图页面，并传递mode参数以显示3D柱状图模式
    wx.navigateTo({
      url: '/pages/terrain-webview/terrain-webview?mode=3d-bar'
    });
  },

  // 切换自动播放
  toggleAutoPlay() {
    // 预加载未完成时禁止播放
    if (!this.data.allImagesPreloaded) {
      wx.showToast({
        title: '图片预加载中，请稍候...',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    // 如果当前正在自动播放，停止；否则开始
    if (this.data.autoPlay) {
      this.stopAutoPlay();
    } else {
      this.startAutoPlay();
    }
  },

  // 开始自动播放
  startAutoPlay() {
    // 预加载未完成时禁止播放
    if (!this.data.allImagesPreloaded) {
      wx.showToast({
        title: '图片预加载中，请稍候...',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    this._realStartAutoPlay();
  },
  
  _realStartAutoPlay() {
    if (this.data.autoPlayTimer) clearInterval(this.data.autoPlayTimer);
    this.setData({ 
      autoPlay: true, 
      autoPlayStatus: '播放中...',
      waitingForImageLoad: false  // 添加新状态：是否在等待图片加载
    });
    
    // 使用新的等待图片加载完成的自动播放逻辑
    this._startAutoPlayWithWait();
  },

  // 启动等待图片加载完成的自动播放逻辑
  _startAutoPlayWithWait() {
    // 清除之前的定时器
    if (this._autoPlayWaitTimer) {
      clearTimeout(this._autoPlayWaitTimer);
      this._autoPlayWaitTimer = null;
    }
    
    // 设置等待状态
    this.setData({ waitingForImageLoad: true });
    
    // 加载当前图片（第一次调用时加载当前选中的图片）
    this.loadImage(this.data.currentYear, this.data.currentMonth);
    
    // 注意：下一步将在图层加载回调中触发
  },

  // 停止自动播放
  stopAutoPlay() {
    // 如果存在定时器，清除它
    if (this.data.autoPlayTimer) {
      clearInterval(this.data.autoPlayTimer);
    }
    // 清除等待图片加载的定时器
    if (this._autoPlayWaitTimer) {
      clearTimeout(this._autoPlayWaitTimer);
      this._autoPlayWaitTimer = null;
    }
    // 更新状态
    this.setData({
      autoPlay: false,
      autoPlayStatus: '停止',
      autoPlayTimer: null,
      waitingForImageLoad: false
    });
    // 控制台输出自动播放停止
    console.log('自动播放停止，当前时间：' + new Date().toLocaleTimeString() + '，当前年份：' + this.data.currentYear + '，月份：' + this.data.currentMonth);
    try { console.trace('stopAutoPlay调用栈'); } catch(e) {}
  },

  // 播放下一张图片（自动播放逻辑）
  autoPlayNext() {
    // 获取当前年份、月份、最大年份
    let { currentYear, currentMonth, maxYear } = this.data;
    
    // 先尝试增加月份
    if (currentMonth < 12) {
      currentMonth++;
    } else {
      // 月份到12月，增加到下一年1月
      currentMonth = 1;
      if (currentYear < maxYear) {
        currentYear++;
      } else {
        // 已经到最大年份的12月，停止播放
        this.stopAutoPlay();
        // 显示提示
        wx.showToast({
          title: '已播放到最后一张',
          icon: 'none'
        });
        return;
      }
    }
    
    // 控制台输出播放下一张的信息
    console.log('自动播放下一张:', currentYear, '年', currentMonth, '月');
    // 更新年份和月份
    this.setData({
      currentYear,
      currentMonth
    });
    // 加载新图片
    this.loadImage(currentYear, currentMonth);
    // 更新图表
    this.updateMonthlyData(currentYear);
  },

  // 切换年份选择器显示
  toggleYearPicker() {
    // 计算新的显示状态
    const willShow = !this.data.showYearPicker;
    // 更新显示状态，并确保年份选择器打开时关闭月份选择器
    this.setData({
      showYearPicker: willShow,
      // 打开年份选择器时关闭月份选择器
      showMonthPicker: willShow ? false : this.data.showMonthPicker
    });
  },

  // 关闭年份选择器
  closeYearPicker() {
    // 设置年份选择器隐藏
    this.setData({
      showYearPicker: false
    });
  },

  // 选择年份（从弹窗中点击）
  selectYear(e) {
    // 获取点击的年份并转为数字
    const year = Number(e.currentTarget.dataset.year);
    // 如果年份无效或与当前相同，关闭弹窗后返回
    if (!year || year === this.data.currentYear) {
      this.closeYearPicker();
      return;
    }
    
    // 如果正在自动播放，停止它（用户手动操作时停止自动播放）
    if (this.data.autoPlay) {
      this.stopAutoPlay();
    }
    
    // 控制台输出选择年份
    console.log('选择年份:', year);
    // 更新年份并关闭弹窗
    this.setData({
      currentYear: year,
      showYearPicker: false
    });
    
    // 加载对应年份的图片
    this.loadImage(year, this.data.currentMonth);
    // 更新图表
    this.updateMonthlyData(year);
  },

  // 切换月份选择器显示
  toggleMonthPicker() {
    // 计算新的显示状态
    const willShow = !this.data.showMonthPicker;
    // 更新显示状态，并确保月份选择器打开时关闭年份选择器
    this.setData({
      showMonthPicker: willShow,
      // 打开月份选择器时关闭年份选择器
      showYearPicker: willShow ? false : this.data.showYearPicker
    });
  },

  // 关闭月份选择器
  closeMonthPicker() {
    // 设置月份选择器隐藏
    this.setData({
      showMonthPicker: false
    });
  },

  // 选择月份（从弹窗中点击）
  selectMonth(e) {
    // 获取点击的月份并转为数字
    const month = Number(e.currentTarget.dataset.month);
    // 如果月份无效或与当前相同，关闭弹窗后返回
    if (!month || month === this.data.currentMonth) {
      this.closeMonthPicker();
      return;
    }
    
    // 如果正在自动播放，停止它（用户手动操作时停止自动播放）
    if (this.data.autoPlay) {
      this.stopAutoPlay();
    }
    
    // 更新月份并关闭弹窗
    this.setData({
      currentMonth: month,
      showMonthPicker: false
    });
    
    // 加载对应月份的图片
    this.loadImage(this.data.currentYear, month);
    
    // 控制台输出切换月份
    console.log('切换到月份:', month);
  },



  // 检查当前图片是否为上传图片（返回 'uploaded' 或 'default'）
  checkImageSource(year, month) {
    // 获取图片映射表
    const imageMap = this.data.imageMap;
    // 如果映射表中有该年份月份的数据
    if (imageMap[year] && imageMap[year][month]) {
      const imagePath = imageMap[year][month];
      // 检查是否为上传图片（不是默认路径）
      if (!imagePath.includes('/images/nep')) {
        return 'uploaded';
      }
      return 'default';
    }
    return 'default';
  },

  // 优化detectImagePath函数，添加图片来源标记
  detectImagePath(year, month) {
    const imageMap = this.data.imageMap;
    const yearStr = String(year);
    const monthStr = month < 10 ? '0' + month : month.toString();

    // 1. 检查本地文件缓存
    const cachedFilePath = this.getCachedFilePath(yearStr, monthStr);
    if (cachedFilePath) {
      console.log(`detectImagePath: 使用本地缓存文件: ${cachedFilePath}`);
      return cachedFilePath;
    }

    // 2. 从imageMap获取原始云路径
    let cloudPath = null;
    const yearKey = String(year);
    const monthKey = String(month);
    if (imageMap[year] && imageMap[year][month]) {
      cloudPath = imageMap[year][month];
    } else if (imageMap[yearKey] && imageMap[yearKey][monthKey]) {
      cloudPath = imageMap[yearKey][monthKey];
    }

    if (cloudPath && cloudPath.startsWith('cloud://')) {
      // 3. 检查临时URL缓存
      const cache = this.data.cloudTempUrlCache[cloudPath];
      const now = Date.now();
      if (cache && cache.expireTime && cache.expireTime > now + 30000) {
        console.log(`detectImagePath: 使用缓存的临时URL: ${cache.url}`);
        return cache.url;
      }
      console.log(`detectImagePath: 未找到有效缓存，返回云路径: ${cloudPath}`);
      return cloudPath;
    }

    // 5. 无上传记录，尝试构造标准云存储路径
    const standardCloudPath = `cloud://cloudbase-8gdof83j7fdc6094.636c-cloudbase-8gdof83j7fdc6094-1406189579/qinling-carbon-data/images/nep${year}${monthStr}.png`;

    // 检查该云路径是否已缓存临时URL（避免重复请求）
    const cache = this.data.cloudTempUrlCache[standardCloudPath];
    const now = Date.now();
    if (cache && cache.expireTime && cache.expireTime > now + 30000) {
      console.log(`detectImagePath: 标准云路径命中缓存: ${cache.url}`);
    }
    console.log(`detectImagePath: 尝试标准云路径: ${standardCloudPath}`);
    return standardCloudPath;
  },

  // 阻止事件冒泡（用于弹窗内部，防止点击内容时关闭弹窗）
  stopPropagation() {
    return;
  }
})