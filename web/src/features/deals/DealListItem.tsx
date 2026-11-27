import { formatMusd, formatTime, shortAddress } from '../../shared/lib/format'
import { STATUS_ICON } from '../../shared/lib/dealStatus'
import { StatusBadge } from '../../shared/ui/StatusBadge'
import type { DealSide } from './useMyDeals'

type Deal = { buyer: string; seller: string; amount: bigint; deadline: bigint; description: string; status: number }

/** 목록 한 줄: 중고거래 앱의 상품 카드처럼 [썸네일 | 제목·상대방·마감·가격] */
export function DealListItem({ id, deal, side, onOpen }: { id: bigint; deal?: Deal; side: DealSide; onOpen: () => void }) {
  const counterpart = deal ? (side === 'buyer' ? deal.seller : deal.buyer) : undefined

  return (
    <li>
      <button className="feed-item" onClick={onOpen}>
        {/* 상품 사진 자리: 거래 상태를 아이콘으로 */}
        <div className="thumb" aria-hidden>
          {deal ? STATUS_ICON[deal.status] : '…'}
        </div>
        <div className="feed-body">
          <div className="feed-title">{deal ? deal.description || `거래 #${id}` : '불러오는 중…'}</div>
          <div className="feed-meta">
            #{id.toString()} · {side === 'buyer' ? '판매자' : '구매자'} <span className="mono">{shortAddress(counterpart)}</span>
          </div>
          <div className="feed-meta">마감 {deal ? formatTime(deal.deadline) : '…'}</div>
          <div className="feed-price">
            {deal && <StatusBadge status={deal.status} />}
            {deal ? `${formatMusd(deal.amount)} mUSD` : '…'}
          </div>
        </div>
      </button>
    </li>
  )
}
