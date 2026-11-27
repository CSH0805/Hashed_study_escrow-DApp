import { useReadContract } from 'wagmi'
import { ESCROW_ADDRESS } from '../../config/network'
import { escrowAbi } from '../../contracts/generated'

/** [읽기] getDeal(id) — 거래 하나의 "지금 상태" */
export function useDeal(id: bigint) {
  const { data: deal, error } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'getDeal',
    args: [id],
  })
  return { deal, error }
}

export type Deal = NonNullable<ReturnType<typeof useDeal>['deal']>
