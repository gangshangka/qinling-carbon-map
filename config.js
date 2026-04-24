/**
 * 秦岭碳汇遥感监测系统配置文件
 * 云存储配置
 * 
 * 支持多种云存储方案：
 * 1. 微信云开发云存储（推荐）- 小程序内置，无需备案，免费额度充足
 * 2. 腾讯云COS - 适合大规模存储，需要备案域名
 * 3. 其他CDN/云存储服务 - 灵活选择
 * 
 * 设置步骤：
 * 1. 选择一种云存储方案（推荐微信云开发）
 * 2. 根据选择的方案配置下方对应参数
 * 3. 将图片上传到云存储
 * 4. 运行 checkConfig() 检查配置是否正确
 */

const config = {
  // ============================================
  // 云存储方案选择
  // ============================================
  // 可选值: 'wechatCloud'（微信云开发）| 'tencentCOS'（腾讯云COS）| 'customCDN'（自定义CDN）
  storageType: 'wechatCloud',
  
  // ============================================
  // 微信云开发配置（storageType为'wechatCloud'时生效）
  // ============================================
  wechatCloud: {
    // 云存储路径配置
    // 图片在云存储中的目录路径
    // 示例：如果图片上传到云存储的 'qinling-carbon-images/with_white_bg' 目录
    cloudPath: 'qinling-carbon-images/with_white_bg',
    
    // 云存储环境ID（必须与app.js中的环境ID一致）
    // 获取方法：
    // 1. 在微信开发者工具中点击左侧"云开发"按钮
    // 2. 开通云开发，创建环境（如：qinling-carbon）
    // 3. 复制环境ID（如：qinling-carbon-4g1k2）
    // 4. 同时更新app.js和这里的envId
    envId: 'cloudbase-8gdof83j7fdc6094', // 替换为你的环境ID
    
    // 云存储HTTP域名（自动生成，无需修改）
    // 格式：https://<env-id>.cloud.tcb.tencent.com
    // 注意：微信云存储文件可以通过HTTP URL直接访问
    httpDomain: 'https://cloudbase-8gdof83j7fdc6094.cloud.tcb.tencent.com'
  },
  
  // ============================================
  // 腾讯云COS配置（storageType为'tencentCOS'时生效）
  // ============================================
  tencentCOS: {
    // COS桶域名
    // 格式：https://<bucket-name>.cos.<region>.myqcloud.com
    bucketDomain: 'https://your-bucket-name.cos.ap-guangzhou.myqcloud.com',
    
    // 存储路径前缀
    pathPrefix: 'images/with_white_bg',
    
    // CDN加速域名（如果有）
    cdnDomain: 'https://cdn.your-domain.com/images/with_white_bg'
  },
  
  // ============================================
  // 自定义CDN配置（storageType为'customCDN'时生效）
  // ============================================
  customCDN: {
    // 基础URL
    baseUrl: 'https://your-cloud-storage-domain.com/images/with_white_bg',
    
    // CDN加速URL（如果有）
    cdnUrl: 'https://cdn.your-domain.com/images/with_white_bg'
  },
  
  // ============================================
  // 系统配置
  // ============================================
  system: {
    appName: '秦岭碳收支遥感监测系统',
    version: '1.0.0',
    developer: '腾讯云团队'
  },
  
  // ============================================
  // 图片相关配置
  // ============================================
  images: {
    // 图片命名规则
    naming: {
      // 月度图片命名格式
      monthly: 'nep{year}{month}.png'
    },
    
    // 占位图配置
    placeholder: {
      // 默认占位图（2012年1月）
      defaultYear: 2012,
      defaultMonth: 1
    }
  },
  
  // ============================================
  // 数据相关配置
  // ============================================
  data: {
    // 数据年份范围
    yearRange: {
      min: 2012,
      max: 2024
    },
    
    // 月份范围
    monthRange: {
      min: 1,
      max: 12
    }
  }
};

// ============================================
// 工具函数
// ============================================

/**
 * 获取图片文件名
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {string} 图片文件名
 */
function getImageFileName(year, month) {
  const monthStr = month.toString().padStart(2, '0');
  return `nep${year}${monthStr}.png`;
}

/**
 * 获取微信云开发图片URL
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {string} 完整HTTP图片URL
 */
function getWechatCloudImageUrl(year, month) {
  const fileName = getImageFileName(year, month);
  
  // 构建HTTP URL格式：https://<env-id>.cloud.tcb.tencent.com/<cloud-path>/<filename>
  // 注意：需要确保云存储文件有公开访问权限
  const { envId, cloudPath, httpDomain } = config.wechatCloud;
  
  // 自动生成httpDomain（如果用户未修改默认值）
  let domain = httpDomain;
  if (domain === 'https://your-env-id.cloud.tcb.tencent.com' && envId !== 'your-env-id') {
    domain = `https://${envId}.cloud.tcb.tencent.com`;
  }
  
  // 确保路径格式正确
  const cleanDomain = domain.endsWith('/') ? domain.slice(0, -1) : domain;
  const cleanCloudPath = cloudPath.startsWith('/') ? cloudPath.slice(1) : cloudPath;
  
  return `${cleanDomain}/${cleanCloudPath}/${fileName}`;
}

/**
 * 获取腾讯云COS图片URL
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @param {boolean} useCDN - 是否使用CDN
 * @returns {string} 完整图片URL
 */
function getTencentCOSImageUrl(year, month, useCDN = false) {
  const fileName = getImageFileName(year, month);
  const baseUrl = useCDN ? config.tencentCOS.cdnDomain : config.tencentCOS.bucketDomain;
  const pathPrefix = config.tencentCOS.pathPrefix;
  
  // 确保URL格式正确
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPathPrefix = pathPrefix.startsWith('/') ? pathPrefix.slice(1) : pathPrefix;
  
  return `${cleanBaseUrl}/${cleanPathPrefix}/${fileName}`;
}

/**
 * 获取自定义CDN图片URL
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @param {boolean} useCDN - 是否使用CDN
 * @returns {string} 完整图片URL
 */
function getCustomCDNImageUrl(year, month, useCDN = false) {
  const fileName = getImageFileName(year, month);
  const baseUrl = useCDN ? config.customCDN.cdnUrl : config.customCDN.baseUrl;
  
  // 确保URL格式正确
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  return `${cleanBaseUrl}/${fileName}`;
}

/**
 * 获取指定年月度的图片URL（主函数）
 * @param {number} year - 年份，如 2020
 * @param {number} month - 月份，如 1
 * @param {boolean} useCDN - 是否使用CDN加速（仅对tencentCOS和customCDN有效）
 * @returns {string} 图片URL
 */
function getMonthlyImageUrl(year, month, useCDN = false) {
  const storageType = config.storageType;
  
  switch (storageType) {
    case 'wechatCloud':
      // 微信云开发返回云存储路径
      return getWechatCloudImageUrl(year, month);
      
    case 'tencentCOS':
      // 腾讯云COS返回完整URL
      return getTencentCOSImageUrl(year, month, useCDN);
      
    case 'customCDN':
      // 自定义CDN返回完整URL
      return getCustomCDNImageUrl(year, month, useCDN);
      
    default:
      // 默认使用微信云开发
      console.warn(`未知的存储类型: ${storageType}，使用微信云开发作为默认`);
      return getWechatCloudImageUrl(year, month);
  }
}

/**
 * 获取背景图片URL（固定为2012年1月图片）
 * @param {boolean} useCDN - 是否使用CDN加速（仅对tencentCOS和customCDN有效）
 * @returns {string} 背景图片URL
 */
function getBackgroundImageUrl(useCDN = false) {
  return getMonthlyImageUrl(
    config.images.placeholder.defaultYear,
    config.images.placeholder.defaultMonth,
    useCDN
  );
}

/**
 * 检查配置是否已正确设置
 * @returns {object} 检查结果
 */
function checkConfig() {
  const storageType = config.storageType;
  const issues = [];
  
  switch (storageType) {
    case 'wechatCloud':
      if (!config.wechatCloud.cloudPath) {
        issues.push('微信云开发配置缺失：cloudPath');
      }
      if (!config.wechatCloud.envId || config.wechatCloud.envId === 'your-env-id') {
        issues.push('微信云开发配置缺失或未修改：envId（请替换为你的环境ID）');
      }
      break;
      
    case 'tencentCOS':
      if (!config.tencentCOS.bucketDomain) {
        issues.push('腾讯云COS配置缺失：bucketDomain');
      }
      if (!config.tencentCOS.pathPrefix) {
        issues.push('腾讯云COS配置缺失：pathPrefix');
      }
      break;
      
    case 'customCDN':
      if (!config.customCDN.baseUrl) {
        issues.push('自定义CDN配置缺失：baseUrl');
      }
      break;
      
    default:
      issues.push(`未知的存储类型: ${storageType}`);
  }
  
  return {
    valid: issues.length === 0,
    storageType: storageType,
    issues: issues,
    message: issues.length === 0 
      ? '配置检查通过'
      : `配置存在问题：${issues.join('; ')}`
  };
}

// ============================================
// 导出配置和函数
// ============================================
module.exports = {
  config,
  getMonthlyImageUrl,
  getBackgroundImageUrl,
  getImageFileName,
  checkConfig
};