import 'viem/window' // window.ethereum(MetaMask가 주입하는 객체)의 타입 정의
import { useAccount, useConnect, useDisconnect, useReadContract, useSwitchChain } from 'wagmi'
import { mockUsdAbi } from '../contracts/generated'
import { EXPLORER_URL, IS_LOCAL, MOCK_USD_ADDRESS, NETWORK_NAME, TARGET_CHAIN } from '../network'
import { formatMusd, formatTime, shortAddress } from '../lib/format'
import { toKoreanError } from '../lib/errors'
import { useChainNow } from '../hooks/useChainNow'

/** 상단: 지갑 연결 버튼, 내 주소(축약), 내 mUSD 잔고, 네트워크 상태 */
export function Header() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, isPending, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { lastBlockTime } = useChainNow()

  // [읽기] 내 mUSD 잔고 (balanceOf는 view 함수 → 가스 없음, 서명 없음)
  const { data: balance } = useReadContract({
    address: MOCK_USD_ADDRESS,
    abi: mockUsdAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }, // 주소가 있을 때만 읽기
  })

  const hasMetaMask = typeof window !== 'undefined' && !!window.ethereum
  const wrongChain = isConnected && chainId !== TARGET_CHAIN.id

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          🥕
        </span>
        <div>
          <h1>
            <span className="brand-name">마루 당근</span>
          </h1>
          <p className="muted small brand-sub">
          {IS_LOCAL ? '로컬 Anvil 체인(31337)' : `${NETWORK_NAME}(${TARGET_CHAIN.id})`} · 마지막 블록 시각 {lastBlockTime ? formatTime(lastBlockTime) : '연결 중…'}
          </p>
        </div>
      </div>

      <div className="wallet">
        {!isConnected ? (
          <>
            <button
              className="primary"
              disabled={!hasMetaMask || isPending}
              onClick={() => connect({ connector: connectors[0] })}
            >
              {isPending ? 'MetaMask에서 승인해 주세요…' : '지갑 연결'}
            </button>
            {!hasMetaMask && <span className="error small">MetaMask 확장 프로그램을 설치해 주세요.</span>}
            {connectError && <span className="error small">{toKoreanError(connectError, 'connect')}</span>}
          </>
        ) : (
          <div className="wallet-chip">
            <div className="right">
              <div className="balance">{formatMusd(balance)} mUSD</div>
              <div className="mono small muted" title={address}>
                {shortAddress(address)}
              </div>
            </div>
            <button className="ghost" onClick={() => disconnect()}>
              연결 해제
            </button>
          </div>
        )}
      </div>

      {EXPLORER_URL && (
        <p className="muted small notice">
          ⚠️ 테스트넷이에요. 실제 자산이 든 지갑은 연결하지 마세요.{' '}
          <a href={`${EXPLORER_URL}/address/${MOCK_USD_ADDRESS}`} target="_blank" rel="noreferrer">
            Etherscan에서 컨트랙트 보기
          </a>
        </p>
      )}

      {wrongChain && (
        <div className="warn full">
          MetaMask가 다른 네트워크(chainId {chainId})에 연결돼 있어요.{' '}
          <button disabled={switching} onClick={() => switchChain({ chainId: TARGET_CHAIN.id })}>
            {NETWORK_NAME}로 전환
          </button>
        </div>
      )}
    </header>
  )
}
