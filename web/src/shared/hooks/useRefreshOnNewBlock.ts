import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBlockNumber } from 'wagmi'

/**
 * [읽기] 새 블록이 생길 때마다 잔고·거래 목록·거래 내역을 다시 읽는다.
 * 다른 계정(예: 판매자 창)에서 보낸 트랜잭션 결과도 자동으로 반영하기 위함.
 * (블록체인 상태는 블록 단위로만 바뀌므로, "새 블록 = 다시 읽을 때"다)
 *
 * @returns 최신 블록 번호 (화면 표시용)
 */
export function useRefreshOnNewBlock(): bigint | undefined {
  const queryClient = useQueryClient()
  const { data: blockNumber } = useBlockNumber({ watch: true })

  useEffect(() => {
    queryClient.invalidateQueries({
      predicate: (q) => ['readContract', 'readContracts', 'dealEvents'].includes(q.queryKey[0] as string),
    })
  }, [blockNumber, queryClient])

  return blockNumber
}
