import { useEffect, useState } from 'react'
import { useBlock } from 'wagmi'

/**
 * "체인 기준 현재 시각"(초).
 *
 * 왜 컴퓨터 시계(Date.now)를 그대로 쓰지 않나?
 *   컨트랙트는 마감을 block.timestamp(블록에 찍힌 시각)로 판정한다.
 *   Anvil에서 `cast rpc evm_increaseTime`으로 시간을 앞당기면 체인 시각이 내 컴퓨터 시계보다 앞서게 된다.
 *   그래서 화면도 "마지막 블록 시각"과 "내 시계" 중 더 늦은 쪽을 기준으로 삼는다.
 *   (다음 블록은 마지막 블록보다 이전 시각일 수 없으므로 안전한 추정치)
 */
export function useChainNow(): { now: number; lastBlockTime?: number } {
  // [읽기] 최신 블록 정보 (watch: 새 블록이 생기면 자동 갱신)
  const { data: block } = useBlock({ watch: true })
  const [wallNow, setWallNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const t = setInterval(() => setWallNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const lastBlockTime = block ? Number(block.timestamp) : undefined
  return { now: Math.max(wallNow, lastBlockTime ?? 0), lastBlockTime }
}
