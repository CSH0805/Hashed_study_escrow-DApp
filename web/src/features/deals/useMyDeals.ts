import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { ESCROW_ADDRESS } from '../../config/network'
import { escrowAbi } from '../../contracts/generated'

export type DealSide = 'buyer' | 'seller'

/**
 * 내가 구매자(또는 판매자)인 거래 목록. 전부 [읽기](view 함수)라 가스도 서명도 필요 없다.
 *   ① getDealIdsByBuyer / getDealIdsBySeller 로 거래 번호 목록을 읽고
 *   ② 번호마다 getDeal(id) 를 한꺼번에(multicall) 읽는다
 * 블록체인에는 "WHERE buyer = 나" 같은 검색이 없어서, 컨트랙트가 미리 만들어 둔 주소별 번호 목록을 이용한다.
 */
export function useMyDeals(side: DealSide) {
  const { address } = useAccount()

  // [읽기] ① 거래 번호 목록
  const { data: ids } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: side === 'buyer' ? 'getDealIdsByBuyer' : 'getDealIdsBySeller',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // [읽기] ② 각 거래의 상세 내용 (최신 거래가 위로 오게 뒤집음)
  const sortedIds = [...(ids ?? [])].reverse()
  const { data: results } = useReadContracts({
    contracts: sortedIds.map(
      (id) => ({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: 'getDeal', args: [id] }) as const,
    ),
    query: { enabled: sortedIds.length > 0 },
  })

  return {
    connected: !!address,
    items: sortedIds.map((id, i) => ({ id, deal: results?.[i]?.result })),
  }
}
