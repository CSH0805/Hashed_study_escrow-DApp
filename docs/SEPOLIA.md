# Sepolia 테스트넷에 올리기

로컬 Anvil에서 만든 디앱을 **이더리움 공식 테스트넷 Sepolia**(chainId `11155111`)에 배포하고, 같은 웹 화면으로 사용하는 방법입니다.

| | Anvil | Sepolia |
|---|---|---|
| 실행 | `npm run dev` | `npm run dev:sepolia` |
| 주소 파일 | `contracts/deployments/31337.json` | `contracts/deployments/11155111.json` |
| 가스(ETH) | 테스트 계정에 10,000 ETH | faucet에서 받은 테스트 ETH (가치 없음) |
| 블록 | tx가 오면 즉시 | 약 12초마다 |
| 시간 앞당기기 | `evm_increaseTime` 가능 | **불가능** → 마감을 몇 분 뒤로 짧게 잡고 실제로 기다림 |
| 거래 조회 | 없음 | [sepolia.etherscan.io](https://sepolia.etherscan.io)에서 누구나 |

> ⚠️ **Anvil 테스트 키를 Sepolia에서 절대 쓰지 마세요.** 전 세계에 공개된 키라서 ETH를 넣는 순간 봇이 가져갑니다.
> ⚠️ **실제 자산이 든 지갑도 쓰지 마세요.** 개발 전용 계정을 새로 만듭니다.

---

## 1. 개발 전용 계정 만들기 (처음 한 번)

배포용 계정은 **Foundry 암호화 키스토어**에 보관합니다. 개인키를 명령어나 `.env` 파일에 평문으로 적지 않기 위해서입니다.

```bash
cd contracts
cast wallet new                       # 새 주소와 개인키가 출력됨 (이 개인키는 어디에도 붙여넣지 말고 바로 다음 단계에서만 사용)
cast wallet import dev --interactive  # 위 개인키를 붙여넣고, 키스토어 비밀번호를 정함 → ~/.foundry/keystores/dev 에 암호화 저장
cast wallet address --account dev     # 비밀번호 입력 → 배포자 주소 확인
```

화면에서 쓸 계정(구매자·판매자)은 MetaMask에서 **계정 추가 → 새 계정 만들기**로 2개 만듭니다. (배포자 계정을 MetaMask로 가져와 구매자로 써도 됩니다)

## 2. 테스트 ETH 받기

배포자·구매자·판매자 주소에 Sepolia ETH를 받습니다. 배포에 약 0.01 ETH 이하, 거래 버튼 한 번에 0.001 ETH 이하가 듭니다(가스 가격에 따라 다름).

Sepolia faucet은 대부분 로그인이나 "메인넷 잔고 조금 이상", 또는 PoW 채굴 같은 조건이 있습니다. 예:
- Google Cloud Web3 faucet
- Alchemy Sepolia faucet
- PoW faucet (sepolia-faucet.pk910.de)

받은 뒤 잔고 확인:

```bash
cast balance <주소> --rpc-url sepolia --ether
```

## 3. 배포

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url sepolia --account dev --broadcast
```

- `--rpc-url sepolia`: `foundry.toml`의 `[rpc_endpoints]`에 적어 둔 무료 공개 RPC
- `--account dev`: 1단계 키스토어 (비밀번호를 물어봄)
- 끝나면 `contracts/deployments/11155111.json`에 주소와 배포 블록이 기록되고, 출력된 주소를 Etherscan에서 검색하면 배포 트랜잭션이 보입니다.

(선택) Etherscan에 소스 코드 공개(verify): [etherscan.io](https://etherscan.io)에서 무료 API 키를 만든 뒤 위 명령 끝에 `--verify --etherscan-api-key <키>`를 붙입니다. 키는 커밋하지 않습니다.

## 4. 웹 화면 연결

```bash
cd web
npm run sync          # 11155111.json 주소를 화면 코드로 복사
npm run dev:sepolia   # http://localhost:5173
```

MetaMask에서 Sepolia는 기본 네트워크라 따로 추가할 필요가 없습니다. 화면에서 "지갑 연결"을 누르고, 네트워크가 다르면 "Sepolia 테스트넷로 전환"을 누릅니다.

공개 RPC가 느리거나 요청 제한에 걸리면 `web/.env.sepolia.local` 파일을 만들고 Alchemy/Infura 주소를 적습니다. (`.env*` 파일은 git에 올라가지 않음)

```
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<키>
```

## 5. 시연할 때 달라지는 점

- **마감 후 지급**: 시간을 앞당길 수 없으니 거래를 만들 때 마감을 **2~3분 뒤**로 잡고, 지나면 판매자가 "마감 후 지급"을 누릅니다.
- **대기 시간**: 버튼을 누른 뒤 블록에 담기기까지 12초~수십 초 걸립니다. 진행 상자의 tx 링크를 누르면 Etherscan에서 상태를 볼 수 있습니다.
- **nonce 꼬임 도구 불필요**: `npm run fix-nonce`, `npm run nonce-watch`는 Anvil 재시작 문제용이라 Sepolia에서는 쓰지 않습니다. 체인이 계속 유지되니 그 문제가 생기지 않습니다.
- **Anvil과 함께 쓰기**: 개발·테스트는 계속 Anvil(`npm run dev`)에서 하고, 완성본만 Sepolia에 올립니다.

## (선택) 6. 웹 화면을 인터넷에 공개

`npm run build:sepolia`로 만든 `web/dist/` 폴더는 정적 파일이라 Vercel, Netlify, GitHub Pages 같은 곳에 그대로 올릴 수 있습니다. 공개하면 리뷰어가 링크만으로 MetaMask를 연결해 써 볼 수 있습니다.
