import { useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { MOCK_USD_ADDRESS } from '../../config/network'
import { mockUsdAbi } from '../../contracts/generated'

/** [읽기] 주소의 mUSD 잔고. balanceOf는 view 함수 → 가스 없음, 서명 없음 */
export function useMusdBalance(address: Address | undefined) {
  const { data } = useReadContract({
    address: MOCK_USD_ADDRESS,
    abi: mockUsdAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }, // 주소가 있을 때만 읽기
  })
  return data
}
