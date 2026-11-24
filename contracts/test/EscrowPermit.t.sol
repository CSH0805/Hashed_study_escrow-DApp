// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {Escrow} from "../src/Escrow.sol";

/// @notice permit(EIP-2612) 방식 테스트: approve 트랜잭션 없이 "서명 + createDealWithPermit 한 번"
contract EscrowPermitTest is Test {
    MockUSD token;
    Escrow escrow;

    // makeAddrAndKey: 주소와 함께 개인키도 만든다. 서명(vm.sign)을 하려면 개인키가 필요하기 때문.
    address buyer;
    uint256 buyerKey;
    address stranger;
    uint256 strangerKey;
    address seller = makeAddr("seller");

    uint256 constant AMOUNT = 100 * 1e6;
    uint256 deadline;

    // EIP-2612가 정한 "Permit" 메시지의 형식. 지갑이 서명 창에 보여 주는 항목들과 같다.
    bytes32 constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function setUp() public {
        (buyer, buyerKey) = makeAddrAndKey("buyer");
        (stranger, strangerKey) = makeAddrAndKey("stranger");
        token = new MockUSD();
        escrow = new Escrow(token);
        deadline = block.timestamp + 7 days;

        vm.prank(buyer);
        token.faucet(); // 잔고만 있고 approve는 하지 않는다!
    }

    /// @dev 지갑(MetaMask)이 eth_signTypedData_v4로 하는 일을 테스트에서 재현한다.
    ///      digest = keccak256("\x19\x01" ‖ 도메인(토큰 이름·버전·체인ID·토큰 주소) ‖ 메시지 해시)
    ///      → 이 32바이트 해시에 개인키로 ECDSA 서명 → (v, r, s)
    function _sign(uint256 key, address owner, uint256 value, uint256 nonce, uint256 permitDeadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, owner, address(escrow), value, nonce, permitDeadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(key, digest);
    }

    // ═══════════════════════════ 정상 흐름 ═══════════════════════════

    function test_CreateDealWithPermit_NoApproveTransaction() public {
        assertEq(token.allowance(buyer, address(escrow)), 0); // 승인 안 된 상태에서 시작
        assertEq(token.nonces(buyer), 0);

        uint256 permitDeadline = block.timestamp + 20 minutes;
        (uint8 v, bytes32 r, bytes32 s) = _sign(buyerKey, buyer, AMOUNT, 0, permitDeadline);

        vm.prank(buyer);
        uint256 id = escrow.createDealWithPermit(seller, AMOUNT, deadline, "permit", permitDeadline, v, r, s);

        assertEq(id, 1);
        assertEq(token.balanceOf(address(escrow)), AMOUNT);
        assertEq(token.balanceOf(buyer), 900 * 1e6);
        assertEq(token.allowance(buyer, address(escrow)), 0); // 승인된 만큼 정확히 써서 0으로 돌아옴
        assertEq(token.nonces(buyer), 1); // 서명 1개 사용 → nonce 증가 (같은 서명 재사용 방지)
        assertEq(escrow.getDeal(id).buyer, buyer);
    }

    /// 공격자가 멤풀에서 서명을 보고 token.permit()을 먼저 제출해도(front-running) 구매자의 거래는 성공해야 한다
    function test_CreateDealWithPermit_SurvivesFrontRunning() public {
        uint256 permitDeadline = block.timestamp + 20 minutes;
        (uint8 v, bytes32 r, bytes32 s) = _sign(buyerKey, buyer, AMOUNT, 0, permitDeadline);

        vm.prank(stranger);
        token.permit(buyer, address(escrow), AMOUNT, permitDeadline, v, r, s); // 공격자가 먼저 사용

        vm.prank(buyer);
        escrow.createDealWithPermit(seller, AMOUNT, deadline, "", permitDeadline, v, r, s);
        assertEq(token.balanceOf(address(escrow)), AMOUNT);
    }

    // ═══════════════════════════ 실패해야 하는 경우 ═══════════════════════════

    /// 다른 사람 키로 만든 서명 → 서명자 ≠ owner(msg.sender)
    function test_RevertWhen_SignedByWrongKey() public {
        uint256 permitDeadline = block.timestamp + 20 minutes;
        (uint8 v, bytes32 r, bytes32 s) = _sign(strangerKey, buyer, AMOUNT, 0, permitDeadline);

        vm.prank(buyer);
        vm.expectRevert(Escrow.PermitFailed.selector);
        escrow.createDealWithPermit(seller, AMOUNT, deadline, "", permitDeadline, v, r, s);
    }

    /// 남의 서명을 주워서 제출 → owner가 msg.sender(stranger)로 고정되므로 서명 검증 실패
    function test_RevertWhen_SomeoneElseSubmitsBuyersSignature() public {
        vm.prank(stranger);
        token.faucet();

        uint256 permitDeadline = block.timestamp + 20 minutes;
        (uint8 v, bytes32 r, bytes32 s) = _sign(buyerKey, buyer, AMOUNT, 0, permitDeadline);

        vm.prank(stranger);
        vm.expectRevert(Escrow.PermitFailed.selector);
        escrow.createDealWithPermit(seller, AMOUNT, deadline, "", permitDeadline, v, r, s);
    }

    /// 서명 유효기한이 지난 경우
    function test_RevertWhen_PermitExpired() public {
        uint256 permitDeadline = block.timestamp + 20 minutes;
        (uint8 v, bytes32 r, bytes32 s) = _sign(buyerKey, buyer, AMOUNT, 0, permitDeadline);

        vm.warp(permitDeadline + 1);
        vm.prank(buyer);
        vm.expectRevert(Escrow.PermitFailed.selector);
        escrow.createDealWithPermit(seller, AMOUNT, deadline + 1 days, "", permitDeadline, v, r, s);
    }

    /// 50 mUSD로 서명하고 100 mUSD로 제출 → 해시가 달라져 서명 검증 실패 (서명은 내용 전체를 묶는다)
    function test_RevertWhen_AmountDiffersFromSigned() public {
        uint256 permitDeadline = block.timestamp + 20 minutes;
        (uint8 v, bytes32 r, bytes32 s) = _sign(buyerKey, buyer, 50 * 1e6, 0, permitDeadline);

        vm.prank(buyer);
        vm.expectRevert(Escrow.PermitFailed.selector);
        escrow.createDealWithPermit(seller, AMOUNT, deadline, "", permitDeadline, v, r, s);
    }

    /// 같은 서명을 두 번 사용 → 두 번째는 nonce가 이미 1이라 실패 (재사용 공격 방지)
    function test_RevertWhen_SignatureReused() public {
        uint256 permitDeadline = block.timestamp + 20 minutes;
        (uint8 v, bytes32 r, bytes32 s) = _sign(buyerKey, buyer, AMOUNT, 0, permitDeadline);

        vm.startPrank(buyer);
        escrow.createDealWithPermit(seller, AMOUNT, deadline, "", permitDeadline, v, r, s);
        vm.expectRevert(Escrow.PermitFailed.selector);
        escrow.createDealWithPermit(seller, AMOUNT, deadline, "", permitDeadline, v, r, s);
        vm.stopPrank();
    }

    /// permit이 맞아도 거래 규칙은 그대로 적용된다
    function test_RevertWhen_PermitValidButSellerIsBuyer() public {
        uint256 permitDeadline = block.timestamp + 20 minutes;
        (uint8 v, bytes32 r, bytes32 s) = _sign(buyerKey, buyer, AMOUNT, 0, permitDeadline);

        vm.prank(buyer);
        vm.expectRevert(Escrow.SellerIsBuyer.selector);
        escrow.createDealWithPermit(buyer, AMOUNT, deadline, "", permitDeadline, v, r, s);
        assertEq(token.nonces(buyer), 0); // revert라서 permit(nonce 사용)까지 전부 없던 일
    }

    // ═══════════════════════════ 가스 비교 ═══════════════════════════

    /// 방식 A(approve tx + createDeal tx) vs 방식 B(서명 + createDealWithPermit tx)
    /// forge test -vv 로 실행하면 로그로 확인할 수 있다.
    function test_GasComparison() public {
        // 방식 A: 별도의 판매자 두 명으로 같은 조건(첫 거래) 비교
        address sellerA = makeAddr("sellerA");
        address sellerB = makeAddr("sellerB");

        vm.startPrank(buyer);
        uint256 g0 = gasleft();
        token.approve(address(escrow), AMOUNT);
        uint256 gApprove = g0 - gasleft();
        g0 = gasleft();
        escrow.createDeal(sellerA, AMOUNT, deadline, "");
        uint256 gCreate = g0 - gasleft();
        vm.stopPrank();

        uint256 permitDeadline = block.timestamp + 20 minutes;
        (uint8 v, bytes32 r, bytes32 s) = _sign(buyerKey, buyer, AMOUNT, 0, permitDeadline);
        vm.prank(buyer);
        g0 = gasleft();
        escrow.createDealWithPermit(sellerB, AMOUNT, deadline, "", permitDeadline, v, r, s);
        uint256 gPermit = g0 - gasleft();

        emit log_named_uint("A: approve", gApprove);
        emit log_named_uint("A: createDeal", gCreate);
        emit log_named_uint("B: createDealWithPermit", gPermit);
        // 실제 트랜잭션은 tx마다 기본 21,000 가스가 붙으므로 A는 그만큼 더 비싸다
    }
}
