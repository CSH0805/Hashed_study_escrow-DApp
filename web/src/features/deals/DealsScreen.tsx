import { useState } from 'react'
import { Tag } from '../../shared/ui/Tag'
import { DealList } from './DealList'
import type { DealSide } from './useMyDeals'

/** "내 거래" 탭(홈): 구매내역 / 판매내역 전환 + 목록 + 글쓰기 버튼 */
export function DealsScreen({ onOpen, onCreate }: { onOpen: (id: bigint) => void; onCreate: () => void }) {
  const [side, setSide] = useState<DealSide>('buyer')

  return (
    <section className="card">
      <h2>
        나의 안전거래 <Tag kind="read" />
      </h2>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={side === 'buyer'} className={side === 'buyer' ? 'active' : ''} onClick={() => setSide('buyer')}>
          구매내역
        </button>
        <button role="tab" aria-selected={side === 'seller'} className={side === 'seller' ? 'active' : ''} onClick={() => setSide('seller')}>
          판매내역
        </button>
      </div>
      <DealList side={side} onOpen={onOpen} />

      {/* 중고거래 앱의 "+ 글쓰기"처럼 오른쪽 아래에 떠 있는 버튼 */}
      <button className="fab" onClick={onCreate}>
        + 안전결제
      </button>
    </section>
  )
}
