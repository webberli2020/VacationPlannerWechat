const db = wx.cloud.database();
const CONFIG_ID = 'GLOBAL_CONFIG'; // 我们在数据库中使用的唯一文档 ID

const DEFAULT_CONFIG = {
  "驻巴西使馆": {
    "2025": { holidays: ['01-01','01-28','01-29','01-30','01-31','04-04','05-01','05-02','05-30','09-30','10-01','10-02','10-03'], extraWorkdays: [] },
    "2026": { holidays: ['01-01','02-16','02-17','02-18','02-19','04-06','05-01','05-04','06-19','09-25','10-01','10-02','10-05'], extraWorkdays: [] }
  },
  "部机关": {
    "2025": { holidays: ['01-01','01-28','01-29','01-30','01-31','02-03','02-04','04-04','05-01','05-02','05-05','06-02','09-30','10-01','10-02','10-03','10-06','10-07','10-08'], extraWorkdays: ['01-26','02-08','04-27','09-28','10-11'] },
    "2026": { holidays: ['01-01','01-02','02-16','02-17','02-18','02-19','02-20','02-23','04-06','05-01','05-04','05-05','06-19','09-25','10-01','10-02','10-05','10-06','10-07'], extraWorkdays: ['01-04','02-14','02-28','05-09','09-20','10-10'] }
  }
};

/**
 * 远程获取配置
 */
const fetchConfig = async () => {
  try {
    const { data } = await db.collection('holiday_configs').doc(CONFIG_ID).get();
    // 同步到本地缓存备份
    wx.setStorageSync('HOLIDAY_CONFIG_CACHE', data.content);
    return data.content;
  } catch (err) {
    console.warn('云端获取失败，尝试读取本地缓存:', err);
    // 如果云端还没有数据 (初次运行)，初始化一份
    if (err.errCode === -1 || err.errMsg.includes('document not exist')) {
      await initializeCloudData();
      return DEFAULT_CONFIG;
    }
    return wx.getStorageSync('HOLIDAY_CONFIG_CACHE') || DEFAULT_CONFIG;
  }
};

/**
 * 初始化云端数据 (仅首次运行或数据被清理时)
 */
const initializeCloudData = async () => {
  try {
    await db.collection('holiday_configs').add({
      data: {
        _id: CONFIG_ID,
        content: DEFAULT_CONFIG,
        updateTime: db.serverDate()
      }
    });
  } catch (e) {
    console.error('初始化数据失败：', e);
  }
};

/**
 * 更新远程配置
 */
const updateConfig = async (newConfig) => {
  try {
    await db.collection('holiday_configs').doc(CONFIG_ID).update({
      data: {
        content: newConfig,
        updateTime: db.serverDate()
      }
    });
    wx.setStorageSync('HOLIDAY_CONFIG_CACHE', newConfig);
    return true;
  } catch (err) {
    console.error('更新远程配置失败：', err);
    throw err;
  }
};

module.exports = {
  fetchConfig,
  updateConfig,
  DEFAULT_CONFIG
};
