import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { DEPLOY_BLOCK, ESCROW_ADDRESS } from '../../config/network'
import { escrowAbi } from '../../contracts/generated'
import { formatMusd, shortAddress } from '../../shared/lib/format'

/**
 * 거래 하나의 이벤트 로그 → 타임라인 항목 목록.  [읽기 · 가스 없음]
 *
 * view 함수(getDeal)  → "지금 상태"만 알 수 있다. (예: status = 지급완료)
 * 이벤트 로그          → "언제, 몇 번 블록에서, 어떤 트랜잭션으로" 그렇게 됐는지 알 수 있다.
 *
 * 이벤트는 트랜잭션 영수증(receipt)에 기록되고, 컨트랙트 자신은 못 읽지만 노드에게 물어보면(eth_getLogs) 누구나 읽을 수 있다.
 * Etherscan의 거래 내역 화면도 이 방식으로 만들어진다.
 */
export function useDealEvents(id: bigint) {
  const client = usePublicClient()

  return useQuery({
    // App에서 새 블록이 생길 때마다 'dealEvents'로 시작하는 쿼리를 다시 불러온다
    queryKey: ['dealEvents', id.toString()],
    enabled: !!client,
    queryFn: async () => {
      if (!client) return []

      // ① 이 거래(id)에 관한 이벤트 3종을 컨트랙트 배포 블록부터 찾는다.
      //    id가 indexed라서 노드가 "id = N인 로그만" 골라 줄 수 있다. (indexed는 검색용 색인)
      //    ※ Sepolia처럼 블록이 수백만 개인 체인에서 블록 0부터 훑으면 노드가 거부한다. 그래서 배포 블록부터 찾는다.
      //      실제 서비스에서는 The Graph 같은 인덱서(이벤트를 미리 DB에 모아 두는 서버)를 쓴다.
      const filter = { address: ESCROW_ADDRESS, abi: escrowAbi, args: { id }, fromBlock: DEPLOY_BLOCK } as const
      const [created, released, refunded] = await Promise.all([
        client.getContractEvents({ ...filter, eventName: 'DealCreated' }),
        client.getContractEvents({ ...filter, eventName: 'DealReleased' }),
        client.getContractEvents({ ...filter, eventName: 'DealRefunded' }),
      ])

      const logs = [
        ...created.map((l) => ({ l, label: '거래 생성 · 예치', detail: `구매자 ${shortAddress(l.args.buyer)} → 에스크로 ${formatMusd(l.args.amount)} mUSD` })),
        ...released.map((l) => ({
          l,
          label: l.args.afterDeadline ? '마감 후 자동 지급' : '구매확정',
          detail: `에스크로 → 판매자 ${shortAddress(l.args.seller)} ${formatMusd(l.args.amount)} mUSD`,
        })),
        ...refunded.map((l) => ({ l, label: '거래 취소 · 환불', detail: `에스크로 → 구매자 ${shortAddress(l.args.buyer)} ${formatMusd(l.args.amount)} mUSD` })),
      ].sort((a, b) => Number(a.l.blockNumber - b.l.blockNumber))

      // ② 로그에는 블록 번호·트랜잭션 해시만 있다. 시각은 블록에서, 가스는 영수증에서 따로 읽는다.
      return Promise.all(
        logs.map(async ({ l, label, detail }) => {
          const [block, receipt] = await Promise.all([
            client.getBlock({ blockNumber: l.blockNumber }),
            client.getTransactionReceipt({ hash: l.transactionHash }),
          ])
          return {
            key: `${l.transactionHash}-${l.logIndex}`,
            label,
            detail,
            blockNumber: l.blockNumber,
            time: block.timestamp,
            hash: l.transactionHash,
            from: receipt.from, // 이 트랜잭션에 서명한 사람 (= msg.sender)
            gasUsed: receipt.gasUsed,
            gasPrice: receipt.effectiveGasPrice,
            fee: receipt.gasUsed * receipt.effectiveGasPrice,
          }
        }),
      )
    },
  })
}

export type DealEvent = NonNullable<ReturnType<typeof useDealEvents>['data']>[number]
