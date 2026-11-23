import { useMemo, useState, type ReactNode } from 'react'
import { isAddress, parseEventLogs, parseUnits, type Address } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { ESCROW_ADDRESS, MOCK_USD_ADDRESS, escrowAbi, mockUsdAbi } from '../contracts/generated'
import { MUSD_DECIMALS, formatMusd } from '../lib/format'
import { useChainNow } from '../hooks/useChainNow'
import { useTx, type TxState } from '../hooks/useTx'
import { TxStatus } from './TxStatus'

/** 유닉스 초 → <input type="datetime-local"> 값 ("2026-11-24T15:00", 내 컴퓨터 시간대 기준) */
function toLocalInput(seconds: number): string {
  const d = new Date(seconds * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 사용자가 입력한 금액 문자열 → 체인 정수 금액. 형식이 틀리면 undefined */
function parseAmount(text: string): bigint | undefined {
  try {
    return text.trim() ? parseUnits(text.trim(), MUSD_DECIMALS) : undefined
  } catch {
    return undefined
  }
}

/**
 * 거래 만들기: 1단계 approve → 2단계 createDeal
 *
 * 왜 두 번인가?
 *   에스크로 컨트랙트는 내 지갑에서 돈을 마음대로 꺼낼 수 없다.
 *   ① 토큰 컨트랙트에 "에스크로가 내 돈을 X만큼 가져가도 된다"고 승인(approve)하는 트랜잭션
 *   ② 에스크로가 그 승인을 사용해 transferFrom으로 돈을 가져가며 거래를 만드는 트랜잭션
 *   두 개는 서로 다른 컨트랙트에 보내는 별개의 트랜잭션이라 서명도 두 번, 가스도 두 번 든다.
 */
export function CreateDeal({ onCreated }: { onCreated: (id: bigint) => void }) {
  const { address } = useAccount()
  const { now } = useChainNow()
  const approveTx = useTx()
  const createTx = useTx()

  const [seller, setSeller] = useState('')
  const [amountText, setAmountText] = useState('100')
  const [deadlineText, setDeadlineText] = useState('')
  const [description, setDescription] = useState('')
  const [createdId, setCreatedId] = useState<bigint>()

  // 마감 기본값: 사용자가 아직 고르지 않았다면 "체인 시각 + 1일"
  const deadlineValue = deadlineText || (now > 0 ? toLocalInput(now + 86400) : '')

  const amount = parseAmount(amountText)
  const deadline = deadlineValue ? Math.floor(new Date(deadlineValue).getTime() / 1000) : 0

  // [읽기] 지금 에스크로에 승인해 둔 금액 (allowance는 view 함수)
  const { data: allowance } = useReadContract({
    address: MOCK_USD_ADDRESS,
    abi: mockUsdAbi,
    functionName: 'allowance',
    args: address ? [address, ESCROW_ADDRESS] : undefined,
    query: { enabled: !!address },
  })

  // 화면에서 먼저 걸러 주는 검사 (컨트랙트도 같은 규칙을 검사하지만, 서명 전에 알려 주면 친절하다)
  const problem = useMemo(() => {
    if (!address) return '먼저 지갑을 연결해 주세요.'
    if (!isAddress(seller)) return '판매자 주소를 0x로 시작하는 42자리 주소로 입력해 주세요.'
    if (seller.toLowerCase() === address.toLowerCase()) return '자기 자신을 판매자로 지정할 수 없어요.'
    if (amount === undefined) return '금액을 숫자로 입력해 주세요. (소수점 6자리까지)'
    if (amount <= 0n) return '금액은 0보다 커야 해요.'
    if (!deadline) return '마감일을 입력해 주세요.'
    if (deadline <= now) return '마감은 체인의 현재 시각보다 뒤여야 해요.'
    return null
  }, [address, seller, amount, deadline, now])

  const approved = amount !== undefined && amount > 0n && allowance !== undefined && allowance >= amount
  const busy = approveTx.busy || createTx.busy

  async function handleApprove() {
    if (amount === undefined) return
    createTx.reset()
    setCreatedId(undefined)
    // [쓰기] 토큰 컨트랙트에 보내는 트랜잭션. 무한대(max)가 아니라 "이번 거래 금액만큼만" 승인한다.
    //       → 에스크로에 문제가 생겨도 내 지갑에서 더 가져갈 수 없도록 위험을 최소화.
    await approveTx.send({
      address: MOCK_USD_ADDRESS,
      abi: mockUsdAbi,
      functionName: 'approve',
      args: [ESCROW_ADDRESS, amount],
    })
  }

  async function handleCreate() {
    if (amount === undefined) return
    // [쓰기] 에스크로 컨트랙트에 보내는 트랜잭션. 내부에서 transferFrom으로 승인된 mUSD를 가져간다.
    const receipt = await createTx.send({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: 'createDeal',
      args: [seller as Address, amount, BigInt(deadline), description],
    })
    if (!receipt) return
    // 영수증의 이벤트 로그에서 DealCreated를 찾아 새 거래 번호를 알아낸다.
    const [created] = parseEventLogs({ abi: escrowAbi, eventName: 'DealCreated', logs: receipt.logs })
    if (created) {
      setCreatedId(created.args.id)
      onCreated(created.args.id)
    }
    approveTx.reset()
  }

  return (
    <section className="card">
      <h2>거래 만들기 (구매자)</h2>

      <label>
        판매자 주소
        <input
          className="mono"
          placeholder="0x…"
          value={seller}
          onChange={(e) => setSeller(e.target.value.trim())}
          disabled={busy}
        />
      </label>
      <div className="row">
        <label>
          금액 (mUSD)
          <input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} disabled={busy} />
        </label>
        <label>
          마감일 (이 시각이 지나면 판매자가 직접 받아 갈 수 있음)
          <input type="datetime-local" value={deadlineValue} onChange={(e) => setDeadlineText(e.target.value)} disabled={busy} />
        </label>
      </div>
      <label>
        설명
        <input placeholder="예: 중고 키보드" value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
      </label>

      {problem && <p className="muted small">⚠️ {problem}</p>}

      <ol className="steps">
        <Step
          n={1}
          title="승인 (approve)"
          desc={`에스크로가 내 mUSD를 ${formatMusd(amount)}만큼 가져가도 된다고 허락 · 현재 승인액 ${formatMusd(allowance)} mUSD`}
          done={approved}
          tx={approveTx.state}
        >
          <button disabled={!!problem || busy || approved} onClick={handleApprove}>
            {approved ? '승인 완료' : '1단계 승인(approve)'}
          </button>
        </Step>
        <Step
          n={2}
          title="예치 (createDeal)"
          desc="에스크로 컨트랙트가 승인된 mUSD를 가져가 보관하고 거래를 기록"
          done={createdId !== undefined}
          tx={createTx.state}
        >
          <button className="primary" disabled={!!problem || busy || !approved} onClick={handleCreate}>
            2단계 예치(createDeal)
          </button>
        </Step>
      </ol>

      {createdId !== undefined && <p className="ok">🎉 거래 #{createdId.toString()} 이(가) 만들어졌어요. 아래 목록에서 확인하세요.</p>}
    </section>
  )
}

function Step(props: { n: number; title: string; desc: string; done: boolean; tx: TxState; children: ReactNode }) {
  const icon = props.done ? '✅' : props.tx.phase === 'error' ? '❌' : props.tx.phase === 'idle' ? '⬜' : '⏳'
  return (
    <li className={`step ${props.done ? 'done' : ''}`}>
      <div className="step-head">
        <span>
          {icon} {props.n}단계 · {props.title} <span className="tag write">쓰기 · 트랜잭션</span>
        </span>
        {props.children}
      </div>
      <div className="muted small">{props.desc}</div>
      <TxStatus state={props.tx} />
    </li>
  )
}
