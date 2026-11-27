import { useAccount, useSwitchChain } from 'wagmi'
import { NETWORK_NAME, TARGET_CHAIN } from '../../config/network'

/** MetaMask가 다른 네트워크에 있으면 전환 버튼이 달린 경고를 보여준다. 맞는 네트워크면 아무것도 안 그림 */
export function NetworkGuard() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()

  if (!isConnected || chainId === TARGET_CHAIN.id) return null
  return (
    <div className="warn full">
      MetaMask가 다른 네트워크(chainId {chainId})에 연결돼 있어요.{' '}
      <button disabled={isPending} onClick={() => switchChain({ chainId: TARGET_CHAIN.id })}>
        {NETWORK_NAME}로 전환
      </button>
    </div>
  )
}
