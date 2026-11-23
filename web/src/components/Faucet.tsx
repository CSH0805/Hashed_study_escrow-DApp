import { useAccount } from 'wagmi'
import { MOCK_USD_ADDRESS, mockUsdAbi } from '../contracts/generated'
import { useTx } from '../hooks/useTx'
import { TxStatus } from './TxStatus'

/** "테스트 코인 받기" — MockUSD.faucet() 호출 */
export function Faucet() {
  const { isConnected } = useAccount()
  const { state, send, busy } = useTx()

  return (
    <section className="card">
      <h2>
        테스트 코인 받기 <span className="tag write">쓰기 · 트랜잭션</span>
      </h2>
      <p className="muted small">
        누를 때마다 내 주소로 1,000 mUSD가 새로 발행돼요. 가스(ETH)는 Anvil 테스트 계정에 넉넉히 있어요.
      </p>
      <button
        className="primary"
        disabled={!isConnected || busy}
        // [쓰기] faucet()은 잔고(storage)를 바꾸므로 서명된 트랜잭션이 필요하다
        onClick={() => send({ address: MOCK_USD_ADDRESS, abi: mockUsdAbi, functionName: 'faucet' })}
      >
        1,000 mUSD 받기
      </button>
      <TxStatus state={state} />
    </section>
  )
}
