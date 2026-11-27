import { useAccount } from 'wagmi'
import { formatMusd } from '../../shared/lib/format'
import { Tag } from '../../shared/ui/Tag'
import { useMusdBalance } from './useMusdBalance'

/** 내 지갑 카드: 잔고를 크게, 전체 주소는 아래에 */
export function WalletSummary() {
  const { address } = useAccount()
  const balance = useMusdBalance(address)

  return (
    <section className="card">
      <h2>
        내 지갑 <Tag kind="read" />
      </h2>
      {address ? (
        <div className="wallet-card">
          <div className="muted small">mUSD 잔고</div>
          <div className="wallet-balance">{formatMusd(balance)} mUSD</div>
          <div className="mono small muted break">{address}</div>
        </div>
      ) : (
        <p className="muted">위의 "지갑 연결"을 눌러 주세요.</p>
      )}
    </section>
  )
}
