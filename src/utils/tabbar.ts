interface CustomTabBar {
  setData(data: { selected: number; theme: 'light' | 'dark' }): void
}

interface PageWithTabBar {
  getTabBar?: () => CustomTabBar | undefined
}

export function syncTabBar(selected: number, theme: 'light' | 'dark') {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as unknown as PageWithTabBar | undefined
  currentPage?.getTabBar?.()?.setData({ selected, theme })
}
