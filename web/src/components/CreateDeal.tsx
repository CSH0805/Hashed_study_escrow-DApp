import { useMemo, useState, type ReactNode } from 'react'
import { isAddress, parseEventLogs, parseUnits, type Address } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { escrowAbi, mockUsdAbi } from '../contracts/generated'
import { ESCROW_ADDRESS, MOCK_USD_ADDRESS } from '../network'
import { MUSD_DECIMALS, formatMusd } from '../lib/format'
import { useChainNow } from '../hooks/useChainNow'
import { useTx, type TxState } from '../hooks/useTx'
import { usePermitSign } from '../hooks/usePermit'
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
 * 거래 만들기 — 두 가지 방식
 *   방식 A: 1단계 approve(트랜잭션) → 2단계 createDeal(트랜잭션)          → 트랜잭션 2번
 *   방식 B: 1단계 permit 서명(가스 없음) → 2단계 createDealWithPermit(트랜잭션) → 트랜잭션 1번
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
  const permit = usePermitSign()
  const [mode, setMode] = useState<'approve' | 'permit'>('approve')

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
  const busy = approveTx.busy || createTx.busy || permit.busy

  // 방식 B: 지금 가진 서명이 "지금 입력한 금액·지금 계정·현재 nonce·유효기한 내"에 대한 것인지.
  // 서명은 내용 전체를 묶기 때문에 금액을 1이라도 바꾸면 그 서명은 쓸 수 없다.
  const sig = permit.signature
  const signed =
    !!sig &&
    sig.owner === address &&
    sig.amount === amount &&
    sig.nonce === permit.nonce &&
    Number(sig.permitDeadline) > now

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

  async function handlePermitSign() {
    if (amount === undefined) return
    createTx.reset()
    setCreatedId(undefined)
    // [서명 · 가스 없음] 서명 유효기한: 체인 시각 기준 20분 뒤 (evm_increaseTime으로 체인 시간이 앞서 있을 수 있어서)
    await permit.sign(amount, BigInt(now + 20 * 60))
  }

  async function handleCreate() {
    if (amount === undefined) return
    // [쓰기] 에스크로 컨트랙트에 보내는 트랜잭션. 내부에서 transferFrom으로 승인된 mUSD를 가져간다.
    //   방식 A: createDeal            — 이미 approve된 금액을 사용
    //   방식 B: createDealWithPermit  — 서명(v, r, s)을 함께 실어 보내서, 컨트랙트 안에서 approve까지 처리
    const receipt =
      mode === 'permit' && sig
        ? await createTx.send({
            address: ESCROW_ADDRESS,
            abi: escrowAbi,
            functionName: 'createDealWithPermit',
            args: [seller as Address, amount, BigInt(deadline), description, sig.permitDeadline, sig.v, sig.r, sig.s],
          })
        : await createTx.send({
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
    permit.reset()
  }

  function switchMode(next: 'approve' | 'permit') {
    setMode(next)
    approveTx.reset()
    createTx.reset()
    permit.reset()
    setCreatedId(undefined)
  }

  return (
    <section className="card">
      <h2>안전결제로 거래 시작하기</h2>
      <p className="muted small lead">
        구매자가 돈을 에스크로에 맡기고, 물건을 받은 뒤 구매확정하면 판매자에게 지급돼요.
      </p>

      <div className="tabs mode">
        <button className={mode === 'approve' ? 'active' : ''} disabled={busy} onClick={() => switchMode('approve')}>
          방식 A · approve + 예치
          <br />
          <span className="hint">트랜잭션 2번</span>
        </button>
        <button className={mode === 'permit' ? 'active' : ''} disabled={busy} onClick={() => switchMode('permit')}>
          방식 B · permit 서명 + 예치
          <br />
          <span className="hint">트랜잭션 1번</span>
        </button>
      </div>

      <label>
        <span>
          판매자 지갑 주소 <span className="hint">0x로 시작하는 42자리</span>
        </span>
        <input
          className="mono"
          placeholder="0x…"
          value={seller}
          onChange={(e) => setSeller(e.target.value.trim())}
          disabled={busy}
        />
      </label>
      <label>
        <span>
          거래 물건 <span className="hint">목록에 제목으로 보여요</span>
        </span>
        <input placeholder="예: 중고 키보드" value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
      </label>
      <label>
        가격
        <div className="price-input">
          <input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} disabled={busy} />
          <span className="unit">mUSD</span>
        </div>
      </label>
      <label>
        <span>
          마감일 <span className="hint">이 시각이 지나면 판매자가 직접 받아 갈 수 있어요</span>
        </span>
        <input type="datetime-local" value={deadlineValue} onChange={(e) => setDeadlineText(e.target.value)} disabled={busy} />
      </label>

      {problem && <p className="warn small">⚠️ {problem}</p>}

      {mode === 'approve' ? (
        <ol className="steps">
          <Step
            n={1}
            kind="write"
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
            kind="write"
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
      ) : (
        <ol className="steps">
          <Step
            n={1}
            kind="sign"
            title="permit 서명"
            desc={`"에스크로가 내 mUSD를 ${formatMusd(amount)}만큼 가져가도 된다"는 메시지에 서명 · 네트워크로 아무것도 보내지 않아요 · permit nonce ${permit.nonce?.toString() ?? '-'}`}
            done={signed}
            tx={permit.state}
            successText="서명 완료! 가스 0 · 블록에 기록되지 않음 · 아직 체인에서는 아무 일도 일어나지 않았어요."
          >
            <button disabled={!!problem || busy || signed} onClick={handlePermitSign}>
              {signed ? '서명 완료' : '1단계 서명(permit)'}
            </button>
          </Step>
          <Step
            n={2}
            kind="write"
            title="예치 (createDealWithPermit)"
            desc="서명을 실어 보내면 컨트랙트가 서명을 검증해 승인 처리 → 곧바로 mUSD를 가져가 거래를 기록"
            done={createdId !== undefined}
            tx={createTx.state}
          >
            <button className="primary" disabled={!!problem || busy || !signed} onClick={handleCreate}>
              2단계 예치(createDealWithPermit)
            </button>
          </Step>
          {sig && !signed && permit.state.phase === 'success' && (
            <p className="muted small">⚠️ 서명한 뒤 금액이 바뀌었거나 서명 유효기한(20분)이 지나서, 다시 서명해야 해요.</p>
          )}
        </ol>
      )}

      {createdId !== undefined && <p className="result ok">🎉 거래 #{createdId.toString()} 이(가) 만들어졌어요. 위 "나의 안전거래"에서 확인하세요.</p>}
    </section>
  )
}

function Step(props: {
  n: number
  kind: 'write' | 'sign'
  title: string
  desc: string
  done: boolean
  tx: TxState
  successText?: string
  children: ReactNode
}) {
  const icon = props.done ? '✅' : props.tx.phase === 'error' ? '❌' : props.tx.phase === 'idle' ? '⬜' : '⏳'
  return (
    <li className={`step ${props.done ? 'done' : ''}`}>
      <div className="step-head">
        <span>
          {icon} {props.n}단계 · {props.title}{' '}
          {props.kind === 'write' ? (
            <span className="tag write">쓰기 · 트랜잭션</span>
          ) : (
            <span className="tag sign">서명 · 가스 없음</span>
          )}
        </span>
        {props.children}
      </div>
      <div className="muted small">{props.desc}</div>
      <TxStatus state={props.tx} successText={props.successText} />
    </li>
  )
}
