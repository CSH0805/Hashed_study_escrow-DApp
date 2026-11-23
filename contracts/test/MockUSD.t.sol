// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockUSD} from "../src/MockUSD.sol";

/// @dev Foundry 테스트 규칙: 이름이 test로 시작하는 함수가 하나의 테스트.
///      매 테스트마다 setUp()이 다시 실행되어 "깨끗한 새 체인"에서 시작한다.
contract MockUSDTest is Test {
    MockUSD token;
    address alice = makeAddr("alice"); // 이름으로 테스트용 주소를 만들어 줌 (로그에도 이름이 찍혀 읽기 쉬움)

    function setUp() public {
        token = new MockUSD();
    }

    function test_Metadata() public view {
        assertEq(token.name(), "Mock USD");
        assertEq(token.symbol(), "mUSD");
        assertEq(token.decimals(), 6); // USDC와 동일
        assertEq(token.totalSupply(), 0); // 처음엔 아무도 없음
    }

    function test_Faucet_Gives1000mUSD() public {
        // vm.prank: "다음 호출 한 번은 alice가 보낸 것으로" 만드는 Foundry 치트코드.
        // 실제 체인에서는 alice의 개인키 서명이 있어야 가능한 일이다.
        vm.prank(alice);
        token.faucet();

        assertEq(token.balanceOf(alice), 1_000 * 1e6); // 1,000 mUSD = 1,000,000,000 (정수)
        assertEq(token.totalSupply(), 1_000 * 1e6);
    }

    function test_Faucet_EmitsEvents() public {
        // 다음 호출에서 이 이벤트가 정확히 나와야 통과
        vm.expectEmit(true, false, false, true, address(token));
        emit MockUSD.FaucetClaimed(alice, 1_000 * 1e6);

        vm.prank(alice);
        token.faucet();
    }

    function test_Faucet_CanBeCalledRepeatedly() public {
        vm.startPrank(alice);
        token.faucet();
        token.faucet();
        token.faucet();
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 3_000 * 1e6);
    }
}
