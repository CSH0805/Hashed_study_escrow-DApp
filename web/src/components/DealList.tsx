import { useState } from 'react'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { ESCROW_ADDRESS, escrowAbi } from '../contracts/generated'
import { STATUS_LABEL, formatMusd, formatTime, shortAddress } from '../lib/format'

type Tab = 'buyer' | 'seller'

/**
 * 내 거래 목록. 전부 [읽기](view 함수)라 가스도 서명도 필요 없다.
 *   ① getDealIdsByBuyer / getDealIdsBySeller 로 거래 번호 목록을 읽고
 *   ② 번호마다 getDeal(id) 를 한꺼번에(multicall) 읽는다
 * 블록체인에는 "WHERE buyer = 나" 같은 검색이 없어서, 컨트랙트가 미리 만들어 둔 주소별 번호 목록을 이용한다.
 */
export function DealList({ selectedId, onSelect }: { selectedId?: bigint; onSelect: (id: bigint) => void }) {
  const { address } = useAccount()
  const [tab, setTab] = useState<Tab>('buyer')

  // [읽기] ① 거래 번호 목록
  const { data: ids } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: tab === 'buyer' ? 'getDealIdsByBuyer' : 'getDealIdsBySeller',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // [읽기] ② 각 거래의 상세 내용 (최신 거래가 위로 오게 뒤집음)
  const sortedIds = [...(ids ?? [])].reverse()
  const { data: deals } = useReadContracts({
    contracts: sortedIds.map((id) => ({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: 'getDeal',
      args: [id],
    }) as const),
    query: { enabled: sortedIds.length > 0 },
  })

  return (
    <section className="card">
      <h2>
        내 거래 목록 <span className="tag read">읽기 · 가스 없음</span>
      </h2>
      <div className="tabs">
        <button className={tab === 'buyer' ? 'active' : ''} onClick={() => setTab('buyer')}>
          내가 구매자인 거래
        </button>
        <button className={tab === 'seller' ? 'active' : ''} onClick={() => setTab('seller')}>
          내가 판매자인 거래
        </button>
      </div>

      {!address ? (
        <p className="muted">지갑을 연결하면 목록이 보여요.</p>
      ) : sortedIds.length === 0 ? (
        <p className="muted">아직 거래가 없어요.</p>
      ) : (
        <table className="deals">
          <thead>
            <tr>
              <th>#</th>
              <th>{tab === 'buyer' ? '판매자' : '구매자'}</th>
              <th>금액</th>
              <th>마감</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {sortedIds.map((id, i) => {
              const deal = deals?.[i]?.result
              return (
                <tr key={id.toString()} className={selectedId === id ? 'selected' : ''} onClick={() => onSelect(id)}>
                  <td>{id.toString()}</td>
                  <td className="mono">{deal ? shortAddress(tab === 'buyer' ? deal.seller : deal.buyer) : '…'}</td>
                  <td>{deal ? `${formatMusd(deal.amount)} mUSD` : '…'}</td>
                  <td className="small">{deal ? formatTime(deal.deadline) : '…'}</td>
                  <td>{deal ? <span className={`badge s${deal.status}`}>{STATUS_LABEL[deal.status]}</span> : '…'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
