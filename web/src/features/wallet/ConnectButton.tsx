import 'viem/window' // window.ethereum(MetaMask가 주입하는 객체)의 타입 정의
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { formatMusd, shortAddress } from '../../shared/lib/format'
import { toKoreanError } from '../../shared/lib/errors'
import { useMusdBalance } from './useMusdBalance'

/** 앱 바 오른쪽: 연결 전에는 "지갑 연결" 버튼, 연결 후에는 잔고·주소 칩 */
export function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const balance = useMusdBalance(address)

  const hasMetaMask = typeof window !== 'undefined' && !!window.ethereum

  if (!isConnected) {
    return (
      <div className="wallet">
        <button className="primary" disabled={!hasMetaMask || isPending} onClick={() => connect({ connector: connectors[0] })}>
          {isPending ? 'MetaMask 승인 대기…' : '지갑 연결'}
        </button>
        {!hasMetaMask && <span className="error small">MetaMask 확장 프로그램을 설치해 주세요.</span>}
        {error && <span className="error small">{toKoreanError(error, 'connect')}</span>}
      </div>
    )
  }

  return (
    <div className="wallet-chip">
      <div className="right">
        <div className="balance">{formatMusd(balance)} mUSD</div>
        <div className="mono small muted" title={address}>
          {shortAddress(address)}
        </div>
      </div>
      <button className="ghost" onClick={() => disconnect()}>
        해제
      </button>
    </div>
  )
}
