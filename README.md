# 스테이블코인 에스크로(안전결제) 디앱

구매자가 맡긴 스테이블코인(mUSD)을 **스마트 컨트랙트가 보관**하다가, 거래 결말에 따라 판매자나 구매자에게 보내 주는 디앱입니다.
블록체인 기초(비트코인·이더리움)를 공부한 뒤 **디앱이 어떻게 구성되고 동작하는지 직접 만들면서 익히기 위한 학습용 프로젝트**이며, 내 컴퓨터의 로컬 블록체인(Anvil)에서만 동작합니다.

> ⚠️ 테스트넷/메인넷 배포를 하지 않는 학습용 코드입니다. 감사(audit)를 받지 않았으므로 실제 자산에 사용하지 마세요.

---

## 한눈에 보기

```
구매자: approve(1번째 tx) → createDeal(2번째 tx) ── 돈이 컨트랙트에 묶임 (진행중)
                                                      ├─ 구매자 release(구매확정)          → 판매자에게 (지급완료)
                                                      ├─ 판매자 refund(거래 취소)           → 구매자에게 (환불완료)
                                                      └─ 마감 후 판매자 claimAfterDeadline   → 판매자에게 (지급완료)
```

### 디앱 구조

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

| 폴더 | 내용 |
|---|---|
| [`contracts/src/MockUSD.sol`](contracts/src/MockUSD.sol) | 테스트용 스테이블코인. ERC-20 + permit(EIP-2612), 소수점 6자리(USDC와 동일), `faucet()`으로 1,000 mUSD 지급 |
| [`contracts/src/Escrow.sol`](contracts/src/Escrow.sol) | 에스크로 본체. 거래 생성·구매확정·환불·마감 후 지급 |
| [`contracts/test/`](contracts/test/) | Foundry 테스트 41개 (정상 흐름, 규칙 위반, 퍼즈, 재진입 공격, permit 서명 위조·만료·재사용·front-running) |
| [`contracts/script/Deploy.s.sol`](contracts/script/Deploy.s.sol) | 배포 스크립트. 주소를 `contracts/deployments/31337.json`에 기록 |
| [`web/src/`](web/src/) | 웹 화면 |
| [`web/scripts/sync-contracts.mjs`](web/scripts/sync-contracts.mjs) | 컨트랙트 ABI·배포 주소를 `web/src/contracts/generated.ts`로 복사 |

### 기술 스택

- 컨트랙트: Solidity 0.8.30, [Foundry](https://getfoundry.sh/) (forge · anvil · cast), OpenZeppelin Contracts v5.7.0
- 웹: Vite, React, TypeScript, wagmi v2 (2.19.5), viem, TanStack Query
- 지갑: MetaMask (injected connector만 사용, WalletConnect 등 외부 키 없음)
- 체인: Anvil 로컬 (chainId 31337)

---

## 컨트랙트 요약

### Escrow 함수

| 함수 | 종류 | 누가 | 하는 일 |
|---|---|---|---|
| `createDeal(seller, amount, deadline, description)` | 쓰기 | 구매자 | 미리 `approve`받은 mUSD를 `transferFrom`으로 예치하고 거래 생성 |
| `createDealWithPermit(…, permitDeadline, v, r, s)` | 쓰기 | 구매자 | permit 서명으로 승인과 예치를 트랜잭션 한 번에 처리 |
| `release(id)` | 쓰기 | 구매자 | 구매확정 → 판매자에게 지급 |
| `refund(id)` | 쓰기 | 판매자 | 거래 취소 → 구매자에게 환불 |
| `claimAfterDeadline(id)` | 쓰기 | 판매자 | 마감이 지났으면 판매자가 직접 받아 감 |
| `getDeal(id)` | 읽기 (view) | 누구나 | 거래 하나 조회 |
| `getDealIdsByBuyer(addr)` / `getDealIdsBySeller(addr)` | 읽기 (view) | 누구나 | 주소별 거래 번호 목록 |

- **규칙**: 끝난 거래 재처리 불가, 금액 0 불가, 판매자 = 구매자 불가, 판매자 0 주소 불가, 마감이 과거면 불가
- **보안**: SafeERC20, ReentrancyGuard(`nonReentrant`), checks → effects → interactions 순서, custom error
- **이벤트**: `DealCreated`, `DealReleased`, `DealRefunded` — 화면의 "거래 내역" 타임라인이 이 로그를 읽어 블록 번호·시각·서명자·가스비를 보여 줌

### 거래를 만드는 두 가지 방식

| | 방식 A: approve | 방식 B: permit (EIP-2612) |
|---|---|---|
| 1단계 | `approve` **트랜잭션** (가스, 블록에 기록) | EIP-712 **서명만** (가스 0, 네트워크에 안 보냄) |
| 2단계 | `createDeal` 트랜잭션 | `createDealWithPermit` 트랜잭션 (서명 v·r·s를 실어 보냄 → 컨트랙트가 검증 후 승인 처리) |
| 트랜잭션 수 | 2번 | 1번 |

permit 서명에는 토큰 이름·버전·체인 ID·토큰 주소(도메인)와 nonce·유효기한이 묶여 있어서 다른 체인·다른 토큰·재사용·기한 초과가 모두 막힙니다. 서명은 누구나 볼 수 있어 공격자가 먼저 `permit()`을 제출(front-running)할 수 있는데, 이 경우에도 거래가 실패하지 않도록 `try/catch`로 처리합니다.

### 읽기 vs 쓰기

| | 읽기 (`view`/`pure`, `cast call`, `useReadContract`) | 쓰기 (트랜잭션, `cast send`, `writeContract`) |
|---|---|---|
| 서명 | 필요 없음 | 개인키 서명 필요 (MetaMask 확인 창) |
| 가스 | 없음 | 있음 |
| 블록/nonce | 변화 없음 | 블록에 담김, 보낸 계정의 nonce +1 |
| 예 | 잔고, 거래 목록, 승인액 조회 | faucet, approve, createDeal, release, refund, claimAfterDeadline |

---

## 실행 방법

### 0. 준비 (처음 한 번)

```bash
# Foundry 설치
curl -L https://foundry.paradigm.xyz | bash
echo 'export PATH="$PATH:$HOME/.foundry/bin"' >> ~/.zshrc   # 최신 설치기는 PATH를 자동 등록하지 않음
source ~/.zshrc
foundryup

# 저장소 받기 (OpenZeppelin, forge-std는 git submodule)
git clone --recurse-submodules <이 저장소 주소>
cd <저장소 폴더>
# 이미 받았는데 contracts/lib 가 비어 있다면: git submodule update --init --recursive

# 웹 패키지 설치
cd web && npm install && cd ..
```

### 1. 컨트랙트 테스트

```bash
cd contracts
forge test
```

### 2. 로컬 체인 + 배포 + 화면 (터미널 2개)

```bash
# 터미널 ①  — 시연 내내 켜 두기
anvil
```

```bash
# 터미널 ②
cd contracts
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   # Anvil 0번 계정(공개 테스트 키)

cd ../web
npm run sync   # 컨트랙트를 고쳤거나 주소가 바뀌었을 때만 필요
npm run dev    # → http://localhost:5173
```

Anvil을 새로 켜고 같은 순서로 배포하면 주소는 항상 같습니다 (배포 주소 = 배포자 주소 + nonce로 계산).

| 컨트랙트 | 주소 (Anvil) |
|---|---|
| MockUSD | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Escrow | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |

### 3. cast로 직접 해 보기

```bash
export ETH_RPC_URL=http://127.0.0.1:8545
T=0x5FbDB2315678afecb367f032d93F642f64180aa3
B=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

cast call $T "balanceOf(address)(uint256)" $B                    # 읽기: 블록·nonce 그대로
cast send $T "faucet()" --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d   # 쓰기
cast call $T "balanceOf(address)(uint256)" $B                    # 1000000000 (= 1,000 mUSD, 소수점 6자리)
cast nonce $B && cast block-number                               # 둘 다 1씩 늘어 있음
```

---

## MetaMask 설정과 시연

> ⚠️ **Anvil 테스트 계정의 개인키는 전 세계에 공개된 키입니다.** 로컬에서만 쓰세요. 메인넷에서 이 주소로 보낸 돈은 즉시 도난당합니다.
> 반대로 **실제 자산이 든 지갑은 개발에 쓰지 마세요.** 크롬 개발용 프로필에 MetaMask를 새로 설치하는 것을 권장합니다.

### 설정

1. **네트워크 추가**: MetaMask ☰ → 설정 → 네트워크 → 사용자 지정 네트워크 추가
   - 이름 `Anvil` / RPC `http://127.0.0.1:8545` / 체인 ID `31337` / 통화 `ETH` / 블록 탐색기는 비움
   - "GoChain Testnet" 이름·심볼 불일치 경고는 무시해도 됨 (공개 체인 목록에 31337이 그 이름으로 등록돼 있을 뿐)
   - "이 체인 ID는 현재 Anvil 네트워크에서 사용됩니다"가 뜨면 이미 추가된 것 → 닫기
2. **계정 가져오기**: 계정 메뉴 → 계정 또는 하드웨어 지갑 추가 → 개인 키 가져오기

   | 역할 | 주소 | 개인키 |
   |---|---|---|
   | 구매자 (Anvil #1) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
   | 판매자 (Anvil #2) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

3. **사이트 연결**: 화면에서 "지갑 연결" → 구매자·판매자 두 계정 모두 체크 → 연결
   - 나중에 바꾸려면 MetaMask 아래쪽 `localhost:5173` 줄의 ⚙ → 연결된 계정 관리에서 체크 후 저장
4. (선택) **mUSD 토큰 표시**: 토큰 가져오기 → 주소 `0x5FbD…0aa3`, 심볼 `mUSD`, **소수점 6** (18로 넣으면 0처럼 보임)

### 시연 순서

역할을 바꿀 때는 **MetaMask 위쪽에서 계정을 선택**하고, 버튼을 누르기 전에 **화면 오른쪽 위 주소**로 지금 누구인지 확인합니다.

1. **준비** (구매자) "1,000 mUSD 받기"
2. **결말 ① 구매확정**: (구매자) 판매자 주소·금액 입력 → 1단계 승인 → 2단계 예치 → 거래 상세에서 "구매확정" → (판매자) 잔고 증가 확인
3. **결말 ② 거래 취소**: (구매자) 거래 생성 → (판매자) "거래 취소" → (구매자) 잔고 복구 확인
4. **결말 ③ 마감 후 지급**: (구매자) 거래 생성 → (판매자) 버튼이 꺼져 있는 것 확인 → 시간 앞당기기 → "자동 지급 받기"
   ```bash
   cast rpc evm_increaseTime 90000 && cast rpc evm_mine   # 체인 시간 +25시간, 새 블록 생성
   ```

---

## 자주 막히는 문제

| 증상 | 원인 / 해결 |
|---|---|
| `forge: command not found` | PATH 미등록. `~/.zshrc`에 `export PATH="$PATH:$HOME/.foundry/bin"` 추가 후 터미널 재시작 |
| `nonce too high`, 트랜잭션이 계속 대기 | Anvil을 재시작하면 체인이 초기화되는데 MetaMask는 이전 nonce를 기억함 → MetaMask 설정 → 고급 → **활동 및 논스 데이터 지우기** (계정마다). 배포도 다시 실행 |
| "The requested method and/or account has not been authorized" | 사이트에 계정·네트워크 권한이 없음 → `localhost:5173` 연결 설정에서 계정 체크, 네트워크를 Anvil로 |
| 화면 주소와 MetaMask 위쪽 계정이 다름 | 최신 MetaMask는 "지갑에서 보고 있는 계정"과 "사이트가 쓰는 계정"을 따로 관리. 화면 주소가 기준. 아래쪽에 "연결되지 않음"이 보이면 "연결" 클릭 |
| 가스비(ETH) 부족 | MetaMask가 만든 기본 계정(Account 1)은 Anvil에 ETH가 없음 → 가져온 Anvil 계정 사용 |
| "Anvil 노드에 연결할 수 없어요" | 터미널 ①의 `anvil`이 꺼짐 |
| 마감을 오늘로 했는데 "이미 지났다"고 함 | `evm_increaseTime`으로 체인 시각이 실제 시각보다 앞서 있음. 화면 위 "마지막 블록 시각" 기준으로 입력 |

---

## 배운 것 — 강의와 연결

| 강의 | 이 프로젝트에서 |
|---|---|
| 01 Blockchain Overview | 블록체인 = 누구나 읽을 수 있는 공유 원장. 은행 원장 DB 대신 Anvil 노드가 장부를 보관 |
| 02 Cryptography | MetaMask가 개인키로 서명 → 서명에서 복원한 주소가 `msg.sender`. permit은 트랜잭션이 아닌 "메시지" 서명(EIP-712)을 컨트랙트가 `ecrecover`로 직접 검증. 화면은 키를 볼 수 없음. Foundry 설치 시 바이너리 해시·서명 검증 |
| 04 Bitcoin Transactions (UTXO) | 비트코인은 UTXO 조각을 모아 잔고 계산, ERC-20은 `주소 → 숫자` 표를 직접 수정(계정 모델) |
| 07 Bitcoin Consensus / 12 Ethereum Consensus | Anvil은 노드가 하나뿐이라 합의 없이 tx마다 즉시 블록 생성, 시간도 조작 가능. 실제 이더리움은 12초 슬롯·검증자 투표로 확정되어 `block.timestamp`를 며칠씩 당길 수 없음 |
| 09 Ethereum Introduction (EVM) | Solidity → EVM 바이트코드 컴파일. EVM에는 소수가 없어 `decimals`(6) 약속으로 금액 표시 (1 mUSD = 1,000,000) |
| 10 Accounts, Transactions, Blocks | EOA(구매자·판매자) vs 컨트랙트 계정(MockUSD·Escrow). 수수료 = gasUsed × effectiveGasPrice (EIP-1559 base fee가 한산한 블록에서 내려감), storage를 처음 채우는 첫 거래가 가장 비쌈. 이벤트 로그는 영수증에 남아 과거 기록 조회에 쓰임. approve + createDeal = 서로 다른 컨트랙트에 보내는 2개의 tx(서명·가스·nonce 각각). 실패하면 전체 revert(원자성)되지만 가스는 소모. 배포도 트랜잭션, 배포 주소는 배포자 주소 + nonce로 결정 |
| 11 Smart Contracts & DApps | 중개 회사 대신 코드가 돈을 보관. 버튼 숨기기는 편의일 뿐, 권한 검사는 컨트랙트(`NotBuyer`, `NotSeller`)가 담당. 블록체인에는 타이머가 없어 "자동 지급"도 누군가 tx를 보내야 실행됨 |
| 13 Blockchain Applications | 실제 USDC도 같은 ERC-20 구조(발행 권한만 Circle에 제한). 이 구조에 감사·분쟁 중재·수수료를 더하면 실서비스형 에스크로 |

**보안 패턴**: 2016년 The DAO 해킹은 "송금 먼저, 장부 수정 나중" 순서를 노린 재진입 공격이었습니다. Escrow는 **검사 → 장부 수정 → 송금** 순서와 `nonReentrant` 잠금으로 막으며, [`EscrowReentrancyTest`](contracts/test/Escrow.t.sol)에서 악성 토큰으로 이를 검증합니다.
