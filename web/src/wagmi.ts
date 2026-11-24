// wagmi 설정: "어느 체인에, 어떤 지갑으로, 어떤 통로로" 연결할지 정한다.
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { IS_LOCAL, RPC_URL, TARGET_CHAIN } from './network'

export const config = createConfig({
  // 체인은 하나만 쓴다: npm run dev → Anvil, npm run dev:sepolia → Sepolia (src/network.ts 참고)
  chains: [TARGET_CHAIN],

  // 지갑 연결 방식: 브라우저에 주입된(injected) MetaMask만 쓴다.
  // WalletConnect·RainbowKit처럼 외부 서비스 키(projectId)가 필요한 방식은 쓰지 않는다.
  connectors: [injected({ target: 'metaMask' })],
  // 여러 지갑 확장이 깔려 있어도 자동으로 목록을 만들지 않게 함 (MetaMask만 쓰기 위해)
  multiInjectedProviderDiscovery: false,

  // [읽기]는 이 통로(http)로 노드에 직접 물어본다. → MetaMask를 거치지 않으므로 지갑이 없어도 읽기는 가능.
  // [쓰기]는 MetaMask가 서명한 뒤 MetaMask가 노드로 전송한다.
  transports: {
    [TARGET_CHAIN.id]: http(RPC_URL),
  },

  // 새 블록이 생겼는지 몇 ms마다 확인할지.
  // Anvil은 로컬이라 1초, Sepolia는 블록이 12초마다 생기고 공개 노드의 요청 제한도 있어서 4초.
  pollingInterval: IS_LOCAL ? 1_000 : 4_000,
})

// wagmi 훅들이 위 config의 타입(체인 목록 등)을 알 수 있게 등록
declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
