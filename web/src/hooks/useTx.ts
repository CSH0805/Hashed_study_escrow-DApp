import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useConfig } from 'wagmi'
import { simulateContract, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import type { Abi, Address, Hash, TransactionReceipt } from 'viem'
import { anvil } from 'wagmi/chains'
import { mockUsdAbi } from '../contracts/generated'
import { toKoreanError } from '../lib/errors'

/**
 * 트랜잭션(쓰기) 한 번의 진행 상태.
 *   idle        아직 아무것도 안 함
 *   switching   MetaMask 네트워크가 Anvil이 아니라서 전환을 요청하는 중
 *   simulating  [읽기] 노드에게 "실행하면 성공해?"를 미리 물어보는 중 (가스 없음, 서명 없음)
 *   signing     MetaMask 창에서 사용자의 서명을 기다리는 중
 *   pending     전송 완료. 블록에 담기기를 기다리는 중
 *   success     블록에 담겼고 성공
 *   error       실패 (서명 거절, revert 등)
 */
export type TxPhase = 'idle' | 'switching' | 'simulating' | 'signing' | 'pending' | 'success' | 'error'

export type TxState = {
  phase: TxPhase
  hash?: Hash
  error?: string
}

type TxRequest = {
  address: Address
  abi: Abi
  functionName: string
  args?: readonly unknown[]
}

// ERC-20 오류(잔고/승인 부족)는 MockUSD에서 나지만 Escrow를 호출하다가 터진다.
// 오류 해석용 ABI에 토큰 오류도 넣어 둬야 이름(ERC20InsufficientAllowance)으로 해석할 수 있다.
const tokenErrors = mockUsdAbi.filter((item) => item.type === 'error')

/**
 * 모든 쓰기 버튼이 공통으로 쓰는 훅.
 * 순서: ① 시뮬레이션(읽기) → ② MetaMask 서명 → ③ 전송 → ④ 블록 포함 대기 → ⑤ 화면 값 새로고침
 */
export function useTx() {
  const config = useConfig()
  const { address: account, chainId } = useAccount()
  const queryClient = useQueryClient()
  const [state, setState] = useState<TxState>({ phase: 'idle' })

  async function send(req: TxRequest): Promise<TransactionReceipt | undefined> {
    if (!account) {
      setState({ phase: 'error', error: '먼저 지갑을 연결해 주세요.' })
      return
    }
    // ⓪ MetaMask가 다른 네트워크(예: 이더리움 메인넷)에 있으면 Anvil로 전환부터 요청한다.
    //    서명은 "어느 체인용 트랜잭션인지(chainId)"까지 포함하므로, 네트워크가 다르면 보낼 수 없다.
    if (chainId !== anvil.id) {
      try {
        setState({ phase: 'switching' })
        await switchChain(config, { chainId: anvil.id })
      } catch (err) {
        setState({ phase: 'error', error: toKoreanError(err, 'switch') })
        return
      }
    }
    try {
      // ① 시뮬레이션: 실패할 트랜잭션이면 여기서 미리 걸러진다 → 서명 창도 안 뜨고 가스도 안 나감.
      //    account를 꼭 넘겨야 msg.sender가 "나"로 계산된다. (안 넘기면 0x0 주소로 시뮬레이션됨)
      setState({ phase: 'simulating' })
      const { request } = await simulateContract(config, {
        ...req,
        abi: [...req.abi, ...tokenErrors],
        account,
        chainId: anvil.id,
      })

      // ② ③ MetaMask가 서명 창을 띄우고, 승인하면 서명된 트랜잭션을 Anvil에 전송한다.
      setState({ phase: 'signing' })
      const hash = await writeContract(config, request)

      // ④ 트랜잭션 해시는 "접수번호"일 뿐. 블록에 담겨야 결과가 확정된다.
      setState({ phase: 'pending', hash })
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: anvil.id })
      if (receipt.status === 'reverted') {
        setState({ phase: 'error', hash, error: '블록에는 담겼지만 실행이 실패(revert)했어요.' })
        return
      }

      setState({ phase: 'success', hash })
      // ⑤ 잔고·거래 목록 등 [읽기] 값들을 다시 읽어 오게 한다.
      await queryClient.invalidateQueries()
      return receipt
    } catch (err) {
      setState((s) => ({ ...s, phase: 'error', error: toKoreanError(err) }))
    }
  }

  const reset = () => setState({ phase: 'idle' })
  const busy = state.phase === 'switching' || state.phase === 'simulating' || state.phase === 'signing' || state.phase === 'pending'

  return { state, send, reset, busy }
}
