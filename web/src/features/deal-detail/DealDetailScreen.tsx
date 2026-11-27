import { useAccount } from 'wagmi'
import { ESCROW_ADDRESS } from '../../config/network'
import { escrowAbi } from '../../contracts/generated'
import { ScreenHeader } from '../../layout/ScreenHeader'
import { useChainNow } from '../../shared/hooks/useChainNow'
import { useTx } from '../../shared/hooks/useTx'
import { getRole } from '../../shared/lib/dealStatus'
import { toKoreanError } from '../../shared/lib/errors'
import { TxStatus } from '../../shared/ui/TxStatus'
import { DealActions, type DealAction } from './DealActions'
import { DealSummary } from './DealSummary'
import { DealTimeline } from './DealTimeline'
import { useDeal } from './useDeal'

/** 거래 상세 화면: 요약 → 역할별 버튼 → 진행 상자 → 거래 내역 */
export function DealDetailScreen({ id, onBack }: { id: bigint; onBack: () => void }) {
  const { address } = useAccount()
  const { now } = useChainNow()
  const { deal, error } = useDeal(id)
  const tx = useTx()

  // [쓰기] 세 함수 모두 상태(status)와 잔고를 바꾸므로 트랜잭션
  const run = (functionName: DealAction) => tx.send({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName, args: [id] })

  return (
    <section className="card screen">
      <ScreenHeader title={`거래 #${id}`} onBack={onBack} />
      {error ? (
        <p className="error">{toKoreanError(error)}</p>
      ) : !deal ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <>
          <DealSummary id={id} deal={deal} role={getRole(address, deal)} now={now} />
          <DealActions
            deal={deal}
            role={getRole(address, deal)}
            deadlinePassed={now > Number(deal.deadline)} // 컨트랙트와 같은 조건: block.timestamp > deadline
            busy={tx.busy}
            onAction={run}
          />
          <TxStatus state={tx.state} />
          <DealTimeline id={id} />
        </>
      )}
    </section>
  )
}
