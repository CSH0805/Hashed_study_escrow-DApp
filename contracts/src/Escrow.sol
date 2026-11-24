// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Escrow (안전결제)
/// @notice 구매자가 맡긴 스테이블코인을 컨트랙트가 보관하다가,
///         결말(구매확정 / 거래 취소 / 마감 후 자동 지급)에 따라 판매자 또는 구매자에게 보낸다.
/// @dev 일반 안전결제에서 "중개 회사"가 하던 역할을 코드가 대신한다.
///      누구도(배포자 포함) 맡겨진 돈을 임의로 빼갈 수 있는 함수가 없다는 점이 핵심이다.
contract Escrow is ReentrancyGuard {
    // SafeERC20: 일부 토큰은 transfer 실패 시 false를 돌려주기만 하고 revert하지 않는다.
    // safeTransfer/safeTransferFrom은 그런 경우도 확실히 실패(revert)로 처리해 준다.
    using SafeERC20 for IERC20;

    // ─────────────────────────── 자료형 ───────────────────────────

    /// @dev 거래 상태. 한 번 Funded에서 벗어나면 다시 돌아올 수 없다(끝난 거래는 재처리 불가).
    enum Status {
        Funded, // 0: 진행중 (돈이 컨트랙트에 묶여 있음)
        Released, // 1: 지급완료 (판매자에게 보냄)
        Refunded // 2: 환불완료 (구매자에게 돌려줌)
    }

    struct Deal {
        uint256 id;
        address buyer;
        address seller;
        uint256 amount; // 토큰 최소 단위(mUSD는 소수점 6자리 → 1 mUSD = 1_000_000)
        uint256 deadline; // 유닉스 시간(초). 블록체인에는 "블록 시각(block.timestamp)"만 있다.
        string description;
        Status status;
    }

    // ─────────────────────────── 저장공간(storage) ───────────────────────────
    // storage에 쓰는 것은 가스가 가장 비싼 작업이다. 꼭 필요한 것만 저장한다.

    /// @notice 이 에스크로가 다루는 토큰(mUSD). 배포 때 한 번 정하고 바꿀 수 없다(immutable).
    IERC20 public immutable token;

    /// @dev 다음에 만들 거래 번호. 1부터 시작한다.
    ///      0번을 비워 두면 "buyer가 0 주소인 거래 = 존재하지 않는 거래"로 쉽게 판별할 수 있다.
    uint256 public nextDealId = 1;

    mapping(uint256 => Deal) private _deals;

    // 화면에서 "내 거래 목록"을 보여주기 위한 색인.
    // 블록체인은 "조건으로 검색(SELECT ... WHERE buyer = ?)"을 못 하기 때문에,
    // 만들 때 미리 주소별 목록에 번호를 넣어 둔다. (대안: 이벤트 로그를 모아 검색 → 서버/인덱서가 필요)
    mapping(address => uint256[]) private _dealIdsByBuyer;
    mapping(address => uint256[]) private _dealIdsBySeller;

    // ─────────────────────────── 이벤트 ───────────────────────────
    // 이벤트 = 트랜잭션 영수증(receipt)에 남는 로그. 컨트랙트는 못 읽지만, 화면/외부 프로그램은 읽을 수 있다.

    event DealCreated(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 deadline,
        string description
    );
    /// @param afterDeadline true면 마감 후 판매자가 직접 받아 간 경우(claimAfterDeadline)
    event DealReleased(uint256 indexed id, address indexed seller, uint256 amount, bool afterDeadline);
    event DealRefunded(uint256 indexed id, address indexed buyer, uint256 amount);

    // ─────────────────────────── custom error ───────────────────────────
    // require("긴 문자열") 대신 custom error를 쓰는 이유:
    // 1) 문자열을 바이트코드에 넣지 않아 배포/실패 가스가 싸다
    // 2) 화면(viem)에서 오류 이름으로 정확히 구분해 한국어 안내를 띄울 수 있다

    error ZeroAmount();
    error InvalidSeller(); // 판매자 주소가 0
    error SellerIsBuyer(); // 자기 자신과 거래
    error DeadlineInPast(uint256 deadline, uint256 nowTime);
    error DealNotFound(uint256 id);
    error NotBuyer(uint256 id);
    error NotSeller(uint256 id);
    error DealNotFunded(uint256 id, Status status); // 이미 끝난 거래
    error DeadlineNotPassed(uint256 id, uint256 deadline, uint256 nowTime);
    error PermitFailed(); // permit 서명이 틀렸거나, 만료됐거나, 이미 사용됨

    constructor(IERC20 token_) {
        token = token_;
    }

    // ─────────────────────────── 쓰기 함수 (트랜잭션, 가스 있음) ───────────────────────────

    /// @notice [쓰기] 구매자가 거래를 만들고 돈을 예치한다. (방식 A: approve 트랜잭션 → createDeal 트랜잭션)
    /// @dev 이 함수를 부르기 전에 구매자가 token.approve(escrow주소, amount)를 먼저 해 둬야 한다.
    ///      (컨트랙트는 남의 지갑에서 마음대로 돈을 꺼낼 수 없고, "허락된 만큼만" transferFrom으로 가져올 수 있다.)
    function createDeal(address seller, uint256 amount, uint256 deadline, string calldata description)
        external
        nonReentrant
        returns (uint256 id)
    {
        id = _createDeal(seller, amount, deadline, description);
    }

    /// @notice [쓰기] permit 서명으로 승인과 예치를 트랜잭션 한 번에 처리한다. (방식 B: 서명 → createDealWithPermit 트랜잭션)
    /// @dev 구매자는 먼저 지갑에서 "Escrow가 내 mUSD를 amount만큼 가져가도 된다"는 EIP-712 서명을 만든다.
    ///      서명은 체인 밖(지갑 안)에서 만들어지므로 가스가 들지 않고 블록에도 남지 않는다.
    ///      이 함수가 그 서명(v, r, s)을 토큰의 permit()에 넘기면, 토큰이 서명자를 복원(ecrecover)해서
    ///      owner(= msg.sender)와 같은지 확인한 뒤 approve를 처리해 준다. 그다음은 createDeal과 똑같다.
    /// @param permitDeadline 서명의 유효기한(유닉스 초). 지나면 그 서명은 못 쓴다. (거래 마감 deadline과는 다른 값)
    function createDealWithPermit(
        address seller,
        uint256 amount,
        uint256 deadline,
        string calldata description,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant returns (uint256 id) {
        // owner를 msg.sender로 고정: 남의 서명을 주워서 그 사람 돈으로 거래를 만드는 것을 막는다.
        // (서명은 "owner=구매자"로 만들어졌으므로, 다른 사람이 보내면 서명 검증에서 실패한다)
        //
        // try/catch를 쓰는 이유: 서명은 멤풀(대기열)에서 누구나 볼 수 있어서, 공격자가 같은 서명으로
        // token.permit()을 먼저 호출해 버릴 수 있다(front-running). 그러면 nonce가 이미 쓰여 여기서 permit이 실패한다.
        // 하지만 그 경우에도 승인 자체는 이미 처리됐으므로, 승인액이 충분하면 그대로 진행한다.
        try IERC20Permit(address(token)).permit(msg.sender, address(this), amount, permitDeadline, v, r, s) {}
        catch {
            if (token.allowance(msg.sender, address(this)) < amount) revert PermitFailed();
        }
        id = _createDeal(seller, amount, deadline, description);
    }

    /// @dev 두 방식이 공통으로 쓰는 거래 생성 로직. checks → effects → interactions 순서.
    function _createDeal(address seller, uint256 amount, uint256 deadline, string calldata description)
        private
        returns (uint256 id)
    {
        // ── 1. Checks: 조건 검사. 하나라도 어기면 revert → 트랜잭션 전체가 없던 일이 된다.
        if (amount == 0) revert ZeroAmount();
        if (seller == address(0)) revert InvalidSeller();
        if (seller == msg.sender) revert SellerIsBuyer();
        if (deadline <= block.timestamp) revert DeadlineInPast(deadline, block.timestamp);

        // ── 2. Effects: 내 장부(storage)를 먼저 고친다.
        id = nextDealId++;
        _deals[id] = Deal({
            id: id,
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            deadline: deadline,
            description: description,
            status: Status.Funded
        });
        _dealIdsByBuyer[msg.sender].push(id);
        _dealIdsBySeller[seller].push(id);

        // ── 3. Interactions: 외부 컨트랙트(토큰) 호출은 맨 마지막에.
        // 돈이 실제로 안 들어오면(approve 부족, 잔고 부족) 여기서 revert되고 위의 기록도 전부 취소된다.
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit DealCreated(id, msg.sender, seller, amount, deadline, description);
    }

    /// @notice [쓰기] 구매확정: 구매자만 호출. 판매자에게 지급.
    function release(uint256 id) external nonReentrant {
        Deal storage d = _getFundedDeal(id);
        if (msg.sender != d.buyer) revert NotBuyer(id);

        d.status = Status.Released; // Effects 먼저 → 다시 호출돼도 이미 Released라 막힌다
        token.safeTransfer(d.seller, d.amount); // Interactions 나중

        emit DealReleased(id, d.seller, d.amount, false);
    }

    /// @notice [쓰기] 거래 취소: 판매자만 호출. 구매자에게 환불.
    /// @dev 구매자가 일방적으로 환불받을 수 있으면 물건만 받고 취소하는 악용이 생기므로,
    ///      환불은 "돈을 받을 권리가 있는 판매자"가 포기하는 형태로만 허용한다.
    function refund(uint256 id) external nonReentrant {
        Deal storage d = _getFundedDeal(id);
        if (msg.sender != d.seller) revert NotSeller(id);

        d.status = Status.Refunded;
        token.safeTransfer(d.buyer, d.amount);

        emit DealRefunded(id, d.buyer, d.amount);
    }

    /// @notice [쓰기] 마감 후 자동 지급: 마감이 지났는데 구매자가 확정을 안 했으면 판매자가 직접 받아 간다.
    /// @dev 구매자가 연락두절돼도 판매자의 돈이 영원히 묶이지 않게 하는 장치.
    ///      블록체인은 스스로 깨어나서 실행되지 않으므로(타이머 없음), "자동"이라도 누군가 트랜잭션을 보내야 한다.
    function claimAfterDeadline(uint256 id) external nonReentrant {
        Deal storage d = _getFundedDeal(id);
        if (msg.sender != d.seller) revert NotSeller(id);
        if (block.timestamp <= d.deadline) revert DeadlineNotPassed(id, d.deadline, block.timestamp);

        d.status = Status.Released;
        token.safeTransfer(d.seller, d.amount);

        emit DealReleased(id, d.seller, d.amount, true);
    }

    // ─────────────────────────── 읽기 함수 (view, 가스 없음) ───────────────────────────

    /// @notice [읽기] 거래 하나 조회
    function getDeal(uint256 id) external view returns (Deal memory) {
        Deal memory d = _deals[id];
        if (d.buyer == address(0)) revert DealNotFound(id);
        return d;
    }

    /// @notice [읽기] 내가 구매자인 거래 번호 목록
    function getDealIdsByBuyer(address buyer) external view returns (uint256[] memory) {
        return _dealIdsByBuyer[buyer];
    }

    /// @notice [읽기] 내가 판매자인 거래 번호 목록
    function getDealIdsBySeller(address seller) external view returns (uint256[] memory) {
        return _dealIdsBySeller[seller];
    }

    // ─────────────────────────── 내부 함수 ───────────────────────────

    /// @dev 존재하고 + 아직 진행중(Funded)인 거래만 꺼낸다. 세 쓰기 함수의 공통 검사.
    ///      storage 포인터를 돌려주므로 받은 쪽에서 d.status = ... 하면 실제 저장값이 바뀐다.
    function _getFundedDeal(uint256 id) private view returns (Deal storage d) {
        d = _deals[id];
        if (d.buyer == address(0)) revert DealNotFound(id);
        if (d.status != Status.Funded) revert DealNotFunded(id, d.status);
    }
}
