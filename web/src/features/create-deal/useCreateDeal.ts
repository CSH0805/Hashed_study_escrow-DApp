import { useState } from 'react'
import { parseEventLogs } from 'viem'
import { useAccount } from 'wagmi'
import { ESCROW_ADDRESS, MOCK_USD_ADDRESS } from '../../config/network'
import { escrowAbi, mockUsdAbi } from '../../contracts/generated'
import { usePermitSign } from '../../shared/hooks/usePermitSign'
import { useTx } from '../../shared/hooks/useTx'
import { useAllowance } from './useAllowance'
import type { DealForm } from './useDealForm'

export type PayMode = 'approve' | 'permit'

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
export function useCreateDeal(form: DealForm, onCreated: (id: bigint) => void) {
  const { address } = useAccount()
  const allowance = useAllowance()
  const approveTx = useTx()
  const createTx = useTx()
  const permit = usePermitSign()
  const [mode, setMode] = useState<PayMode>('approve')
  const [createdId, setCreatedId] = useState<bigint>()

  const { amount, seller, deadline, description } = form.values
  const busy = approveTx.busy || createTx.busy || permit.busy

  // 방식 A: 이번 금액 이상 승인돼 있으면 1단계 완료
  const approved = amount !== undefined && amount > 0n && allowance !== undefined && allowance >= amount

  // 방식 B: 지금 가진 서명이 "지금 입력한 금액·지금 계정·현재 nonce·유효기한 내"에 대한 것인지.
  // 서명은 내용 전체를 묶기 때문에 금액을 1이라도 바꾸면 그 서명은 쓸 수 없다.
  const sig = permit.signature
  const signed =
    !!sig && sig.owner === address && sig.amount === amount && sig.nonce === permit.nonce && Number(sig.permitDeadline) > form.now

  function resetAll() {
    approveTx.reset()
    createTx.reset()
    permit.reset()
    setCreatedId(undefined)
  }

  async function approve() {
    if (amount === undefined) return
    createTx.reset()
    setCreatedId(undefined)
    // [쓰기] 토큰 컨트랙트에 보내는 트랜잭션. 무한대(max)가 아니라 "이번 거래 금액만큼만" 승인한다.
    //       → 에스크로에 문제가 생겨도 내 지갑에서 더 가져갈 수 없도록 위험을 최소화.
    await approveTx.send({ address: MOCK_USD_ADDRESS, abi: mockUsdAbi, functionName: 'approve', args: [ESCROW_ADDRESS, amount] })
  }

  async function signPermit() {
    if (amount === undefined) return
    createTx.reset()
    setCreatedId(undefined)
    // [서명 · 가스 없음] 서명 유효기한: 체인 시각 기준 20분 뒤 (evm_increaseTime으로 체인 시간이 앞서 있을 수 있어서)
    await permit.sign(amount, BigInt(form.now + 20 * 60))
  }

  async function create() {
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
            args: [seller, amount, deadline, description, sig.permitDeadline, sig.v, sig.r, sig.s],
          })
        : await createTx.send({
            address: ESCROW_ADDRESS,
            abi: escrowAbi,
            functionName: 'createDeal',
            args: [seller, amount, deadline, description],
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

  function switchMode(next: PayMode) {
    setMode(next)
    resetAll()
  }

  return { mode, switchMode, busy, allowance, approved, signed, sig, createdId, approveTx, createTx, permit, approve, signPermit, create }
}

export type CreateDealFlow = ReturnType<typeof useCreateDeal>
