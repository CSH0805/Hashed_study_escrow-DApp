// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {Escrow} from "../src/Escrow.sol";

contract EscrowTest is Test {
    MockUSD token;
    Escrow escrow;

    address buyer = makeAddr("buyer");
    address seller = makeAddr("seller");
    address stranger = makeAddr("stranger"); // 거래와 상관없는 제3자

    uint256 constant AMOUNT = 100 * 1e6; // 100 mUSD
    uint256 deadline;

    function setUp() public {
        token = new MockUSD();
        escrow = new Escrow(token);
        deadline = block.timestamp + 7 days;

        // 구매자: 1,000 mUSD 받고, 에스크로에 넉넉히 approve (실제 화면의 "1단계 승인"에 해당)
        vm.startPrank(buyer);
        token.faucet();
        token.approve(address(escrow), type(uint256).max);
        vm.stopPrank();
    }

    /// @dev 공통 준비: 구매자가 거래 하나를 만든다 (화면의 "2단계 예치")
    function _createDeal() internal returns (uint256 id) {
        vm.prank(buyer);
        // 한글 같은 비ASCII 문자열은 unicode"..." 로 써야 컴파일된다
        id = escrow.createDeal(seller, AMOUNT, deadline, unicode"중고 키보드");
    }

    // ═══════════════════════════ 정상 흐름 ═══════════════════════════

    function test_CreateDeal_LocksFundsAndStoresDeal() public {
        vm.expectEmit(true, true, true, true, address(escrow));
        emit Escrow.DealCreated(1, buyer, seller, AMOUNT, deadline, unicode"중고 키보드");

        uint256 id = _createDeal();

        assertEq(id, 1); // 거래 번호는 1부터
        assertEq(escrow.nextDealId(), 2);
        // 돈이 구매자 → 에스크로 컨트랙트로 이동
        assertEq(token.balanceOf(buyer), 900 * 1e6);
        assertEq(token.balanceOf(address(escrow)), AMOUNT);

        Escrow.Deal memory d = escrow.getDeal(id);
        assertEq(d.id, 1);
        assertEq(d.buyer, buyer);
        assertEq(d.seller, seller);
        assertEq(d.amount, AMOUNT);
        assertEq(d.deadline, deadline);
        assertEq(d.description, unicode"중고 키보드");
        assertEq(uint8(d.status), uint8(Escrow.Status.Funded));

        // 목록용 view 함수
        assertEq(escrow.getDealIdsByBuyer(buyer).length, 1);
        assertEq(escrow.getDealIdsByBuyer(buyer)[0], 1);
        assertEq(escrow.getDealIdsBySeller(seller)[0], 1);
        assertEq(escrow.getDealIdsByBuyer(seller).length, 0); // 판매자는 구매자 목록에 없음
    }

    /// 결말 1: 구매확정
    function test_Release_PaysSeller() public {
        uint256 id = _createDeal();

        vm.expectEmit(true, true, false, true, address(escrow));
        emit Escrow.DealReleased(id, seller, AMOUNT, false);

        vm.prank(buyer);
        escrow.release(id);

        assertEq(token.balanceOf(seller), AMOUNT);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(uint8(escrow.getDeal(id).status), uint8(Escrow.Status.Released));
    }

    /// 결말 2: 판매자가 거래 취소 → 구매자 환불
    function test_Refund_ReturnsToBuyer() public {
        uint256 id = _createDeal();

        vm.expectEmit(true, true, false, true, address(escrow));
        emit Escrow.DealRefunded(id, buyer, AMOUNT);

        vm.prank(seller);
        escrow.refund(id);

        assertEq(token.balanceOf(buyer), 1_000 * 1e6); // 원래대로
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(uint8(escrow.getDeal(id).status), uint8(Escrow.Status.Refunded));
    }

    /// 결말 3: 마감 후 판매자가 직접 받아 감
    function test_ClaimAfterDeadline_PaysSeller() public {
        uint256 id = _createDeal();

        // vm.warp: 블록 시각을 강제로 옮기는 치트코드. (Anvil에서는 cast rpc evm_increaseTime으로 같은 일을 함)
        vm.warp(deadline + 1);

        vm.expectEmit(true, true, false, true, address(escrow));
        emit Escrow.DealReleased(id, seller, AMOUNT, true);

        vm.prank(seller);
        escrow.claimAfterDeadline(id);

        assertEq(token.balanceOf(seller), AMOUNT);
        assertEq(uint8(escrow.getDeal(id).status), uint8(Escrow.Status.Released));
    }

    /// 마감이 지나도 판매자가 아직 안 받아 갔다면 구매자는 여전히 구매확정할 수 있다
    function test_Release_StillWorksAfterDeadline() public {
        uint256 id = _createDeal();
        vm.warp(deadline + 1);

        vm.prank(buyer);
        escrow.release(id);
        assertEq(token.balanceOf(seller), AMOUNT);
    }

    /// 여러 거래가 서로 섞이지 않는지
    function test_MultipleDeals_AreIndependent() public {
        uint256 id1 = _createDeal();
        uint256 id2 = _createDeal();
        assertEq(token.balanceOf(address(escrow)), AMOUNT * 2);

        vm.prank(seller);
        escrow.refund(id1);

        assertEq(token.balanceOf(address(escrow)), AMOUNT); // id2 몫은 그대로 묶여 있음
        assertEq(uint8(escrow.getDeal(id2).status), uint8(Escrow.Status.Funded));
        assertEq(escrow.getDealIdsByBuyer(buyer).length, 2);
    }

    // ═══════════════════════ 규칙 위반: createDeal ═══════════════════════

    function test_RevertWhen_AmountIsZero() public {
        vm.prank(buyer);
        vm.expectRevert(Escrow.ZeroAmount.selector);
        escrow.createDeal(seller, 0, deadline, "");
    }

    function test_RevertWhen_SellerIsZeroAddress() public {
        vm.prank(buyer);
        vm.expectRevert(Escrow.InvalidSeller.selector);
        escrow.createDeal(address(0), AMOUNT, deadline, "");
    }

    function test_RevertWhen_SellerIsBuyer() public {
        vm.prank(buyer);
        vm.expectRevert(Escrow.SellerIsBuyer.selector);
        escrow.createDeal(buyer, AMOUNT, deadline, "");
    }

    function test_RevertWhen_DeadlineInPast() public {
        uint256 past = block.timestamp - 1;
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.DeadlineInPast.selector, past, block.timestamp));
        escrow.createDeal(seller, AMOUNT, past, "");
    }

    function test_RevertWhen_DeadlineIsNow() public {
        // "지금"도 과거로 취급 (마감이 지금이면 바로 판매자가 받아 갈 수 있어 의미가 없음)
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.DeadlineInPast.selector, block.timestamp, block.timestamp));
        escrow.createDeal(seller, AMOUNT, block.timestamp, "");
    }

    /// approve를 안 했으면 transferFrom이 실패 → 거래 기록도 같이 취소(원자성)
    function test_RevertWhen_NotApproved() public {
        vm.prank(stranger);
        token.faucet(); // 돈은 있지만 approve는 안 함

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(escrow), 0, AMOUNT)
        );
        escrow.createDeal(seller, AMOUNT, deadline, "");

        assertEq(escrow.nextDealId(), 1); // revert됐으니 번호도 안 올라감
    }

    function test_RevertWhen_InsufficientBalance() public {
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, buyer, 1_000 * 1e6, 1_001 * 1e6)
        );
        escrow.createDeal(seller, 1_001 * 1e6, deadline, "");
    }

    // ═══════════════════════ 규칙 위반: 권한(역할) ═══════════════════════

    function test_RevertWhen_SellerCallsRelease() public {
        uint256 id = _createDeal();
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(Escrow.NotBuyer.selector, id));
        escrow.release(id);
    }

    function test_RevertWhen_StrangerCallsRelease() public {
        uint256 id = _createDeal();
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Escrow.NotBuyer.selector, id));
        escrow.release(id);
    }

    /// 2단계 확인 질문: 구매자가 refund를 부르면? → NotSeller로 거부
    function test_RevertWhen_BuyerCallsRefund() public {
        uint256 id = _createDeal();
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.NotSeller.selector, id));
        escrow.refund(id);
    }

    function test_RevertWhen_BuyerCallsClaimAfterDeadline() public {
        uint256 id = _createDeal();
        vm.warp(deadline + 1);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.NotSeller.selector, id));
        escrow.claimAfterDeadline(id);
    }

    // ═══════════════════════ 규칙 위반: 시간 ═══════════════════════

    function test_RevertWhen_ClaimBeforeDeadline() public {
        uint256 id = _createDeal();
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(Escrow.DeadlineNotPassed.selector, id, deadline, block.timestamp));
        escrow.claimAfterDeadline(id);
    }

    function test_RevertWhen_ClaimExactlyAtDeadline() public {
        // 경계값: 마감 "그 순간"은 아직 안 지난 것
        uint256 id = _createDeal();
        vm.warp(deadline);
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(Escrow.DeadlineNotPassed.selector, id, deadline, deadline));
        escrow.claimAfterDeadline(id);
    }

    // ═══════════════════════ 규칙 위반: 끝난 거래 재처리 ═══════════════════════

    function test_RevertWhen_ReleaseTwice() public {
        uint256 id = _createDeal();
        vm.startPrank(buyer);
        escrow.release(id);
        vm.expectRevert(abi.encodeWithSelector(Escrow.DealNotFunded.selector, id, Escrow.Status.Released));
        escrow.release(id); // 두 번 지급되면 안 됨
        vm.stopPrank();
    }

    function test_RevertWhen_RefundAfterRelease() public {
        uint256 id = _createDeal();
        vm.prank(buyer);
        escrow.release(id);

        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(Escrow.DealNotFunded.selector, id, Escrow.Status.Released));
        escrow.refund(id);
    }

    function test_RevertWhen_ReleaseAfterRefund() public {
        uint256 id = _createDeal();
        vm.prank(seller);
        escrow.refund(id);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.DealNotFunded.selector, id, Escrow.Status.Refunded));
        escrow.release(id);
    }

    function test_RevertWhen_ClaimAfterRefund() public {
        uint256 id = _createDeal();
        vm.prank(seller);
        escrow.refund(id);

        vm.warp(deadline + 1);
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(Escrow.DealNotFunded.selector, id, Escrow.Status.Refunded));
        escrow.claimAfterDeadline(id);
    }

    function test_RevertWhen_ClaimTwice() public {
        uint256 id = _createDeal();
        vm.warp(deadline + 1);
        vm.startPrank(seller);
        escrow.claimAfterDeadline(id);
        vm.expectRevert(abi.encodeWithSelector(Escrow.DealNotFunded.selector, id, Escrow.Status.Released));
        escrow.claimAfterDeadline(id);
        vm.stopPrank();
    }

    // ═══════════════════════ 없는 거래 ═══════════════════════

    function test_RevertWhen_DealDoesNotExist() public {
        vm.expectRevert(abi.encodeWithSelector(Escrow.DealNotFound.selector, 42));
        escrow.getDeal(42);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.DealNotFound.selector, 42));
        escrow.release(42);
    }

    // ═══════════════════════ 퍼즈(fuzz) 테스트 ═══════════════════════

    /// 인자가 있는 테스트는 Foundry가 무작위 값을 수백 번 넣어 본다.
    /// "어떤 금액이든 예치 → 구매확정 후 돈이 새거나 생기지 않는다"를 검사.
    function testFuzz_ReleaseConservesFunds(uint256 amount) public {
        amount = bound(amount, 1, 1_000 * 1e6); // 구매자 잔고 범위로 제한
        vm.prank(buyer);
        uint256 id = escrow.createDeal(seller, amount, deadline, "");

        vm.prank(buyer);
        escrow.release(id);

        assertEq(token.balanceOf(seller), amount);
        assertEq(token.balanceOf(buyer), 1_000 * 1e6 - amount);
        assertEq(token.balanceOf(address(escrow)), 0);
    }
}

// ═══════════════════════════ 재진입(reentrancy) 공격 테스트 ═══════════════════════════

/// @dev 송금을 받는 순간 에스크로를 다시 호출하는 "악성 토큰".
///      이 토큰 컨트랙트 자신이 판매자가 되어, 돈을 받는 도중에 claimAfterDeadline을 한 번 더 불러
///      이중 지급을 노린다. (The DAO 해킹과 같은 패턴)
contract ReentrantToken is ERC20 {
    Escrow public escrow;
    uint256 public targetId;
    bool public attacking;
    bytes public reentryError; // 재진입 시도가 어떤 오류로 막혔는지 기록

    constructor() ERC20("Evil", "EVIL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setup(Escrow escrow_, uint256 id) external {
        escrow = escrow_;
        targetId = id;
    }

    function attack() external {
        attacking = true;
        escrow.claimAfterDeadline(targetId); // 판매자(=이 컨트랙트)로서 정상 호출
        attacking = false;
    }

    /// 모든 잔고 변경 때 불리는 OpenZeppelin 훅. 에스크로가 나(판매자)에게 보내는 순간 재진입 시도.
    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (attacking && from == address(escrow) && to == address(this)) {
            attacking = false; // 한 번만 시도
            try escrow.claimAfterDeadline(targetId) {}
            catch (bytes memory err) {
                reentryError = err;
            }
        }
    }
}

contract EscrowReentrancyTest is Test {
    function test_ReentrancyIsBlocked() public {
        ReentrantToken evil = new ReentrantToken();
        Escrow escrow = new Escrow(evil);
        address buyer = makeAddr("buyer");

        evil.mint(buyer, 100);
        vm.startPrank(buyer);
        evil.approve(address(escrow), 100);
        uint256 id = escrow.createDeal(address(evil), 100, block.timestamp + 1, "");
        vm.stopPrank();

        evil.mint(address(escrow), 100); // 에스크로에 "훔칠 수 있는" 다른 돈도 있다고 가정
        evil.setup(escrow, id);
        vm.warp(block.timestamp + 2);

        evil.attack();

        // 판매자는 딱 한 번(100)만 받았고, 나머지 100은 에스크로에 그대로 남아 있다
        assertEq(evil.balanceOf(address(evil)), 100);
        assertEq(evil.balanceOf(address(escrow)), 100);
        // 두 번째 호출은 nonReentrant 잠금에 걸려 막혔다
        assertEq(evil.reentryError(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector));
    }
}
