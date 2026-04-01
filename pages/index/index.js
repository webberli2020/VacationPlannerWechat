const CONFIG = {
  "驻巴西使馆": {
    "2025": { holidays: ['01-01', '01-28', '01-29', '01-30', '01-31', '04-04', '05-01', '05-02', '05-30', '09-30', '10-01', '10-02', '10-03'], extraWorkdays: [] },
    "2026": { holidays: ['01-01', '02-16', '02-17', '02-18', '02-19', '04-06', '05-01', '05-04', '06-19', '09-25', '10-01', '10-02', '10-05'], extraWorkdays: [] }
  },
  "部机关": {
    "2025": { holidays: ['01-01', '01-28', '01-29', '01-30', '01-31', '02-03', '02-04', '04-04', '05-01', '05-02', '05-05', '06-02', '09-30', '10-01', '10-02', '10-03', '10-06', '10-07', '10-08'], extraWorkdays: ['01-26', '02-08', '04-27', '09-28', '10-11'] },
    "2026": { holidays: ['01-01', '01-02', '02-16', '02-17', '02-18', '02-19', '02-20', '02-23', '04-06', '05-01', '05-04', '05-05', '06-19', '09-25', '10-01', '10-02', '10-05', '10-06', '10-07'], extraWorkdays: ['01-04', '02-14', '02-28', '05-09', '09-20', '10-10'] }
  }
};

Page({
  data: {
    companies: Object.keys(CONFIG),
    selectedCompanyIndex: 0,
    years: [],
    selectedYearIndex: 0,
    startDateStr: '',
    finalEndDateStr: '',
    leaveQueue: [], // 存储选中的假期类型 ID
    leaveOptions: [
      { id: 'annual', name: '年休假', maxDays: 15, currentDays: 15, checked: false, seq: '' },
      { id: 'term', name: '任期假', maxDays: 20, currentDays: 20, checked: false, seq: '' },
      { id: 'personal', name: '事假', maxDays: 100, currentDays: 1, checked: false, seq: '' },
      { id: 'travel', name: '路途假', maxDays: 4, currentDays: 2, checked: false, seq: '' }
    ],
    stats: { work: 0, holi: 0, week: 0 },
    calendarData: [], // 渲染层使用的日历数据
    showAbout: false
  },

  onLoad() {
    this.updateYearOptions(true);
  },

  // 切换单位
  bindCompanyChange(e) {
    this.setData({ selectedCompanyIndex: e.detail.value });
    this.updateYearOptions();
  },

  // 切换年份
  bindYearChange(e) {
    this.setData({ selectedYearIndex: e.detail.value });
    this.initCalendar();
  },

  updateYearOptions(isInitial = false) {
    const company = this.data.companies[this.data.selectedCompanyIndex];
    const years = Object.keys(CONFIG[company]);
    let initialYearIdx = 0;
    if (isInitial) {
      const curY = new Date().getFullYear().toString();
      const idx = years.indexOf(curY);
      initialYearIdx = idx !== -1 ? idx : 0;
    }
    this.setData({ years, selectedYearIndex: initialYearIdx }, () => {
      this.initCalendar();
    });
  },

  // 获取日期类型
  getDayType(date) {
    const y = date.getFullYear();
    const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const company = this.data.companies[this.data.selectedCompanyIndex];
    const conf = CONFIG[company] && CONFIG[company][y] ? CONFIG[company][y] : { holidays: [], extraWorkdays: [] };
    if (conf.holidays.includes(mmdd)) return 'holiday';
    if (conf.extraWorkdays.includes(mmdd)) return 'workday-override';
    const day = date.getDay();
    return (day === 0 || day === 6) ? 'weekend' : 'normal';
  },

  // 多选框逻辑变化
  handleCheckboxChange(e) {
    const values = e.detail.value;
    const { leaveOptions, leaveQueue } = this.data;

    // 如果新的选中列表长度增加了，找出新增的加到队列
    if (values.length > leaveQueue.length) {
      const newItem = values.find(id => !leaveQueue.includes(id));
      if (newItem) leaveQueue.push(newItem);
    } else {
      // 否则找出被取消的从队列移除
      const removedItem = leaveQueue.find(id => !values.includes(id));
      if (removedItem) {
        const idx = leaveQueue.indexOf(removedItem);
        leaveQueue.splice(idx, 1);
      }
    }

    // 更新 Options 的 seq 和 checked
    const newOptions = leaveOptions.map(opt => {
      const idxInQueue = leaveQueue.indexOf(opt.id);
      return {
        ...opt,
        checked: values.includes(opt.id),
        seq: idxInQueue !== -1 ? (idxInQueue + 1) : ''
      };
    });

    this.setData({ leaveQueue, leaveOptions: newOptions }, () => {
      this.reCalculate();
    });
  },

  // 天数输入变化
  bindDaysInput(e) {
    const { id } = e.currentTarget.dataset;
    const val = parseInt(e.detail.value) || 0;
    const { leaveOptions } = this.data;
    const newOptions = leaveOptions.map(opt => {
      if (opt.id === id) {
        return { ...opt, currentDays: Math.min(val, opt.maxDays || 999) };
      }
      return opt;
    });
    this.setData({ leaveOptions: newOptions }, () => {
      this.reCalculate();
    });
  },

  // 重置
  clearSelection() {
    this.setData({
      startDateStr: '',
      finalEndDateStr: '',
      leaveQueue: [],
      leaveOptions: this.data.leaveOptions.map(o => ({ ...o, checked: false, seq: '' })),
      stats: { work: 0, holi: 0, week: 0 }
    });
    this.initCalendar();
  },

  // 日期点击
  handleDateClick(e) {
    const { date } = e.currentTarget.dataset;
    this.setData({ startDateStr: date }, () => {
      this.reCalculate();
    });
  },

  // 核心计算逻辑
  reCalculate() {
    const { startDateStr, leaveQueue, leaveOptions } = this.data;
    if (!startDateStr || leaveQueue.length === 0) {
      this.setData({ stats: { work: 0, holi: 0, week: 0 }, finalEndDateStr: '' });
      this.refreshCalendarUI();
      return;
    }

    let curr = new Date(startDateStr.replace(/-/g, '/') + ' 00:00:00');

    leaveQueue.forEach((type, idx) => {
      if (idx > 0) curr.setDate(curr.getDate() + 1);
      const opt = leaveOptions.find(o => o.id === type);
      const days = opt ? opt.currentDays : 0;

      if (type === 'annual') {
        // 工作日逻辑：避开节假日和周末
        let count = 0;
        let need = Math.min(days, 15);
        while (count < need) {
          const t = this.getDayType(curr);
          if (t === 'normal' || t === 'workday-override') count++;
          if (count < need) curr.setDate(curr.getDate() + 1);
        }
        // 顺延逻辑：避开非补班周末
        let nextDay = new Date(curr);
        nextDay.setDate(nextDay.getDate() + 1);
        while (this.getDayType(nextDay) === 'weekend') {
          curr.setDate(curr.getDate() + 1);
          nextDay.setDate(nextDay.getDate() + 1);
        }
      } else if (days > 0) {
        // 自然日逻辑
        curr.setDate(curr.getDate() + days - 1);
      }
    });

    const finalEndDateStr = this.formatDate(curr);
    this.setData({ finalEndDateStr }, () => {
      this.performStats();
      this.initCalendar(); // 重新按跨年需求构造日历
    });
  },

  performStats() {
    const { startDateStr, finalEndDateStr } = this.data;
    let cur = new Date(startDateStr.replace(/-/g, '/') + ' 00:00:00');
    let last = new Date(finalEndDateStr.replace(/-/g, '/') + ' 00:00:00');
    let s = { work: 0, holi: 0, week: 0 };
    while (cur <= last) {
      const t = this.getDayType(cur);
      if (t === 'holiday') s.holi++;
      else if (t === 'workday-override' || t === 'normal') s.work++;
      else s.week++;
      cur.setDate(cur.getDate() + 1);
    }
    this.setData({ stats: s });
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  // 跨年/多月日历初始化
  initCalendar() {
    const curYear = parseInt(this.data.years[this.data.selectedYearIndex]);
    let endYear = curYear;
    if (this.data.finalEndDateStr) {
      endYear = new Date(this.data.finalEndDateStr.replace(/-/g, '/') + ' 00:00:00').getFullYear();
    }

    const calendarData = [];
    for (let y = curYear; y <= endYear; y++) {
      for (let m = 0; m < 12; m++) {
        // 简单策略：如果是当前选中的年份，渲染全年。若是跨年后的年份，按需渲染或全渲染
        // 原程序是全渲染或按预测，这里我们尝试全量构造数据
        calendarData.push(this.getMonthData(y, m));
      }
    }
    this.setData({ calendarData });
  },

  getMonthData(y, m) {
    const firstDay = new Date(y, m, 1).getDay();
    const daysCount = new Date(y, m + 1, 0).getDate();
    const emptyCount = firstDay === 0 ? 6 : firstDay - 1;
    const days = [];

    for (let i = 1; i <= daysCount; i++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const type = this.getDayType(new Date(y, m, i));
      let status = '';
      if (dateStr === this.data.startDateStr || dateStr === this.data.finalEndDateStr) status = 'selected-point';
      else if (this.data.startDateStr && this.data.finalEndDateStr && dateStr > this.data.startDateStr && dateStr < this.data.finalEndDateStr) status = 'in-range';

      days.push({ day: i, date: dateStr, type, status });
    }

    return { year: y, month: m + 1, emptyCount: new Array(emptyCount).fill(0), days };
  },

  toggleAbout() {
    this.setData({ showAbout: !this.data.showAbout });
  }
});
