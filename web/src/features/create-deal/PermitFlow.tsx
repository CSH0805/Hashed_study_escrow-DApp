import { formatMusd } from '../../shared/lib/format'
import { Step } from '../../shared/ui/Step'
import type { CreateDealFlow } from './useCreateDeal'

/** 방식 B: ① permit 서명(가스 없음) → ② createDealWithPermit 트랜잭션 */
export function PermitFlow({ flow, amount, blocked }: { flow: CreateDealFlow; amount?: bigint; blocked: boolean }) {
  const { permit } = flow
  return (
    <ol className="steps">
      <Step
        n={1}
        kind="sign"
        title="permit 서명"
        desc={`"에스크로가 내 mUSD를 ${formatMusd(amount)}만큼 가져가도 된다"는 메시지에 서명 · 네트워크로 아무것도 보내지 않아요 · permit nonce ${permit.nonce?.toString() ?? '-'}`}
        done={flow.signed}
        tx={permit.state}
        successText="서명 완료! 가스 0 · 블록에 기록되지 않음 · 아직 체인에서는 아무 일도 일어나지 않았어요."
      >
        <button disabled={blocked || flow.busy || flow.signed} onClick={flow.signPermit}>
          {flow.signed ? '서명 완료' : '1단계 서명(permit)'}
        </button>
      </Step>
      <Step
        n={2}
        kind="write"
        title="예치 (createDealWithPermit)"
        desc="서명을 실어 보내면 컨트랙트가 서명을 검증해 승인 처리 → 곧바로 mUSD를 가져가 거래를 기록"
        done={flow.createdId !== undefined}
        tx={flow.createTx.state}
      >
        <button className="primary" disabled={blocked || flow.busy || !flow.signed} onClick={flow.create}>
          2단계 예치(createDealWithPermit)
        </button>
      </Step>
      {flow.sig && !flow.signed && permit.state.phase === 'success' && (
        <p className="muted small">⚠️ 서명한 뒤 금액이 바뀌었거나 서명 유효기한(20분)이 지나서, 다시 서명해야 해요.</p>
      )}
    </ol>
  )
}
