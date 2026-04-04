App({
  onLaunch() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        traceUser: true,
      });
    }

    this.globalData = {
      isAdmin: false,
      openid: ''
    };

    // 创建一个权限校验的 Promise
    this.authPromise = this.checkUserRole();
  },

  async checkUserRole() {
    try {
      // 如果您没有创建 login 云函数，也可以通过 db.collection().get() 触发自动获取 openid (部分环境支持)
      // 推荐标准做法是部署一个名为 login 的云函数，返回 { openid: cloud.getWXContext().OPENID }
      const { result } = await wx.cloud.callFunction({ name: 'login' });
      const openid = result.openid;
      this.globalData.openid = openid;
      
      // ✅ 打印出 OpenID，方便复制到数据库
      console.log('🎈 当前用户的 OpenID 是:', openid);

      // 在云端数据库中查询该 openid 是否在管理员名单中
      const db = wx.cloud.database();
      const res = await db.collection('admins').where({ openid }).get();
      if (res.data.length > 0) {
        this.globalData.isAdmin = true;
      }
    } catch (e) {
      console.error('权限识别失败：', e);
    }
  },

  globalData: {}
});
