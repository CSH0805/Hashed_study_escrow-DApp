import { useState } from 'react'
import { parseSignature, type Address, type Hex } from 'viem'
import { useAccount, useConfig, useReadContract } from 'wagmi'
import { signTypedData, switchChain } from 'wagmi/actions'
import { mockUsdAbi } from '../../contracts/generated'
import { ESCROW_ADDRESS, MOCK_USD_ADDRESS, TARGET_CHAIN } from '../../config/network'
import { toKoreanError } from '../lib/errors'
import type { TxState } from './useTx'

/** 지갑이 만들어 준 permit 서명과, 그 서명이 "무엇에 대한" 서명인지 */
export type PermitSignature = {
  owner: Address
  amount: bigint
  nonce: bigint
  permitDeadline: bigint
  v: number
  r: Hex
  s: Hex
}

/**
 * permit(EIP-2612) 서명 만들기.
 *
 * 트랜잭션과의 차이:
 *   - 트랜잭션: 서명 + 네트워크 전송 → 블록에 기록, 가스 소모, nonce(계정) 증가
 *   - 이 서명: 지갑 안에서 "메시지"에 서명만 함 → 네트워크에 아무것도 안 보냄, 가스 0, 블록에 안 남음
 *   만들어진 서명(v, r, s)은 그냥 데이터일 뿐이고, 나중에 createDealWithPermit 트랜잭션에 실려서야 효력이 생긴다.
 *
 * EIP-712(signTypedData): 지갑이 알 수 없는 16진수 덩어리 대신 "owner / spender / value / deadline" 같은
 *   항목을 사람이 읽을 수 있게 보여 주고 서명하는 표준. 피싱 사이트가 "무한 승인" 서명을 받아 가는 사고가 많으므로
 *   실제 지갑에서는 서명 창의 spender와 value를 꼭 확인해야 한다.
 */
export function usePermitSign() {
  const config = useConfig()
  const { address, chainId } = useAccount()
  const [state, setState] = useState<TxState>({ phase: 'idle' })
  const [signature, setSignature] = useState<PermitSignature>()

  // [읽기] 토큰의 permit 전용 nonce. 서명 하나를 쓸 때마다 1씩 올라가서 같은 서명을 두 번 못 쓰게 한다.
  //        (계정의 트랜잭션 nonce와는 별개의, 토큰 컨트랙트 안에 저장된 숫자)
  const { data: nonce } = useReadContract({
    address: MOCK_USD_ADDRESS,
    abi: mockUsdAbi,
    functionName: 'nonces',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // [읽기] 서명 "도메인": [토큰 이름, 버전, 체인 ID, 토큰 주소]. 서명에 함께 묶여서
  //        다른 토큰·다른 체인에서 같은 서명을 재사용할 수 없게 한다. 값을 직접 적지 않고 컨트랙트에서 읽어 온다.
  const { data: domain } = useReadContract({
    address: MOCK_USD_ADDRESS,
    abi: mockUsdAbi,
    functionName: 'eip712Domain',
  })

  async function sign(amount: bigint, permitDeadline: bigint) {
    if (!address || nonce === undefined || !domain) {
      setState({ phase: 'error', error: '지갑 연결과 토큰 정보를 확인하는 중이에요. 잠시 후 다시 눌러 주세요.' })
      return
    }
    // 서명 도메인에 chainId가 들어가므로 MetaMask도 같은 체인(Anvil/Sepolia)에 있어야 서명해 준다.
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
      setState({ phase: 'signing' })
      const [, name, version, domainChainId, verifyingContract] = domain
      const sig = await signTypedData(config, {
        account: address,
        domain: { name, version, chainId: Number(domainChainId), verifyingContract },
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        message: { owner: address, spender: ESCROW_ADDRESS, value: amount, nonce, deadline: permitDeadline },
      })
      // 65바이트 서명 → 컨트랙트가 받는 형태(v, r, s)로 나눈다
      const { r, s, v, yParity } = parseSignature(sig)
      setSignature({ owner: address, amount, nonce, permitDeadline, r, s, v: v !== undefined ? Number(v) : yParity + 27 })
      setState({ phase: 'success' })
    } catch (err) {
      setState({ phase: 'error', error: toKoreanError(err) })
    }
  }

  const reset = () => {
    setState({ phase: 'idle' })
    setSignature(undefined)
  }
  const busy = state.phase === 'switching' || state.phase === 'signing'

  return { state, signature, nonce, sign, reset, busy }
}
