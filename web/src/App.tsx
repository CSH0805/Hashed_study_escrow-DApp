import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useBlockNumber } from 'wagmi'
import { Header } from './components/Header'
import { Faucet } from './components/Faucet'
import { CreateDeal } from './components/CreateDeal'
import { DealList } from './components/DealList'
import { DealDetail } from './components/DealDetail'

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
      predicate: (q) => q.queryKey[0] === 'readContract' || q.queryKey[0] === 'readContracts',
    })
  }, [blockNumber, queryClient])

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
