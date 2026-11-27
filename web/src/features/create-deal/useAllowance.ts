import { useAccount, useReadContract } from 'wagmi'
import { ESCROW_ADDRESS, MOCK_USD_ADDRESS } from '../../config/network'
import { mockUsdAbi } from '../../contracts/generated'

/** [읽기] 내가 에스크로에게 "가져가도 된다"고 승인해 둔 mUSD 금액 (allowance는 view 함수) */
export function useAllowance() {
  const { address } = useAccount()
  const { data } = useReadContract({
    address: MOCK_USD_ADDRESS,
    abi: mockUsdAbi,
    functionName: 'allowance',
    args: address ? [address, ESCROW_ADDRESS] : undefined,
    query: { enabled: !!address },
  })
  return data
}
