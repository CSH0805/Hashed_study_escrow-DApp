import { formatTime, shortAddress } from '../../shared/lib/format'
import { formatFee, formatGas, formatGasPrice } from '../../shared/lib/gas'
import { Tag } from '../../shared/ui/Tag'
import { useDealEvents, type DealEvent } from './useDealEvents'

/** 거래 내역 타임라인 — 이벤트 로그로 "과거에 무슨 일이 있었는지" 보여준다 */
export function DealTimeline({ id }: { id: bigint }) {
  const { data: items, isLoading } = useDealEvents(id)

  return (
    <div className="timeline">
      <h3>
        거래 내역 <Tag kind="read" text="읽기 · 이벤트 로그" />
      </h3>
      {isLoading ? (
        <p className="muted small">불러오는 중…</p>
      ) : !items?.length ? (
        <p className="muted small">기록이 없어요.</p>
      ) : (
        <ol>
          {items.map((it) => (
            <TimelineItem key={it.key} item={it} />
          ))}
        </ol>
      )}
    </div>
  )
}

function TimelineItem({ item: it }: { item: DealEvent }) {
  return (
    <li>
      <div>
        <strong>{it.label}</strong> <span className="muted small">블록 #{it.blockNumber.toString()} · {formatTime(it.time)}</span>
      </div>
      <div className="small">{it.detail}</div>
      <div className="muted small">
        서명자 <span className="mono">{shortAddress(it.from)}</span> · ⛽ 가스 {formatGas(it.gasUsed)} × {formatGasPrice(it.gasPrice)} ={' '}
        {formatFee(it.fee)}
      </div>
      <div className="muted small mono" title={it.hash}>
        tx {it.hash.slice(0, 10)}…{it.hash.slice(-8)}
      </div>
    </li>
  )
}
