App({
  onLaunch() {
    // 这里可以执行初始化逻辑，例如从 Storage 中提取用户的休假偏好配置
    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);
  },
  globalData: {
    userInfo: null
  }
});
