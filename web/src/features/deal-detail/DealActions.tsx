import { STATUS, type DealRole } from '../../shared/lib/dealStatus'
import { formatMusd } from '../../shared/lib/format'
import type { Deal } from './useDeal'

export type DealAction = 'release' | 'refund' | 'claimAfterDeadline'

type Props = { deal: Deal; role: DealRole; deadlinePassed: boolean; busy: boolean; onAction: (a: DealAction) => void }

/**
 * "내 역할 × 거래 상태"에 맞는 버튼만 보여준다.
 *   구매자 + 진행중 → 구매확정(release)
 *   판매자 + 진행중 → 거래 취소(refund), 마감 지나면 자동 지급 받기(claimAfterDeadline)
 *   끝난 거래       → 결과만 표시
 *
 * 주의: 버튼을 숨기는 건 "편의"일 뿐 보안이 아니다.
 *       누가 직접 cast로 호출해도 컨트랙트가 NotBuyer/NotSeller로 막아 준다. (진짜 보안은 컨트랙트에 있다)
 */
export function DealActions({ deal, role, deadlinePassed, busy, onAction }: Props) {
  if (deal.status !== STATUS.Funded) {
    return (
      <p className="result ok">
        {deal.status === STATUS.Released
          ? `✅ 판매자에게 ${formatMusd(deal.amount)} mUSD가 지급됐어요.`
          : `↩️ 구매자에게 ${formatMusd(deal.amount)} mUSD가 환불됐어요.`}
      </p>
    )
  }

  if (role === '구매자') {
    return (
      <div className="actions">
        <button className="primary block" disabled={busy} onClick={() => onAction('release')}>
          구매확정 (판매자에게 지급)
        </button>
        <p className="muted small">물건을 잘 받았다면 눌러 주세요. 되돌릴 수 없어요.</p>
      </div>
    )
  }

  if (role === '판매자') {
    return (
      <div className="actions">
        <button disabled={busy} onClick={() => onAction('refund')}>
          거래 취소 (구매자에게 환불)
        </button>
        <button className="primary" disabled={busy || !deadlinePassed} onClick={() => onAction('claimAfterDeadline')}>
          마감 지나 자동 지급 받기
        </button>
        {!deadlinePassed && (
          <p className="muted small">마감이 지나야 누를 수 있어요. 구매자가 먼저 구매확정을 하면 바로 지급돼요.</p>
        )}
      </div>
    )
  }

  return <p className="muted">이 거래의 당사자가 아니라 조회만 할 수 있어요.</p>
}
