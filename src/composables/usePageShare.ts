import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'

const SHARE_TITLE = '西瓜啃书 - 跨站找书'
const SHARE_PATH = '/pages/index/index'

type SharePath = string | (() => string)

function resolveSharePath(path: SharePath) {
  return typeof path === 'function' ? path() : path
}

export function usePageShare(path: SharePath = SHARE_PATH) {
  onShareAppMessage(() => ({
    title: SHARE_TITLE,
    path: resolveSharePath(path)
  }))

  onShareTimeline(() => {
    const sharePath = resolveSharePath(path)
    const queryIndex = sharePath.indexOf('?')

    return {
      title: SHARE_TITLE,
      query: queryIndex >= 0 ? sharePath.slice(queryIndex + 1) : ''
    }
  })

  onShow(() => {
    uni.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  })
}
