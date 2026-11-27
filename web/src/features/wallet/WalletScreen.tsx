import { Tag } from '../../shared/ui/Tag'
import { FaucetCard } from './FaucetCard'
import { WalletSummary } from './WalletSummary'

/** "내 지갑" 탭: 잔고 + 테스트 코인 받기 + 학습용 표시 안내 */
export function WalletScreen({ blockNumber }: { blockNumber?: bigint }) {
  return (
    <>
      <WalletSummary />
      <FaucetCard />
      <footer className="muted small">
        최신 블록 #{blockNumber?.toString() ?? '-'}
        <br />
        <Tag kind="read" /> <Tag kind="write" /> <Tag kind="sign" />
      </footer>
    </>
  )
}
