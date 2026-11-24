import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useConfig } from 'wagmi'
import { simulateContract, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import type { Abi, Address, Hash, TransactionReceipt } from 'viem'
import { IS_LOCAL, NETWORK_NAME, TARGET_CHAIN } from '../network'
import { mockUsdAbi } from '../contracts/generated'
import { toKoreanError } from '../lib/errors'

/**
 * 트랜잭션(쓰기) 한 번의 진행 상태.
 *   idle        아직 아무것도 안 함
 *   switching   MetaMask 네트워크가 대상 체인(Anvil/Sepolia)이 아니라서 전환을 요청하는 중
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
  /** 성공 시 영수증에서 꺼낸 실제 사용 가스량과 수수료(wei) — 10강 가스 */
  gasUsed?: bigint
  fee?: bigint
  blockNumber?: bigint
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
    // ⓪ MetaMask가 다른 네트워크(예: 이더리움 메인넷)에 있으면 대상 체인으로 전환부터 요청한다.
    //    서명은 "어느 체인용 트랜잭션인지(chainId)"까지 포함하므로, 네트워크가 다르면 보낼 수 없다.
    if (chainId !== TARGET_CHAIN.id) {
      try {
        setState({ phase: 'switching' })
        await switchChain(config, { chainId: TARGET_CHAIN.id })
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
        chainId: TARGET_CHAIN.id,
      })

      // ② ③ MetaMask가 서명 창을 띄우고, 승인하면 서명된 트랜잭션을 노드에 전송한다.
      setState({ phase: 'signing' })
      const hash = await writeContract(config, request)

      // ④ 트랜잭션 해시는 "접수번호"일 뿐. 블록에 담겨야 결과가 확정된다.
      setState({ phase: 'pending', hash })
      // 로컬 Anvil은 보통 1초 안에 블록에 담는다. 15초가 지나도 안 되면 거의 항상 nonce 꼬임
      // (Anvil을 재시작했는데 MetaMask가 예전 nonce로 보내서, Anvil이 앞 번호를 기다리며 대기열에 넣어 둔 상태)이다.
      // Sepolia는 블록이 12초마다 생기고, 가스 가격이 낮게 잡히면 몇 분씩 기다리기도 해서 3분까지 기다린다.
      const timeout = IS_LOCAL ? 15_000 : 180_000
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: TARGET_CHAIN.id, timeout }).catch(
        (err: unknown) => {
          if (err instanceof Error && err.name === 'WaitForTransactionReceiptTimeoutError') {
            throw new Error(
              IS_LOCAL
                ? '15초가 지나도 블록에 담기지 않았어요. Anvil을 재시작해서 MetaMask가 예전 nonce로 보낸 것 같아요. 터미널의 web/ 폴더에서 `npm run fix-nonce`를 실행하고 새로고침해 주세요. (또는 MetaMask 설정에서 "논스"를 검색해 "활동 및 논스 데이터 지우기")'
                : `3분이 지나도 ${NETWORK_NAME} 블록에 담기지 않았어요. 네트워크가 붐비는 중일 수 있어요. 아래 tx 링크(Etherscan)에서 상태를 확인하고, 담기면 새로고침해 주세요.`,
            )
          }
          throw err
        },
      )
      if (receipt.status === 'reverted') {
        setState({ phase: 'error', hash, error: '블록에는 담겼지만 실행이 실패(revert)했어요.' })
        return
      }

      // 실제 수수료 = 사용한 가스량(gasUsed) × 실제 가스 가격(effectiveGasPrice)
      setState({
        phase: 'success',
        hash,
        gasUsed: receipt.gasUsed,
        fee: receipt.gasUsed * receipt.effectiveGasPrice,
        blockNumber: receipt.blockNumber,
      })
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
