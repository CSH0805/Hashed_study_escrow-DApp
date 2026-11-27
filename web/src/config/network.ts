// 어느 네트워크에서 돌릴지 한 곳에서 정한다.
//
//   npm run dev            → Anvil(로컬, chainId 31337)
//   npm run dev:sepolia    → Sepolia 테스트넷(chainId 11155111)
//
// Vite의 "mode"로 고른다. (vite --mode sepolia 로 실행하면 import.meta.env.MODE 가 'sepolia')
// 화면 코드는 이 파일의 값만 쓰고, "anvil"이나 "31337"을 직접 적지 않는다.
// → 네트워크가 바뀌어도 화면 코드는 그대로 두고 이 파일만 보면 된다.
import type { Chain } from 'viem'
import { anvil, sepolia } from 'wagmi/chains'
import { DEPLOYMENTS } from '../contracts/generated'

const isSepolia = import.meta.env.MODE === 'sepolia'

/** 이 화면이 연결할 체인 하나 (Chain 타입으로 넓혀 둬야 wagmi 설정에서 체인 하나짜리로 다룰 수 있다) */
export const TARGET_CHAIN: Chain = isSepolia ? sepolia : anvil

/** 로컬 Anvil인지 (시간 조작·nonce 복구 도구 같은 Anvil 전용 안내를 보여줄지 결정) */
export const IS_LOCAL = !isSepolia

/** 화면에 보여줄 네트워크 이름 */
export const NETWORK_NAME = isSepolia ? 'Sepolia 테스트넷' : 'Anvil'

/**
 * [읽기]용 RPC 주소.
 *   - Anvil: 내 컴퓨터의 노드
 *   - Sepolia: 누구나 쓸 수 있는 무료 공개 노드. 느리거나 막히면 web/.env.sepolia.local 에
 *     VITE_SEPOLIA_RPC_URL=<Alchemy/Infura 주소> 를 적으면 그걸 쓴다. (.env 파일은 git에 올라가지 않음)
 */
export const RPC_URL = isSepolia
  ? (import.meta.env.VITE_SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com')
  : 'http://127.0.0.1:8545'

/** 블록 탐색기(Etherscan) 주소. Anvil에는 없다. */
export const EXPLORER_URL: string | undefined = isSepolia ? sepolia.blockExplorers.default.url : undefined

// 배포 주소: contracts/deployments/<chainId>.json → npm run sync → generated.ts 의 DEPLOYMENTS
const deployment = DEPLOYMENTS[TARGET_CHAIN.id]

/** 이 네트워크에 아직 배포하지 않았으면 true → 화면(App.tsx)이 안내문만 보여준다 */
export const NOT_DEPLOYED = !deployment

const ZERO = '0x0000000000000000000000000000000000000000' as const
export const MOCK_USD_ADDRESS = deployment?.MockUSD ?? ZERO
export const ESCROW_ADDRESS = deployment?.Escrow ?? ZERO
/** 컨트랙트를 배포한 블록. 이벤트 로그를 이 블록부터 찾는다. (Sepolia는 블록 0부터 훑으면 너무 많아서 거부됨) */
export const DEPLOY_BLOCK = deployment?.startBlock ?? 0n
