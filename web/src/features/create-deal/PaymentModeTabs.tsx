import type { PayMode } from './useCreateDeal'

/** 방식 A(approve) / 방식 B(permit) 고르는 세그먼트 버튼 */
export function PaymentModeTabs({ mode, disabled, onChange }: { mode: PayMode; disabled: boolean; onChange: (m: PayMode) => void }) {
  return (
    <div className="tabs mode">
      <button className={mode === 'approve' ? 'active' : ''} disabled={disabled} onClick={() => onChange('approve')}>
        방식 A · approve + 예치
        <br />
        <span className="hint">트랜잭션 2번</span>
      </button>
      <button className={mode === 'permit' ? 'active' : ''} disabled={disabled} onClick={() => onChange('permit')}>
        방식 B · permit 서명 + 예치
        <br />
        <span className="hint">트랜잭션 1번</span>
      </button>
    </div>
  )
}
