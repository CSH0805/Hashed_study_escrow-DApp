import { useAccount } from 'wagmi'
import { IS_LOCAL, MOCK_USD_ADDRESS } from '../../config/network'
import { mockUsdAbi } from '../../contracts/generated'
import { useTx } from '../../shared/hooks/useTx'
import { Tag } from '../../shared/ui/Tag'
import { TxStatus } from '../../shared/ui/TxStatus'

/** "테스트 코인 받기" — MockUSD.faucet() 호출 */
export function FaucetCard() {
  const { isConnected } = useAccount()
  const { state, send, busy } = useTx()

  return (
    <section className="card">
      <h2>
        테스트 코인 받기 <Tag kind="write" />
      </h2>
      <div className="banner">
        <span className="banner-icon" aria-hidden>
          👛
        </span>
        <div className="banner-body">
          <strong>1,000 mUSD 충전하기</strong>
          <p className="muted small">
            누를 때마다 내 주소로 1,000 mUSD가 새로 발행돼요.{' '}
            {IS_LOCAL
              ? '가스(ETH)는 Anvil 테스트 계정에 넉넉히 있어요.'
              : '가스로 쓸 Sepolia ETH는 Sepolia faucet에서 따로 받아야 해요.'}
          </p>
        </div>
      </div>
      <button
        className="primary block"
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
