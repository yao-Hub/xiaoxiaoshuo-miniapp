Component({
  data: {
    selected: 0,
    theme: 'dark',
    hidden: false,
    list: [
      {
        pagePath: '/pages/index/index',
        text: '搜索'
      },
      {
        pagePath: '/pages/history/history',
        text: '历史'
      },
      {
        pagePath: '/pages/profile/profile',
        text: '我的'
      }
    ]
  },
  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const path = event.currentTarget.dataset.path
      if (index === this.data.selected) {
        return
      }

      wx.switchTab({
        url: path,
        success: () => {
          this.setData({ selected: index })
        }
      })
    }
  }
})
