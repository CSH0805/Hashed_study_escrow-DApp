import { IS_LOCAL, NETWORK_NAME, TARGET_CHAIN } from '../config/network'
import { ConnectButton } from '../features/wallet/ConnectButton'
import { NetworkGuard } from '../features/wallet/NetworkGuard'
import { TestnetNotice } from '../features/wallet/TestnetNotice'
import { useChainNow } from '../shared/hooks/useChainNow'
import { formatTime } from '../shared/lib/format'

/** 위 앱 바: 로고 · 네트워크 상태 · 지갑. 화면을 내려도 위에 붙어 있다 */
export function AppBar() {
  const { lastBlockTime } = useChainNow()

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          🥕
        </span>
        <div>
          <h1 className="brand-name">마루 당근</h1>
          <p className="muted small brand-sub">
            {IS_LOCAL ? 'Anvil(31337)' : `${NETWORK_NAME}(${TARGET_CHAIN.id})`} · 블록 시각{' '}
            {lastBlockTime ? formatTime(lastBlockTime) : '연결 중…'}
          </p>
        </div>
      </div>
      <ConnectButton />
      <TestnetNotice />
      <NetworkGuard />
    </header>
  )
}
