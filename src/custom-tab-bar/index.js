Component({
  data: {
    selected: 0,
    color: '#a9a195',
    selectedColor: '#f5c84c',
    list: [
      {
        pagePath: '/pages/index/index',
        text: '搜索'
      },
      {
        pagePath: '/pages/history/history',
        text: '历史'
      }
    ]
  },
  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const path = event.currentTarget.dataset.path
      if (!path || index === this.data.selected) {
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
