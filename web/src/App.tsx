import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useBlockNumber } from 'wagmi'
import { Header } from './components/Header'
import { Faucet } from './components/Faucet'
import { CreateDeal } from './components/CreateDeal'
import { DealList } from './components/DealList'
import { DealDetail } from './components/DealDetail'
import { NETWORK_NAME, NOT_DEPLOYED, TARGET_CHAIN } from './network'

export default function App() {
  const { address } = useAccount()
  // 선택한 거래를 "어느 계정으로 보고 있었는지"와 함께 저장.
  // MetaMask에서 계정을 바꾸면 역할이 달라지므로 선택을 자동으로 해제한다.
  const [selection, setSelection] = useState<{ account?: string; id: bigint }>()
  const selectedId = selection?.account === address ? selection?.id : undefined
  const setSelectedId = (id: bigint) => setSelection({ account: address, id })
  const queryClient = useQueryClient()

  // [읽기] 새 블록이 생길 때마다 잔고·거래 목록을 다시 읽는다.
  // 다른 계정(예: 판매자 창)에서 보낸 트랜잭션 결과도 자동으로 반영하기 위함.
  // (블록체인 상태는 블록 단위로만 바뀌므로, "새 블록 = 다시 읽을 때"다)
  const { data: blockNumber } = useBlockNumber({ watch: true })
  useEffect(() => {
    queryClient.invalidateQueries({
      predicate: (q) => ['readContract', 'readContracts', 'dealEvents'].includes(q.queryKey[0] as string),
    })
  }, [blockNumber, queryClient])

  // 이 네트워크에 컨트랙트가 아직 없으면 버튼을 눌러도 실패만 하므로 안내만 보여준다.
  if (NOT_DEPLOYED) {
    return (
      <div className="container">
        <section className="card">
          <h2>{NETWORK_NAME}에 아직 배포되지 않았어요</h2>
          <p className="small">
            contracts/deployments/{TARGET_CHAIN.id}.json 이 없어요. 컨트랙트를 {NETWORK_NAME}에 배포한 뒤 web/ 폴더에서{' '}
            <code>npm run sync</code> 를 실행하고 새로고침해 주세요. (docs/SEPOLIA.md 참고)
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="container">
      <Header />
      <Faucet />
      <CreateDeal onCreated={setSelectedId} />
      <DealList selectedId={selectedId} onSelect={setSelectedId} />
      {selectedId !== undefined && <DealDetail id={selectedId} />}
      <footer className="muted small">
        블록 번호 {blockNumber?.toString() ?? '-'} · 표시: <span className="tag read">읽기 · 가스 없음</span>{' '}
        <span className="tag write">쓰기 · 트랜잭션</span>
      </footer>
    </div>
  )
}
