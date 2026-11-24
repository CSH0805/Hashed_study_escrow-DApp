# 실행 방법

> 로컬 Anvil에서 실행하는 방법입니다. Sepolia 테스트넷에 올리는 방법은 [SEPOLIA.md](SEPOLIA.md)를 보세요.

이 디앱을 내 컴퓨터에서 띄우고 MetaMask로 시연하는 방법입니다.
소개는 [README.md](../README.md), 구조와 로직은 [TECHNICAL.md](TECHNICAL.md)를 보세요.

- [1. 처음 한 번: 설치](#1-처음-한-번-설치)
- [2. 매번: 띄우기 (터미널 3개)](#2-매번-띄우기-터미널-3개)
- [3. 처음 한 번: MetaMask 설정](#3-처음-한-번-metamask-설정)
- [4. 시연 순서](#4-시연-순서)
- [5. cast로 직접 해 보기](#5-cast로-직접-해-보기)
- [6. 자주 막히는 문제](#6-자주-막히는-문제)

> ⚠️ **Anvil 테스트 계정의 개인키는 전 세계에 공개된 키입니다.** 로컬에서만 쓰세요. 메인넷에서 이 주소로 보낸 돈은 즉시 도난당합니다.
> 반대로 **실제 자산이 든 지갑은 개발에 쓰지 마세요.** 크롬 개발용 프로필에 MetaMask를 새로 설치하는 것을 권장합니다.

---

## 1. 처음 한 번: 설치

필요한 것: macOS 기준 Node.js, git, Chrome + MetaMask 확장 프로그램

```bash
# Foundry 설치
curl -L https://foundry.paradigm.xyz | bash
echo 'export PATH="$PATH:$HOME/.foundry/bin"' >> ~/.zshrc   # 최신 설치기는 PATH를 자동 등록하지 않음
source ~/.zshrc
foundryup
forge --version   # 버전이 나오면 성공

# 저장소 받기 (OpenZeppelin, forge-std는 git submodule이라 --recurse-submodules 필요)
git clone --recurse-submodules https://github.com/CSH0805/Hashed_study_escrow-DApp.git
cd Hashed_study_escrow-DApp
# 이미 받았는데 contracts/lib 가 비어 있다면: git submodule update --init --recursive

# 웹 패키지 설치
cd web && npm install && cd ..

# (선택) 컨트랙트 테스트 — 41개 통과하면 정상
cd contracts && forge test && cd ..
```

---

## 2. 매번: 띄우기 (터미널 3개)

VS Code나 터미널을 껐다 켰다면 매번 이 순서로 띄웁니다.

**터미널 ① — 로컬 블록체인.** 시연 내내 켜 두세요. 끄면 체인이 통째로 사라집니다.
```bash
anvil
```

**터미널 ② — 배포 후 화면 실행**
```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

cd ../web
npm run dev
```
- `ONCHAIN EXECUTION COMPLETE & SUCCESSFUL`과 아래 주소가 나오면 배포 성공입니다.

  | 컨트랙트 | 주소 |
  |---|---|
  | MockUSD | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
  | Escrow | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |

- 배포는 **Anvil을 켤 때마다 한 번만** 합니다. 같은 Anvil에 여러 번 배포하면 주소가 바뀌는데, 그때는 `npm run sync`로 화면 주소를 맞춰 주세요.
- `npm run dev`는 반드시 **`web/` 폴더에서** 실행합니다.
- 브라우저에서 http://localhost:5173 을 엽니다.

**터미널 ③ — nonce 자동 해결 (권장)**
```bash
cd web
npm run nonce-watch
```
Anvil을 다시 켜면 MetaMask가 예전 nonce로 트랜잭션을 보내서 "블록에 담기기를 기다리는 중…"에서 멈출 수 있습니다. 이 터미널을 켜 두면 몇 초 안에 자동으로 풀어 줍니다.

**요약**
```
터미널 ① anvil
터미널 ② cd contracts → forge script …(배포 한 번) → cd ../web → npm run dev
터미널 ③ cd web → npm run nonce-watch
```

---

## 3. 처음 한 번: MetaMask 설정

**① Anvil 네트워크 추가**
1. MetaMask ☰ → 설정 → 네트워크 → **사용자 지정 네트워크 추가**
2. 이름 `Anvil` / RPC URL `http://127.0.0.1:8545` / 체인 ID `31337` / 통화 기호 `ETH` / 블록 탐색기 URL은 비움
- "GoChain Testnet" 이름·심볼 불일치 경고는 무시해도 됩니다. 공개 체인 목록에 31337이 그 이름으로 등록돼 있을 뿐입니다.
- "이 체인 ID는 현재 Anvil 네트워크에서 사용됩니다"가 뜨면 이미 추가된 것이니 닫으세요.
- 화면에서 지갑을 연결한 뒤 노란 **"Anvil로 전환"** 버튼을 눌러도 추가할 수 있습니다.

**② 테스트 계정 두 개 가져오기**

계정 이름 클릭 → **계정 또는 하드웨어 지갑 추가** → **개인 키 가져오기**

| 역할 | 주소 | 개인키 |
|---|---|---|
| 구매자 (Anvil #1) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| 판매자 (Anvil #2) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

계정 이름을 "구매자", "판매자"로 바꿔 두면 헷갈리지 않습니다. MetaMask가 처음 만든 `Account 1`은 Anvil에 ETH가 없어서 쓰지 않습니다.

**③ 사이트 연결**
1. 화면에서 **지갑 연결** → 구매자·판매자 **두 계정 모두 체크** → 연결
2. 나중에 바꾸려면 MetaMask 아래쪽 `localhost:5173` 줄의 ⚙ → **연결된 계정 관리**에서 체크 후 저장

**④ (선택) mUSD 잔고를 MetaMask에서도 보기**

토큰 → 토큰 가져오기 → 주소 `0x5FbDB2315678afecb367f032d93F642f64180aa3`, 심볼 `mUSD`, **소수점 6** (18로 넣으면 0처럼 보입니다)

---

## 4. 시연 순서

역할을 바꿀 때는 **MetaMask 위쪽에서 계정을 선택**하고, 버튼을 누르기 전에 **화면 오른쪽 위 주소**로 지금 누구인지 확인하세요. 최신 MetaMask는 "지갑에서 보고 있는 계정"과 "사이트가 쓰는 계정"을 따로 관리하므로, 화면 주소가 기준입니다.

| 단계 | 누가 | 할 일 | 확인 |
|---|---|---|---|
| 준비 | 구매자 | **1,000 mUSD 받기** | 잔고 1,000 mUSD |
| 결말 ① 구매확정 | 구매자 | 판매자 주소 `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`, 금액 `100` → **1단계 승인** → **2단계 예치** → 거래 상세에서 **구매확정** | 판매자로 바꾸면 잔고 +100, "지급완료" |
| 결말 ② 거래 취소 | 구매자 → 판매자 | 거래 생성 → (판매자) **거래 취소** | 구매자 잔고 복구, "환불완료" |
| 결말 ③ 마감 후 지급 | 구매자 → 판매자 | 거래 생성 → (판매자) 버튼이 꺼져 있는 것 확인 → 아래 명령으로 시간 앞당기기 → **자동 지급 받기** | 판매자 잔고 증가, "지급완료" |
| 방식 B (permit) | 구매자 | 거래 만들기에서 **방식 B** 선택 → **1단계 서명**(MetaMask에 "서명 요청" 창, 가스 없음) → **2단계 예치**(트랜잭션 확인 창) | 트랜잭션은 1번만 |

**결말 ③의 시간 앞당기기** (새 터미널에서)
```bash
cast rpc evm_increaseTime 90000 && cast rpc evm_mine   # 체인 시간 +25시간, 새 블록 생성
```
화면 위쪽 "마지막 블록 시각"이 하루 뒤로 바뀌면 버튼이 켜집니다.

**더 해 볼 것**
- MetaMask 창에서 **거부**를 눌러 보기 → "서명을 거절했어요"
- 금액 0, 판매자 칸에 내 주소 입력 → 서명 전에 안내
- 방식 B에서 서명한 뒤 금액 바꾸기 → "다시 서명해야 해요"
- 거래 상세 아래 **거래 내역**에서 방식 A와 B의 가스비 비교

---

## 5. cast로 직접 해 보기

화면 없이 터미널에서 컨트랙트를 읽고 써 봅니다.

```bash
export ETH_RPC_URL=http://127.0.0.1:8545
T=0x5FbDB2315678afecb367f032d93F642f64180aa3      # MockUSD
B=0x70997970C51812dc3A010C7d01b50e0d17dc79C8      # 구매자

cast call $T "balanceOf(address)(uint256)" $B      # 읽기: 블록·nonce 그대로
cast send $T "faucet()" --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d   # 쓰기
cast call $T "balanceOf(address)(uint256)" $B      # +1000000000 (= 1,000 mUSD, 소수점 6자리)
cast nonce $B && cast block-number                 # 둘 다 늘어 있음
```

---

## 6. 자주 막히는 문제

| 증상 | 원인 / 해결 |
|---|---|
| `forge: command not found` | PATH 미등록. `~/.zshrc`에 `export PATH="$PATH:$HOME/.foundry/bin"` 추가 후 터미널 재시작 |
| `npm run dev`에서 `Could not read package.json` | `contracts/` 폴더에서 실행함. `cd ../web` 후 실행 |
| "블록에 담기기를 기다리는 중"에서 멈춤, 15초 후 빨간 오류, `nonce too high` | Anvil을 재시작하면 체인 nonce는 0으로 돌아가는데 MetaMask는 예전 nonce로 보냄 → 터미널 ③에서 **`npm run nonce-watch`**(또는 한 번만 `npm run fix-nonce`). MetaMask 쪽에서 고치려면 설정에서 "논스"를 검색해 **활동 및 논스 데이터 지우기**(최신 버전은 "고급" 메뉴가 없음) |
| 잔고가 `- mUSD`로 표시 | 화면이 보는 주소에 컨트랙트가 없음. 배포를 안 했거나, Anvil을 재시작한 뒤 배포를 다시 안 함. 여러 번 배포해 주소가 바뀌었다면 `npm run sync` |
| "The requested method and/or account has not been authorized" | 사이트에 계정·네트워크 권한이 없음 → `localhost:5173` 연결 설정에서 계정 체크, 네트워크를 Anvil로 |
| 화면 주소와 MetaMask 위쪽 계정이 다름 | 화면 주소가 기준. MetaMask 아래쪽에 "연결되지 않음"이 보이면 "연결" 클릭 |
| 가스비(ETH) 부족 | MetaMask 기본 계정(Account 1)은 Anvil에 ETH가 없음 → 가져온 Anvil 계정 사용 |
| "Anvil 노드에 연결할 수 없어요", MetaMask "Anvil에 연결할 수 없습니다" | 터미널 ①의 `anvil`이 꺼짐. 다시 켜고 배포부터 다시 |
| 마감을 오늘로 했는데 "이미 지났다"고 함 | `evm_increaseTime`으로 체인 시각이 실제 시각보다 앞서 있음. 화면 위 "마지막 블록 시각" 기준으로 입력 |
| 배포 스크립트가 "--private-key 를 붙여 실행하세요"로 멈춤 | 키 없이 실행함. 위 배포 명령을 그대로 복사해 실행 |
