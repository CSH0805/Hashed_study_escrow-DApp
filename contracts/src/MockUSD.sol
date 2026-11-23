// SPDX-License-Identifier: MIT
// ↑ 라이선스 표기. 컴파일러가 없으면 경고를 내기 때문에 관례적으로 맨 위에 적는다.

// 이 파일을 컴파일할 수 있는 Solidity 버전 범위. "^0.8.20" = 0.8.20 이상 0.9.0 미만.
// 0.8.x부터는 덧셈/뺄셈이 넘치면(overflow) 자동으로 실패(revert)하기 때문에
// 예전처럼 SafeMath 라이브러리를 따로 쓸 필요가 없다.
pragma solidity ^0.8.20;

// OpenZeppelin v5의 ERC-20 구현을 가져온다.
// "@openzeppelin/contracts/" 별명은 foundry.toml의 remappings가 lib/ 안의 실제 폴더로 연결해 준다.
// 잔고 기록(balanceOf), 송금(transfer), 승인(approve), 대리 송금(transferFrom) 같은
// ERC-20 표준 기능을 직접 짜지 않고 감사(audit)받은 코드를 그대로 상속해서 쓴다.
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSD (mUSD)
/// @notice 로컬 테스트용 가짜 달러 스테이블코인.
///         실제 USDC는 발행사(Circle)만 발행할 수 있지만, 이 토큰은 공부용이라
///         누구나 faucet()으로 받아 갈 수 있게 만들었다. 실제 가치는 전혀 없다.
contract MockUSD is ERC20 {
    /// @notice faucet() 한 번에 받는 양: 1,000 mUSD
    /// @dev 소수점 6자리이므로 "1 mUSD" = 1_000_000(10**6) 이라는 정수로 저장된다.
    ///      블록체인(EVM)에는 소수(float)가 없어서, 모든 금액을 "가장 작은 단위의 정수"로 다룬다.
    ///      (이더의 wei와 같은 원리. 1 ETH = 10**18 wei)
    ///      constant로 선언하면 저장공간(storage)을 쓰지 않고 바이트코드에 박혀서 읽을 때 가스가 거의 안 든다.
    uint256 public constant FAUCET_AMOUNT = 1_000 * 10 ** 6;

    /// @notice faucet으로 토큰을 받았을 때 남기는 기록(이벤트).
    /// @dev ERC-20의 _mint도 Transfer(0x0 → 받는사람) 이벤트를 남기지만,
    ///      "faucet으로 받았다"는 의미를 화면이나 로그에서 구분하기 쉽게 별도 이벤트를 하나 더 둔다.
    ///      indexed를 붙이면 나중에 "이 주소가 받은 기록만" 빠르게 검색할 수 있다.
    event FaucetClaimed(address indexed to, uint256 amount);

    /// @dev 생성자(constructor): 배포 트랜잭션이 실행될 때 딱 한 번만 실행된다.
    ///      부모 ERC20의 생성자에 이름과 심볼을 넘겨준다.
    ///      처음 발행량은 0이다. 토큰은 faucet()으로만 생긴다.
    constructor() ERC20("Mock USD", "mUSD") {}

    /// @notice 토큰의 소수점 자릿수. USDC와 같게 6으로 맞춘다.
    /// @dev [읽기 / view] 상태를 바꾸지 않는 함수라 호출해도 가스가 들지 않는다.
    ///      (정확히는 "트랜잭션 없이 노드에게 물어보기(eth_call)"로 처리된다.)
    ///      OpenZeppelin ERC20의 기본값은 18이라서 override(덮어쓰기)로 6을 돌려주게 바꾼다.
    ///      주의: decimals는 "화면에 어떻게 보여줄지"에 대한 약속일 뿐이다.
    ///      컨트랙트 내부 잔고는 항상 정수이고, 1.5 mUSD는 1_500_000으로 저장된다.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice 호출한 사람(msg.sender)에게 1,000 mUSD를 새로 발행해 준다.
    /// @dev [쓰기 / 트랜잭션] 잔고(storage)를 바꾸므로 서명된 트랜잭션이 필요하고 가스가 든다.
    ///      - msg.sender: 이 트랜잭션에 서명한 계정. 전자서명으로 증명된 주소라서 위조할 수 없다.
    ///        그래서 "받는 주소"를 인자로 받지 않고 msg.sender로 고정했다.
    ///        → 남의 주소를 넣는 실수나 장난을 원천 차단하고, 코드도 단순해진다.
    ///      - _mint: OpenZeppelin 내부 함수. 총발행량(totalSupply)과 받는 사람 잔고를 늘리고
    ///        Transfer(address(0), to, amount) 이벤트를 남긴다.
    ///      - 횟수 제한은 일부러 두지 않았다. 로컬 공부용이라 여러 번 받아도 문제없고,
    ///        실제 테스트넷 faucet은 보통 "24시간에 1번" 같은 제한을 둔다.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }
}
