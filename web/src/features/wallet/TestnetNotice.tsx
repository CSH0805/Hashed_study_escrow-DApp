import { EXPLORER_URL, MOCK_USD_ADDRESS } from '../../config/network'

/** 공개 테스트넷(Sepolia)에서만: 실제 자산 지갑 연결 금지 경고 + Etherscan 링크. Anvil에서는 안 그림 */
export function TestnetNotice() {
  if (!EXPLORER_URL) return null
  return (
    <p className="muted small notice">
      ⚠️ 테스트넷이에요. 실제 자산이 든 지갑은 연결하지 마세요.{' '}
      <a href={`${EXPLORER_URL}/address/${MOCK_USD_ADDRESS}`} target="_blank" rel="noreferrer">
        Etherscan에서 컨트랙트 보기
      </a>
    </p>
  )
}
