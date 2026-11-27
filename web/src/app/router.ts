import { useEffect, useState } from 'react'

/**
 * 아주 작은 화면 전환기 (주소창의 # 뒤를 화면 이름으로 씀).
 *   #/             → 내 거래 (홈)
 *   #/create       → 안전결제 만들기
 *   #/wallet       → 내 지갑
 *   #/deal/3       → 거래 #3 상세
 *
 * 왜 #을 쓰나? 서버 설정 없이도 새로고침·뒤로 가기가 그대로 동작해서, 정적 호스팅(Vercel 등)에 올려도 안전하다.
 * 휴대폰의 "뒤로" 제스처로 상세 → 목록으로 돌아가는 앱 같은 동작도 이 덕분에 된다.
 */
export type Route = { name: 'home' } | { name: 'create' } | { name: 'wallet' } | { name: 'deal'; id: bigint }

export type TabName = 'home' | 'create' | 'wallet'

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  const deal = path.match(/^deal\/(\d+)$/)
  if (deal) return { name: 'deal', id: BigInt(deal[1]) }
  if (path === 'create') return { name: 'create' }
  if (path === 'wallet') return { name: 'wallet' }
  return { name: 'home' }
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'deal':
      return `#/deal/${route.id}`
    default:
      return `#/${route.name}`
  }
}

/** 지금 화면과, 다른 화면으로 가는 함수 */
// 이 앱 안에서 화면을 한 번이라도 옮겼는지. "뒤로"가 앱 밖(이전 사이트)으로 나가지 않게 하는 데 쓴다.
let movedInApp = false

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo({ top: 0 }) // 화면이 바뀌면 맨 위부터 (앱처럼)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const go = (next: Route) => {
    movedInApp = true
    window.location.hash = toHash(next)
  }
  /** 앱 안에서 온 화면이면 뒤로, 상세 주소로 바로 들어왔다면 홈으로 */
  const back = () => {
    if (movedInApp) window.history.back()
    else go({ name: 'home' })
  }

  return { route, go, back }
}
