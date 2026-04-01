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

Page({
  data: {
    config: {},
    companies: [],
    selectedCompanyIdx: 0,
    years: [],
    selectedYearIdx: 0,
    currentDates: { holidays: [], extraWorkdays: [] }
  },

  onShow() {
    this.refreshLocalData();
  },

  refreshLocalData() {
    const config = wx.getStorageSync('HOLIDAY_CONFIG') || JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    const companies = Object.keys(config);
    this.setData({ config, companies }, () => {
      this.updateYearList();
    });
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

  saveAndRefresh(config) {
    wx.setStorageSync('HOLIDAY_CONFIG', config);
    wx.showToast({ title: '已更新' });
    this.refreshLocalData();
  }
});
