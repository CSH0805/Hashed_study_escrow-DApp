import { EmptyState } from '../../shared/ui/EmptyState'
import { DealListItem } from './DealListItem'
import { useMyDeals, type DealSide } from './useMyDeals'

/** 구매내역 또는 판매내역 목록. 비었거나 지갑이 없으면 안내를 보여준다 */
export function DealList({ side, onOpen }: { side: DealSide; onOpen: (id: bigint) => void }) {
  const { connected, items } = useMyDeals(side)

  if (!connected) return <EmptyState icon="👛">지갑을 연결하면 목록이 보여요.</EmptyState>
  if (items.length === 0) return <EmptyState icon="📦">아직 거래가 없어요.</EmptyState>

  return (
    <ul className="feed">
      {items.map(({ id, deal }) => (
        <DealListItem key={id.toString()} id={id} deal={deal} side={side} onOpen={() => onOpen(id)} />
      ))}
    </ul>
  )
}
