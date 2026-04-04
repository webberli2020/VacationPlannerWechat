const { fetchConfig, updateConfig, DEFAULT_CONFIG } = require('../../utils/cloudHelper');
const app = getApp();

Page({
  data: {
    isAdmin: false,
    config: {},
    companies: [],
    selectedCompanyIdx: 0,
    years: [],
    selectedYearIdx: 0,
    currentDates: { holidays: [], extraWorkdays: [] }
  },

  async onShow() {
    await app.authPromise;
    this.setData({ isAdmin: app.globalData.isAdmin });
    this.refreshLocalData();
  },

  async refreshLocalData() {
    wx.showLoading({ title: '同步配置...', mask: true });
    try {
      const config = await fetchConfig();
      const companies = Object.keys(config);
      this.setData({ config, companies }, () => {
        this.updateYearList();
        wx.hideLoading();
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  updateYearList() {
    const { config, companies, selectedCompanyIdx } = this.data;
    const companyName = companies[selectedCompanyIdx];
    if (!companyName) return;
    
    const years = Object.keys(config[companyName] || {});
    this.setData({ years }, () => {
      this.updateDateDisplay();
    });
  },

  updateDateDisplay() {
    const { config, companies, selectedCompanyIdx, years, selectedYearIdx } = this.data;
    const companyName = companies[selectedCompanyIdx];
    const year = years[selectedYearIdx];
    if (companyName && year && config[companyName][year]) {
      this.setData({ currentDates: config[companyName][year] });
    } else {
      this.setData({ currentDates: { holidays: [], extraWorkdays: [] } });
    }
  },

  // 单位变化
  bindCompanyChange(e) {
    this.setData({ selectedCompanyIdx: e.detail.value, selectedYearIdx: 0 }, () => {
      this.updateYearList();
    });
  },

  // 年份变化
  bindYearChange(e) {
    this.setData({ selectedYearIdx: e.detail.value }, () => {
      this.updateDateDisplay();
    });
  },

  // 添加单位
  addCompany() {
    wx.showModal({
      title: '添加单位',
      placeholderText: '请输入单位名称',
      editable: true,
      success: (res) => {
        if (res.confirm && res.content) {
          const { config } = this.data;
          if (config[res.content]) return wx.showToast({ title: '已存在', icon: 'error' });
          config[res.content] = {};
          this.saveAndRefresh(config);
        }
      }
    });
  },

  // 添加年份
  addYear() {
    const { companies, selectedCompanyIdx } = this.data;
    if (companies.length === 0) return wx.showToast({ title: '请先添加单位', icon: 'none' });

    wx.showModal({
      title: '添加年份',
      placeholderText: '例如 2027',
      editable: true,
      success: (res) => {
        if (res.confirm && res.content) {
          const { config } = this.data;
          const company = companies[selectedCompanyIdx];
          if (config[company][res.content]) return wx.showToast({ title: '已存在', icon: 'error' });
          config[company][res.content] = { holidays: [], extraWorkdays: [] };
          this.saveAndRefresh(config);
        }
      }
    });
  },

  // 添加日期 (通用)
  bindAddDate(e) {
    const { type } = e.currentTarget.dataset; // holidays or extraWorkdays
    const dateStr = e.detail.value; // YYYY-MM-DD
    const mmdd = dateStr.substring(5); // 提取 MM-DD
    
    const { config, companies, selectedCompanyIdx, years, selectedYearIdx } = this.data;
    const company = companies[selectedCompanyIdx];
    const year = years[selectedYearIdx];
    
    if (!company || !year) return wx.showToast({ title: '请先选择单位和年份', icon: 'none' });

    if (!config[company][year][type].includes(mmdd)) {
      config[company][year][type].push(mmdd);
      config[company][year][type].sort(); // 排序保持整齐
      this.saveAndRefresh(config);
    }
  },

  // 删除日期
  deleteDate(e) {
    const { type, val } = e.currentTarget.dataset;
    const { config, companies, selectedCompanyIdx, years, selectedYearIdx } = this.data;
    const company = companies[selectedCompanyIdx];
    const year = years[selectedYearIdx];

    wx.showModal({
      title: '确认删除',
      content: `确定要移除 ${val} 吗？`,
      success: (res) => {
        if (res.confirm) {
          config[company][year][type] = config[company][year][type].filter(d => d !== val);
          this.saveAndRefresh(config);
        }
      }
    });
  },

  // 重置为默认
  resetToDefault() {
    wx.showModal({
      title: '重置',
      content: '确定要重置为初始配置并覆盖所有修改吗？',
      success: (res) => {
        if (res.confirm) {
          this.saveAndRefresh(DEFAULT_CONFIG);
        }
      }
    });
  },

  async saveAndRefresh(config) {
    if (!app.globalData.isAdmin) {
      return wx.showModal({ title: '权限拒绝', content: '您不是管理员，无法保存修改', showCancel: false });
    }

    wx.showLoading({ title: '正在同步云端...', mask: true });
    try {
      await updateConfig(config);
      wx.hideLoading();
      wx.showToast({ title: '同步成功' });
      this.refreshLocalData();
    } catch (err) {
      wx.hideLoading();
      wx.showModal({ title: '更新失败', content: err.message, showCancel: false });
    }
  }
});
