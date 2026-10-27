interface CustomTabBar {
  setData(data: { selected: number }): void
}

interface PageWithTabBar {
  getTabBar?: () => CustomTabBar | undefined
}

export function syncTabBar(selected: number) {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as unknown as PageWithTabBar | undefined
  currentPage?.getTabBar?.()?.setData({ selected })
}
