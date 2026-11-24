// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {Escrow} from "../src/Escrow.sol";

/// @notice MockUSD와 Escrow를 배포하고, 주소를 deployments/<chainId>.json에 기록한다.
/// @dev 실행:
///   Anvil  : forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <Anvil 0번 키>
///   Sepolia: forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --account dev
///            (--account: `cast wallet import dev --interactive`로 만든 암호화 키스토어. 개인키를 명령에 직접 적지 않는다)
///   --broadcast가 없으면 "모의 실행"만 하고 실제 트랜잭션은 보내지 않는다.
contract Deploy is Script {
    function run() external {
        // --private-key 없이 실행하면 Foundry가 "기본 계정(DEFAULT_SENDER)"으로 모의 실행하는데,
        // 그 계정은 Anvil에 ETH도 없고 배포 주소도 달라져서 헷갈린다. 아예 멈추고 안내한다.
        require(
            msg.sender != DEFAULT_SENDER,
            unicode"--private-key 를 붙여 실행하세요 (README의 배포 명령 참고). 지금은 Foundry 기본 계정으로 모의 실행 중입니다."
        );

        // startBroadcast~stopBroadcast 사이의 "쓰기" 호출은 각각 실제 서명된 트랜잭션이 되어 체인에 전송된다.
        // 컨트랙트 배포도 트랜잭션이다. (받는 주소(to)가 비어 있고 data에 바이트코드가 담긴 특별한 트랜잭션)
        // 웹 화면이 이벤트 로그를 "이 블록부터" 찾게 하려고 배포 직전 블록 번호를 기록한다.
        // (실제 배포 트랜잭션은 이 블록 이후에 담기므로 안전한 시작점이다)
        uint256 startBlock = block.number;

        vm.startBroadcast();

        MockUSD token = new MockUSD(); // 트랜잭션 1 (배포자 nonce 0)
        Escrow escrow = new Escrow(token); // 트랜잭션 2 (nonce 1) — 어떤 토큰을 쓸지 생성자로 알려줌

        vm.stopBroadcast();

        console.log("MockUSD:", address(token));
        console.log("Escrow :", address(escrow));

        // 웹 화면(5단계)이 읽어 갈 주소 파일. foundry.toml의 fs_permissions로 이 폴더에만 쓰기를 허용했다.
        // --broadcast로 "실제 배포"했을 때만 쓴다. 모의 실행 주소가 파일에 들어가면 화면이 없는 컨트랙트를 바라보게 된다.
        if (!vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            console.log(
                unicode"모의 실행이라 deployments 파일은 그대로 둡니다. 실제 배포는 --broadcast 를 붙이세요."
            );
            return;
        }
        string memory obj = "deployments";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "startBlock", startBlock);
        vm.serializeAddress(obj, "MockUSD", address(token));
        string memory json = vm.serializeAddress(obj, "Escrow", address(escrow));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
