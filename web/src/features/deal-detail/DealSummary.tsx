import { formatDuration, formatMusd, formatTime } from '../../shared/lib/format'
import { STATUS, type DealRole } from '../../shared/lib/dealStatus'
import { StatusBadge } from '../../shared/ui/StatusBadge'
import type { Deal } from './useDeal'

const ROLE_ICON: Record<DealRole, string> = { 구매자: '🛒', 판매자: '🏷️', 제3자: '👀' }

/** 상품 상세 화면처럼: 내 역할 → 제목·가격 → 구매자/판매자/마감 */
export function DealSummary({ id, deal, role, now }: { id: bigint; deal: Deal; role: DealRole; now: number }) {
  const deadlinePassed = now > Number(deal.deadline)

  return (
    <>
      <div className="profile">
        <span className="avatar" aria-hidden>
          {ROLE_ICON[role]}
        </span>
        <div className="profile-body">
          <strong>나는 {role}</strong>
          <div className="muted small">
            거래 #{id.toString()} · {deal.status === STATUS.Funded ? '에스크로 컨트랙트가 돈을 보관 중' : '거래가 끝났어요'}
          </div>
        </div>
      </div>

      <p className="detail-title">
        <StatusBadge status={deal.status} /> {deal.description || <span className="muted">(설명 없음)</span>}
      </p>
      <p className="detail-price">{formatMusd(deal.amount)} mUSD</p>

      <dl className="detail">
        <dt>구매자</dt>
        <dd className="mono">{deal.buyer}</dd>
        <dt>판매자</dt>
        <dd className="mono">{deal.seller}</dd>
        <dt>마감</dt>
        <dd>
          {formatTime(deal.deadline)}{' '}
          <span className="muted small">
            {deadlinePassed ? '(마감 지남)' : `(${formatDuration(Number(deal.deadline) - now)} 남음)`}
          </span>
        </dd>
      </dl>
    </>
  )
}
