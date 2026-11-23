// wagmi 설정: "어느 체인에, 어떤 지갑으로, 어떤 통로로" 연결할지 정한다.
import { createConfig, http } from 'wagmi'
import { anvil } from 'wagmi/chains' // chainId 31337, RPC http://127.0.0.1:8545 가 미리 정의돼 있음
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  // 이 앱은 Anvil 로컬 체인 하나만 쓴다. (테스트넷/메인넷 연결 없음)
  chains: [anvil],

  // 지갑 연결 방식: 브라우저에 주입된(injected) MetaMask만 쓴다.
  // WalletConnect·RainbowKit처럼 외부 서비스 키(projectId)가 필요한 방식은 쓰지 않는다.
  connectors: [injected({ target: 'metaMask' })],
  // 여러 지갑 확장이 깔려 있어도 자동으로 목록을 만들지 않게 함 (MetaMask만 쓰기 위해)
  multiInjectedProviderDiscovery: false,

  // [읽기]는 이 통로(http)로 Anvil에 직접 물어본다. → MetaMask를 거치지 않으므로 지갑이 없어도 읽기는 가능.
  // [쓰기]는 MetaMask가 서명한 뒤 MetaMask가 Anvil로 전송한다.
  transports: {
    [anvil.id]: http('http://127.0.0.1:8545'),
  },

  // 새 블록이 생겼는지 몇 ms마다 확인할지. 로컬이라 1초로 짧게.
  pollingInterval: 1_000,
})

// wagmi 훅들이 위 config의 타입(체인 목록 등)을 알 수 있게 등록
declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
