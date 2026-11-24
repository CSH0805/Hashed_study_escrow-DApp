# 기술 문서

이 디앱의 구조, 컨트랙트 로직, 웹 화면 동작, 테스트를 설명합니다.
소개는 [README.md](../README.md), 실행 방법은 [GETTING_STARTED.md](GETTING_STARTED.md)를 보세요.

- [1. 전체 구조](#1-전체-구조)
- [2. 폴더 구성](#2-폴더-구성)
- [3. 스마트 컨트랙트](#3-스마트-컨트랙트)
- [4. 웹 화면](#4-웹-화면)
- [5. 테스트](#5-테스트)
- [6. 강의와의 연결](#6-강의와의-연결)

---

## 1. 전체 구조

```
[웹 화면]  web/ — React + wagmi v2 + viem        ← 일반 웹앱의 프론트엔드
   │  읽기: 화면이 노드에 직접 물어봄 (eth_call · 가스 없음 · 서명 없음)
   │  쓰기: 지갑에 서명을 부탁함 ↓
[지갑]     MetaMask — 개인키 보관·서명           ← 로그인 + 결제 비밀번호
   │  서명된 트랜잭션 전송 ↓
[블록체인 네트워크] Anvil (127.0.0.1:8545)      ← 서버 + DB (실제 이더리움은 수천 개 노드)
   │  블록에 담아 실행 ↓
[스마트 컨트랙트] contracts/ — MockUSD, Escrow  ← 백엔드 로직 (배포 후 수정 불가, 누구나 검증 가능)
```

백엔드 서버가 없습니다. 화면은 읽기를 노드에 직접 요청하고, 쓰기는 MetaMask를 거쳐 보냅니다. 개인키는 MetaMask 안에만 있고 화면은 볼 수 없습니다.

### 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 컨트랙트 | Solidity 0.8.30, [Foundry](https://getfoundry.sh/) (forge · anvil · cast), OpenZeppelin Contracts v5.7.0 |
| 웹 | Vite, React, TypeScript, wagmi v2 (2.19.5), viem, TanStack Query |
| 지갑 | MetaMask (injected connector만 사용, WalletConnect 등 외부 키 없음) |
| 체인 | Anvil 로컬 (chainId 31337) |
| CI | GitHub Actions — 컨트랙트 fmt·build·test, 웹 build·lint ([.github/workflows](../.github/workflows)) |

---

## 2. 폴더 구성

```
escrow-DApp/
├── contracts/                    Foundry 프로젝트
│   ├── src/
│   │   ├── MockUSD.sol           테스트용 스테이블코인 (ERC-20 + permit)
│   │   └── Escrow.sol            에스크로 본체
│   ├── test/                     Foundry 테스트 41개
│   ├── script/Deploy.s.sol       배포 스크립트
│   ├── deployments/31337.json    배포 주소 (웹이 읽음)
│   └── lib/                      OpenZeppelin, forge-std (git submodule)
└── web/                          Vite + React
    ├── scripts/
    │   ├── sync-contracts.mjs    ABI·주소 → src/contracts/generated.ts
    │   └── fix-nonce.mjs         Anvil 재시작 후 nonce 꼬임 해결
    └── src/
        ├── wagmi.ts              체인·지갑·RPC 설정
        ├── contracts/generated.ts  (자동 생성) ABI와 주소
        ├── hooks/                useTx(쓰기 공통), usePermit(서명), useChainNow(체인 시각)
        ├── components/           Header, Faucet, CreateDeal, DealList, DealDetail, DealTimeline, TxStatus
        └── lib/                  errors(한국어 오류), format, gas
```

---

## 3. 스마트 컨트랙트

### MockUSD ([contracts/src/MockUSD.sol](../contracts/src/MockUSD.sol))

| 항목 | 값 |
|---|---|
| 기반 | OpenZeppelin `ERC20` + `ERC20Permit` (EIP-2612) |
| 이름 / 심볼 / 소수점 | `Mock USD` / `mUSD` / **6** (USDC와 동일) |
| `faucet()` | 호출한 사람(`msg.sender`)에게 1,000 mUSD 발행. 받는 주소를 인자로 받지 않아 남의 주소로 장난칠 수 없음 |

EVM에는 소수가 없어서 금액은 항상 정수로 저장합니다. `1 mUSD = 1_000_000`이고, `decimals = 6`은 "화면에서 뒤 6자리에 점을 찍어 보여 달라"는 약속입니다.

### Escrow ([contracts/src/Escrow.sol](../contracts/src/Escrow.sol))

#### 거래 데이터

```solidity
struct Deal { uint256 id; address buyer; address seller; uint256 amount; uint256 deadline; string description; Status status; }
enum Status { Funded, Released, Refunded }   // 진행중 / 지급완료 / 환불완료
```

- 거래 번호는 **1부터** 시작합니다. 0번을 비워 두어 `buyer == address(0)`이면 "없는 거래"로 판별합니다.
- 블록체인은 `WHERE buyer = 나` 같은 검색을 못 하므로, 거래를 만들 때 **주소별 거래 번호 목록**(`_dealIdsByBuyer`, `_dealIdsBySeller`)을 함께 저장합니다.

#### 함수

| 함수 | 종류 | 누가 | 하는 일 |
|---|---|---|---|
| `createDeal(seller, amount, deadline, description)` | 쓰기 | 구매자 | 미리 `approve`받은 mUSD를 `transferFrom`으로 예치하고 거래 생성 |
| `createDealWithPermit(…, permitDeadline, v, r, s)` | 쓰기 | 구매자 | permit 서명으로 승인과 예치를 트랜잭션 한 번에 처리 |
| `release(id)` | 쓰기 | 구매자 | 구매확정 → 판매자에게 지급 |
| `refund(id)` | 쓰기 | 판매자 | 거래 취소 → 구매자에게 환불 |
| `claimAfterDeadline(id)` | 쓰기 | 판매자 | `block.timestamp > deadline`이면 판매자가 직접 받아 감 |
| `getDeal(id)` | 읽기 (view) | 누구나 | 거래 하나 조회 |
| `getDealIdsByBuyer(addr)` / `getDealIdsBySeller(addr)` | 읽기 (view) | 누구나 | 주소별 거래 번호 목록 |

#### 상태 전이

```
            createDeal / createDealWithPermit
                         │
                         ▼
                     [Funded]
          ┌──────────────┼──────────────────┐
  release (구매자)   refund (판매자)   claimAfterDeadline (판매자, 마감 후)
          ▼              ▼                  ▼
     [Released]     [Refunded]         [Released]
```

`Funded`가 아닌 거래에 쓰기 함수를 부르면 `DealNotFunded`로 거부됩니다.

#### 규칙과 custom error

| 규칙 | 오류 |
|---|---|
| 금액 0 불가 | `ZeroAmount` |
| 판매자 주소 0 불가 | `InvalidSeller` |
| 판매자 = 구매자 불가 | `SellerIsBuyer` |
| 마감이 지금이거나 과거면 불가 | `DeadlineInPast` |
| 없는 거래 | `DealNotFound` |
| 구매확정은 구매자만 | `NotBuyer` |
| 환불·마감 후 지급은 판매자만 | `NotSeller` |
| 끝난 거래 재처리 불가 | `DealNotFunded` |
| 마감 전 자동 지급 불가 (마감 "그 순간"도 불가) | `DeadlineNotPassed` |
| permit 서명이 틀림·만료·재사용 | `PermitFailed` |

`require("문자열")` 대신 custom error를 쓰면 가스가 싸고, 화면이 오류 **이름**으로 정확한 한국어 안내를 띄울 수 있습니다.

#### 이벤트

`DealCreated`, `DealReleased(afterDeadline 포함)`, `DealRefunded`. 거래 번호 `id`가 `indexed`라서 "이 거래의 로그만" 걸러 조회할 수 있습니다. 화면의 거래 내역 타임라인이 이 로그를 읽습니다.

#### 보안

| 장치 | 이유 |
|---|---|
| **checks → effects → interactions** | 조건 검사 → 장부(status) 수정 → 송금 순서. 송금 중 재호출돼도 이미 상태가 바뀌어 있어 이중 지급 불가 |
| **ReentrancyGuard** (`nonReentrant`) | 재진입 자체를 잠금. 2016년 The DAO 해킹과 같은 유형의 공격 방지 |
| **SafeERC20** | `transfer`가 실패해도 `false`만 돌려주는 토큰까지 확실히 revert 처리 |
| **금액만큼만 approve** | 화면은 무한 승인 대신 이번 거래 금액만 승인 |
| **환불은 판매자만** | 구매자가 물건만 받고 일방적으로 환불하는 악용 방지 |

`block.timestamp`는 검증자가 정하지만 실제 이더리움(12초 슬롯)에서는 몇 초 이상 조작할 수 없으므로, 며칠 단위 마감 판정에는 안전합니다.

### 거래를 만드는 두 가지 방식

| | 방식 A: approve | 방식 B: permit (EIP-2612) |
|---|---|---|
| 1단계 | `approve` **트랜잭션** (가스, 블록에 기록, 계정 nonce +1) | EIP-712 **서명만** (가스 0, 네트워크에 안 보냄, 블록·nonce 변화 없음) |
| 2단계 | `createDeal` 트랜잭션 | `createDealWithPermit` 트랜잭션 — 서명(v, r, s)을 실어 보냄 → 토큰이 `ecrecover`로 서명자를 복원해 승인 처리 |
| 트랜잭션 수 | 2번 | 1번 |
| 가스 (첫 거래 기준) | approve 54,541 + createDeal 287,806 + 기본 21,000 × 2 ≈ **384,000** | createDealWithPermit 307,929 + 기본 21,000 ≈ **329,000** |

permit 서명이 안전한 이유:
- 서명에 **도메인**(토큰 이름 `Mock USD`, 버전 `1`, 체인 ID, 토큰 주소)이 묶여 있어서 다른 체인·다른 토큰에서 재사용할 수 없습니다.
- 토큰 안의 **permit nonce**가 서명 한 번에 1씩 올라가서 같은 서명을 두 번 쓸 수 없습니다.
- **유효기한**(`permitDeadline`)이 지나면 쓸 수 없습니다. 화면은 체인 시각 + 20분으로 설정합니다.
- `owner`를 `msg.sender`로 고정해서, 남의 서명을 주워 그 사람 돈으로 거래를 만들 수 없습니다.
- 서명은 멤풀에서 누구나 볼 수 있어서 공격자가 먼저 `permit()`을 제출(front-running)할 수 있습니다. 이 경우에도 `try/catch`로 넘어가고, 승인액이 충분하면 거래가 그대로 진행됩니다.

### 읽기 vs 쓰기

| | 읽기 (`view`/`pure`, `cast call`, `useReadContract`) | 쓰기 (트랜잭션, `cast send`, `writeContract`) |
|---|---|---|
| 서명 | 필요 없음 | 개인키 서명 필요 (MetaMask 확인 창) |
| 가스 | 없음 | 있음 (수수료 = gasUsed × effectiveGasPrice) |
| 블록 / nonce | 변화 없음 | 블록에 담김, 보낸 계정의 nonce +1 |
| 예 | 잔고, 거래 목록, 승인액, permit nonce 조회 | faucet, approve, createDeal, release, refund, claimAfterDeadline |

---

## 4. 웹 화면

### 컨트랙트 연결

[`web/scripts/sync-contracts.mjs`](../web/scripts/sync-contracts.mjs)(`npm run sync`)가 Foundry 컴파일 결과의 ABI와 `deployments/31337.json`의 주소를 [`web/src/contracts/generated.ts`](../web/src/contracts/generated.ts)로 복사합니다. ABI를 `as const`로 저장해서 wagmi/viem이 함수 이름·인자 타입을 추론하고, 오타를 코드 작성 단계에서 잡아 줍니다.

[`wagmi.ts`](../web/src/wagmi.ts) 설정:
- 체인: `anvil`(31337) 하나만
- 지갑: `injected({ target: 'metaMask' })`만, `multiInjectedProviderDiscovery: false`
- 읽기 통로: `http('http://127.0.0.1:8545')`, 새 블록 확인 주기 1초

### 쓰기 흐름 — [`useTx`](../web/src/hooks/useTx.ts)

모든 쓰기 버튼이 같은 훅을 씁니다.

```
⓪ MetaMask 네트워크가 31337이 아니면 → Anvil로 전환 요청
① simulateContract  [읽기]  실패할 tx면 여기서 걸러짐 → 서명 창 안 뜸, 가스 0
② MetaMask 서명 창  → 사용자가 확인 (거절하면 "서명을 거절했어요")
③ 서명된 tx 전송     → 해시 = 접수번호
④ waitForTransactionReceipt  블록에 담길 때까지 대기 (15초 넘으면 nonce 꼬임 안내)
⑤ 성공 → 영수증의 gasUsed × effectiveGasPrice로 수수료 표시, 읽기 값 새로고침
```

- 시뮬레이션에 `account`를 꼭 넘겨야 `msg.sender`가 "나"로 계산됩니다.
- ERC-20 오류(잔고·승인 부족)는 MockUSD에서 나지만 Escrow를 호출하다가 터지므로, 오류 해석용 ABI에 토큰 오류도 합쳐 둡니다.
- [`errors.ts`](../web/src/lib/errors.ts)가 custom error 이름, 서명 거절(4001), 권한 없음(4100), 네트워크 불일치, 가스 부족, nonce 문제를 한국어로 바꿉니다.

### permit 서명 — [`usePermit`](../web/src/hooks/usePermit.ts)

`eip712Domain()`과 `nonces(owner)`를 컨트랙트에서 읽고, `signTypedData`로 `Permit(owner, spender, value, nonce, deadline)`에 서명받은 뒤 `parseSignature`로 v·r·s를 나눕니다. 서명 후 금액이 바뀌거나, nonce가 달라지거나, 유효기한이 지나면 화면이 "다시 서명해야 해요"를 표시합니다.

### 체인 시각 — [`useChainNow`](../web/src/hooks/useChainNow.ts)

컨트랙트는 마감을 `block.timestamp`로 판정합니다. Anvil에서 `evm_increaseTime`으로 시간을 앞당기면 체인이 실제 시계보다 앞서므로, 화면은 **`max(마지막 블록 시각, 내 시계)`** 를 기준으로 마감 여부와 기본 마감일(체인 시각 + 1일)을 계산합니다.

### 목록과 새로고침

- 거래 목록: `getDealIdsByBuyer/Seller`로 번호를 읽고, `useReadContracts`(multicall)로 `getDeal`을 한꺼번에 읽습니다.
- 새 블록이 생길 때마다(`useBlockNumber({ watch: true })`) 잔고·목록·거래 내역을 다시 읽습니다. 다른 계정에서 보낸 트랜잭션 결과도 자동으로 반영됩니다.
- MetaMask에서 계정을 바꾸면 선택한 거래가 닫힙니다(역할이 달라지므로).

### 거래 내역 — [`DealTimeline`](../web/src/components/DealTimeline.tsx)

`getContractEvents`로 이 거래(`args: { id }`)의 `DealCreated`/`DealReleased`/`DealRefunded` 로그를 블록 0부터 찾고, 각 로그의 블록(시각)과 영수증(서명자, 가스, 가스 가격)을 함께 읽어 시간순으로 표시합니다. 실제 서비스는 블록 0부터 훑으면 느리므로 배포 블록부터 찾거나 The Graph 같은 인덱서를 씁니다.

### 역할별 버튼

| 내 역할 | 거래 상태 | 보이는 버튼 |
|---|---|---|
| 구매자 | 진행중 | 구매확정 |
| 판매자 | 진행중 | 거래 취소, 마감 지나 자동 지급 받기(마감 전에는 비활성) |
| 누구든 | 끝난 거래 | 결과만 표시 |

버튼 숨기기는 **편의일 뿐 보안이 아닙니다.** 화면을 거치지 않고 `cast`로 직접 호출해도 컨트랙트가 `NotBuyer`/`NotSeller`로 막습니다.

### 개발 보조 스크립트

| 명령 (web/) | 하는 일 |
|---|---|
| `npm run sync` | ABI·주소를 웹으로 복사 |
| `npm run fix-nonce` | 대기열에 걸린 tx를 찾아 `anvil_setNonce`로 체인 nonce를 MetaMask에 맞추고 재전송 |
| `npm run nonce-watch` | 위 작업을 2초마다 자동 실행 |

`anvil_setNonce`는 로컬 개발 노드에만 있는 기능이며, 실제 이더리움에서는 nonce를 바꿀 수 없습니다.

배포 스크립트([Deploy.s.sol](../contracts/script/Deploy.s.sol))는 `--private-key` 없이 실행하면 안내 후 중단하고, `--broadcast`로 실제 배포했을 때만 주소 파일을 씁니다.

---

## 5. 테스트

`cd contracts && forge test` — 41개.

| 파일 | 검사 내용 |
|---|---|
| [MockUSD.t.sol](../contracts/test/MockUSD.t.sol) | 이름·심볼·소수점, faucet 지급·이벤트·반복 호출, permit 도메인 |
| [Escrow.t.sol](../contracts/test/Escrow.t.sol) | 정상 흐름(생성, 결말 3가지, 마감 후 구매확정, 여러 거래 독립), 입력 규칙 위반, 권한 위반, 시간 경계값, 끝난 거래 재처리, 없는 거래, **퍼즈**(무작위 금액 256회 — 돈이 새거나 생기지 않음), **재진입 공격**(악성 토큰이 이중 지급 시도 → `nonReentrant`가 차단) |
| [EscrowPermit.t.sol](../contracts/test/EscrowPermit.t.sol) | permit 정상, front-running 생존, 다른 키로 서명, 남의 서명 제출, 만료, 금액 불일치, 재사용, permit은 맞지만 규칙 위반, 가스 비교 |

테스트에서 쓴 Foundry 치트코드: `vm.prank`(특정 주소가 보낸 것으로), `vm.warp`(블록 시각 이동), `vm.expectRevert`/`vm.expectEmit`, `vm.sign`(개인키로 서명), `bound`(퍼즈 입력 범위).

---

## 6. 강의와의 연결

| 강의 | 이 프로젝트에서 |
|---|---|
| 01 Blockchain Overview | 블록체인 = 누구나 읽을 수 있는 공유 원장. 은행 원장 DB 대신 Anvil 노드가 장부를 보관 |
| 02 Cryptography | MetaMask가 개인키로 서명 → 서명에서 복원한 주소가 `msg.sender`. permit은 트랜잭션이 아닌 "메시지" 서명(EIP-712)을 컨트랙트가 `ecrecover`로 직접 검증. 서명은 해시에 대한 것이라 금액을 1만 바꿔도 무효. 화면은 키를 볼 수 없음. Foundry 설치 시 바이너리 해시·서명 검증 |
| 04 Bitcoin Transactions (UTXO) | 비트코인은 UTXO 조각을 모아 잔고 계산, ERC-20은 `주소 → 숫자` 표를 직접 수정(계정 모델) |
| 07 Bitcoin Consensus / 12 Ethereum Consensus | Anvil은 노드가 하나뿐이라 합의 없이 tx마다 즉시 블록 생성, 시간도 조작 가능. 실제 이더리움은 12초 슬롯·검증자 투표로 확정되어 `block.timestamp`를 며칠씩 당길 수 없음 |
| 09 Ethereum Introduction (EVM) | Solidity → EVM 바이트코드 컴파일. EVM에는 소수가 없어 `decimals`(6) 약속으로 금액 표시 (1 mUSD = 1,000,000) |
| 10 Accounts, Transactions, Blocks | EOA(구매자·판매자) vs 컨트랙트 계정(MockUSD·Escrow). 읽기는 tx가 아니라 블록·nonce 변화 없음. approve + createDeal = 서로 다른 컨트랙트에 보내는 2개의 tx. 실패하면 전체 revert(원자성)되지만 가스는 소모. 수수료 = gasUsed × effectiveGasPrice (EIP-1559 base fee가 한산한 블록에서 내려감), storage를 처음 채우는 첫 거래가 가장 비쌈. 이벤트 로그는 영수증에 남아 과거 기록 조회에 쓰임. nonce는 순서대로만 처리되어 Anvil 재시작 시 MetaMask와 어긋남. 배포도 트랜잭션, 배포 주소는 배포자 주소 + nonce로 결정 |
| 11 Smart Contracts & DApps | 중개 회사 대신 코드가 돈을 보관. 버튼 숨기기는 편의일 뿐, 권한 검사는 컨트랙트가 담당. 블록체인에는 타이머가 없어 "자동 지급"도 누군가 tx를 보내야 실행됨. 블록체인은 조건 검색을 못 해서 주소별 목록·indexed 이벤트로 해결 |
| 13 Blockchain Applications | 실제 USDC도 같은 ERC-20 + permit 구조(발행 권한만 Circle에 제한). 이 구조에 감사·분쟁 중재·수수료를 더하면 실서비스형 에스크로 |
