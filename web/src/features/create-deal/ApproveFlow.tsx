import { formatMusd } from '../../shared/lib/format'
import { Step } from '../../shared/ui/Step'
import type { CreateDealFlow } from './useCreateDeal'

/** 방식 A: ① approve 트랜잭션 → ② createDeal 트랜잭션 */
export function ApproveFlow({ flow, amount, blocked }: { flow: CreateDealFlow; amount?: bigint; blocked: boolean }) {
  return (
    <ol className="steps">
      <Step
        n={1}
        kind="write"
        title="승인 (approve)"
        desc={`에스크로가 내 mUSD를 ${formatMusd(amount)}만큼 가져가도 된다고 허락 · 현재 승인액 ${formatMusd(flow.allowance)} mUSD`}
        done={flow.approved}
        tx={flow.approveTx.state}
      >
        <button disabled={blocked || flow.busy || flow.approved} onClick={flow.approve}>
          {flow.approved ? '승인 완료' : '1단계 승인(approve)'}
        </button>
      </Step>
      <Step
        n={2}
        kind="write"
        title="예치 (createDeal)"
        desc="에스크로 컨트랙트가 승인된 mUSD를 가져가 보관하고 거래를 기록"
        done={flow.createdId !== undefined}
        tx={flow.createTx.state}
      >
        <button className="primary" disabled={blocked || flow.busy || !flow.approved} onClick={flow.create}>
          2단계 예치(createDeal)
        </button>
      </Step>
    </ol>
  )
}
