import { useAccount, useReadContract } from 'wagmi'
import { ESCROW_ADDRESS, escrowAbi } from '../contracts/generated'
import { STATUS, STATUS_LABEL, formatDuration, formatMusd, formatTime } from '../lib/format'
import { toKoreanError } from '../lib/errors'
import { useChainNow } from '../hooks/useChainNow'
import { useTx } from '../hooks/useTx'
import { TxStatus } from './TxStatus'

/**
 * 거래 상세: "내 역할 × 거래 상태"에 맞는 버튼만 보여준다.
 *   구매자 + 진행중 → 구매확정(release)
 *   판매자 + 진행중 → 거래 취소(refund), 마감 지나면 자동 지급 받기(claimAfterDeadline)
 *   끝난 거래       → 결과만 표시
 *
 * 주의: 버튼을 숨기는 건 "편의"일 뿐 보안이 아니다.
 *       누가 직접 cast로 호출해도 컨트랙트가 NotBuyer/NotSeller로 막아 준다. (진짜 보안은 컨트랙트에 있다)
 */
export function DealDetail({ id }: { id: bigint }) {
  const { address } = useAccount()
  const { now } = useChainNow()
  const tx = useTx()

  // [읽기] getDeal(id)
  const { data: deal, error } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'getDeal',
    args: [id],
  })

  if (error) return <section className="card error">{toKoreanError(error)}</section>
  if (!deal) return <section className="card muted">거래 #{id.toString()} 불러오는 중…</section>

  const me = address?.toLowerCase()
  const role = me === deal.buyer.toLowerCase() ? '구매자' : me === deal.seller.toLowerCase() ? '판매자' : '제3자'
  const funded = deal.status === STATUS.Funded
  const deadlinePassed = now > Number(deal.deadline) // 컨트랙트와 같은 조건: block.timestamp > deadline

  // [쓰기] 세 함수 모두 상태(status)와 잔고를 바꾸므로 트랜잭션
  const call = (functionName: 'release' | 'refund' | 'claimAfterDeadline') =>
    tx.send({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName, args: [id] })

  return (
    <section className="card">
      <h2>
        거래 #{id.toString()} 상세 <span className={`badge s${deal.status}`}>{STATUS_LABEL[deal.status]}</span>
      </h2>

      <dl className="detail">
        <dt>내 역할</dt>
        <dd>
          <strong>{role}</strong>
        </dd>
        <dt>구매자</dt>
        <dd className="mono">{deal.buyer}</dd>
        <dt>판매자</dt>
        <dd className="mono">{deal.seller}</dd>
        <dt>금액</dt>
        <dd>{formatMusd(deal.amount)} mUSD</dd>
        <dt>마감</dt>
        <dd>
          {formatTime(deal.deadline)}{' '}
          <span className="muted small">
            {deadlinePassed ? '(마감 지남)' : `(${formatDuration(Number(deal.deadline) - now)} 남음)`}
          </span>
        </dd>
        <dt>설명</dt>
        <dd>{deal.description || <span className="muted">(없음)</span>}</dd>
      </dl>

      {/* 끝난 거래: 결과만 */}
      {!funded && (
        <p className="ok">
          {deal.status === STATUS.Released
            ? `✅ 판매자에게 ${formatMusd(deal.amount)} mUSD가 지급됐어요.`
            : `↩️ 구매자에게 ${formatMusd(deal.amount)} mUSD가 환불됐어요.`}
        </p>
      )}

      {/* 구매자 + 진행중 */}
      {funded && role === '구매자' && (
        <div className="actions">
          <button className="primary" disabled={tx.busy} onClick={() => call('release')}>
            구매확정 (판매자에게 지급)
          </button>
          <p className="muted small">물건을 잘 받았다면 눌러 주세요. 되돌릴 수 없어요.</p>
        </div>
      )}

      {/* 판매자 + 진행중 */}
      {funded && role === '판매자' && (
        <div className="actions">
          <button disabled={tx.busy} onClick={() => call('refund')}>
            거래 취소 (구매자에게 환불)
          </button>
          <button className="primary" disabled={tx.busy || !deadlinePassed} onClick={() => call('claimAfterDeadline')}>
            마감 지나 자동 지급 받기
          </button>
          {!deadlinePassed && (
            <p className="muted small">마감이 지나야 누를 수 있어요. 구매자가 먼저 구매확정을 하면 바로 지급돼요.</p>
          )}
        </div>
      )}

      {funded && role === '제3자' && <p className="muted">이 거래의 당사자가 아니라 조회만 할 수 있어요.</p>}

      <TxStatus state={tx.state} />
    </section>
  )
}
