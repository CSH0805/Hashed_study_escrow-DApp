import {
  BaseError,
  ChainMismatchError,
  ContractFunctionRevertedError,
  UnauthorizedProviderError,
  UserRejectedRequestError,
} from 'viem'

/**
 * 컨트랙트의 custom error 이름 → 한국어 안내.
 * Escrow.sol에서 require("문자열") 대신 custom error를 쓴 덕분에,
 * 화면에서 "어떤 규칙에 걸렸는지"를 이름으로 정확히 구분할 수 있다.
 */
const CONTRACT_ERRORS: Record<string, string> = {
  // Escrow.sol
  ZeroAmount: '금액은 0보다 커야 해요.',
  InvalidSeller: '판매자 주소가 올바르지 않아요.',
  SellerIsBuyer: '자기 자신을 판매자로 지정할 수 없어요.',
  DeadlineInPast: '마감 시각이 이미 지났어요. (체인 시각 기준) 더 뒤의 시각을 골라 주세요.',
  DealNotFound: '존재하지 않는 거래예요.',
  NotBuyer: '이 거래의 구매자만 할 수 있어요.',
  NotSeller: '이 거래의 판매자만 할 수 있어요.',
  DealNotFunded: '이미 끝난 거래라 다시 처리할 수 없어요.',
  DeadlineNotPassed: '아직 마감 전이에요. 마감이 지난 뒤에 다시 시도해 주세요.',
  PermitFailed: 'permit 서명이 유효하지 않아요. 서명이 만료됐거나, 금액이 바뀌었거나, 이미 사용된 서명이에요. 다시 서명해 주세요.',
  ReentrancyGuardReentrantCall: '재진입 호출이 차단됐어요.',
  // OpenZeppelin ERC20 (MockUSD)
  ERC20InsufficientAllowance: '승인(approve)한 금액이 부족해요. 1단계 승인을 먼저 해 주세요.',
  ERC20InsufficientBalance: 'mUSD 잔고가 부족해요. "테스트 코인 받기"를 눌러 주세요.',
}

/** 어떤 오류든 사용자에게 보여줄 한국어 문장으로 바꾼다. */
export function toKoreanError(err: unknown, context: 'tx' | 'connect' | 'switch' = 'tx'): string {
  if (err instanceof BaseError) {
    // 1) 사용자가 MetaMask 창에서 "거부"를 누르거나 창을 닫은 경우 (EIP-1193 오류 코드 4001)
    if (err.walk((e) => e instanceof UserRejectedRequestError) || err.name === 'UserRejectedRequestError') {
      if (context === 'connect') return '지갑 연결 요청을 거절했어요(또는 창을 닫았어요). 다시 "지갑 연결"을 눌러 주세요.'
      if (context === 'switch') return 'Anvil 네트워크 전환을 거절했어요. 전환해야 트랜잭션을 보낼 수 있어요.'
      return '지갑에서 서명을 거절했어요. 트랜잭션이 전송되지 않았으니 가스도 나가지 않았어요.'
    }
    // EIP-1193 오류 코드 4100: 이 사이트에 해당 계정/네트워크 권한을 주지 않음
    if (err.walk((e) => e instanceof UnauthorizedProviderError)) {
      return 'MetaMask가 이 사이트에 계정 또는 Anvil 네트워크 사용을 허용하지 않았어요. MetaMask 아래쪽 "localhost:5173" 연결 설정에서 계정과 Anvil 네트워크를 허용해 주세요.'
    }
    if (err.walk((e) => e instanceof ChainMismatchError)) {
      return 'MetaMask의 네트워크가 Anvil(31337)이 아니에요. 상단의 "Anvil로 전환" 버튼을 눌러 주세요.'
    }

    // 2) 컨트랙트가 revert한 경우 → custom error 이름으로 안내
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName ?? ''
      return CONTRACT_ERRORS[name] ?? `컨트랙트가 거부했어요: ${name || reverted.shortMessage}`
    }

    // 3) 자주 막히는 환경 문제
    const msg = `${err.shortMessage} ${err.details ?? ''}`.toLowerCase()
    if (msg.includes('insufficient funds')) {
      return '가스비로 낼 ETH가 없어요. MetaMask에서 Anvil 테스트 계정(구매자/판매자)을 선택했는지 확인해 주세요.'
    }
    if (msg.includes('nonce')) {
      return 'nonce가 맞지 않아요. Anvil을 재시작했다면 web/ 폴더에서 `npm run fix-nonce`를 실행하거나, MetaMask 설정에서 "논스"를 검색해 "활동 및 논스 데이터 지우기"를 눌러 주세요.'
    }
    if (msg.includes('fetch') || msg.includes('http request failed') || msg.includes('econnrefused')) {
      return 'Anvil 노드(127.0.0.1:8545)에 연결할 수 없어요. 터미널에서 anvil이 켜져 있는지 확인해 주세요.'
    }
    if (msg.includes('chain') && msg.includes('match')) {
      return 'MetaMask의 네트워크가 Anvil(31337)이 아니에요. 상단의 "Anvil로 전환" 버튼을 눌러 주세요.'
    }
    return err.shortMessage
  }
  return err instanceof Error ? err.message : String(err)
}
