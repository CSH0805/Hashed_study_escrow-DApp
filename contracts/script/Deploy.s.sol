// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {Escrow} from "../src/Escrow.sol";

/// @notice MockUSD와 Escrow를 배포하고, 주소를 deployments/<chainId>.json에 기록한다.
/// @dev 실행:
///   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <Anvil 0번 키>
///   --broadcast가 없으면 "모의 실행"만 하고 실제 트랜잭션은 보내지 않는다.
contract Deploy is Script {
    function run() external {
        // startBroadcast~stopBroadcast 사이의 "쓰기" 호출은 각각 실제 서명된 트랜잭션이 되어 체인에 전송된다.
        // 컨트랙트 배포도 트랜잭션이다. (받는 주소(to)가 비어 있고 data에 바이트코드가 담긴 특별한 트랜잭션)
        vm.startBroadcast();

        MockUSD token = new MockUSD(); // 트랜잭션 1 (배포자 nonce 0)
        Escrow escrow = new Escrow(token); // 트랜잭션 2 (nonce 1) — 어떤 토큰을 쓸지 생성자로 알려줌

        vm.stopBroadcast();

        console.log("MockUSD:", address(token));
        console.log("Escrow :", address(escrow));

        // 웹 화면(5단계)이 읽어 갈 주소 파일. foundry.toml의 fs_permissions로 이 폴더에만 쓰기를 허용했다.
        string memory obj = "deployments";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "MockUSD", address(token));
        string memory json = vm.serializeAddress(obj, "Escrow", address(escrow));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
