import { ApproveFlow } from './ApproveFlow'
import { DealFormFields } from './DealFormFields'
import { PaymentModeTabs } from './PaymentModeTabs'
import { PermitFlow } from './PermitFlow'
import { useCreateDeal } from './useCreateDeal'
import { useDealForm } from './useDealForm'

/** "안전결제" 탭: 결제 방식 고르기 → 입력 → 단계별 실행. 만들어지면 그 거래의 상세 화면으로 이동 */
export function CreateDealScreen({ onCreated }: { onCreated: (id: bigint) => void }) {
  const form = useDealForm()
  const flow = useCreateDeal(form, onCreated)
  const blocked = !!form.problem

  return (
    <section className="card">
      <h2>안전결제로 거래 시작하기</h2>
      <p className="muted small lead">구매자가 돈을 에스크로에 맡기고, 물건을 받은 뒤 구매확정하면 판매자에게 지급돼요.</p>

      <PaymentModeTabs mode={flow.mode} disabled={flow.busy} onChange={flow.switchMode} />
      <DealFormFields form={form} disabled={flow.busy} />
      {form.problem && <p className="warn small">⚠️ {form.problem}</p>}

      {flow.mode === 'approve' ? (
        <ApproveFlow flow={flow} amount={form.values.amount} blocked={blocked} />
      ) : (
        <PermitFlow flow={flow} amount={form.values.amount} blocked={blocked} />
      )}
    </section>
  )
}
