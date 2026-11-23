// 컨트랙트(Foundry) → 웹 화면 연결 스크립트
//
// 실행: npm run sync   (web/ 폴더에서)
//
// 하는 일:
//   1) contracts/out/ 의 컴파일 결과에서 ABI(함수 메뉴판)만 꺼낸다
//   2) contracts/deployments/31337.json 에서 배포 주소를 읽는다
//   3) web/src/contracts/generated.ts 로 저장한다
//
// 왜 복사하나?
//   - 웹 코드가 contracts/ 폴더를 직접 import하면 Vite가 프로젝트 밖 파일이라며 막는다.
//   - ABI를 `as const`로 저장하면 wagmi/viem이 "함수 이름, 인자 타입, 반환 타입"을 자동 추론해서
//     오타(functionName: 'relese')나 잘못된 인자를 코드 작성 단계에서 잡아 준다.
//   - 컨트랙트를 수정·재배포하면 이 스크립트만 다시 실행하면 된다.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const contractsDir = resolve(here, '../../contracts')
const outFile = resolve(here, '../src/contracts/generated.ts')

function readJson(path, hint) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    console.error(`❌ ${path} 를 읽을 수 없어요. ${hint}`)
    process.exit(1)
  }
}

const abiOf = (name) =>
  readJson(
    resolve(contractsDir, `out/${name}.sol/${name}.json`),
    'contracts/ 에서 forge build 를 먼저 실행해 주세요.',
  ).abi

const deployment = readJson(
  resolve(contractsDir, 'deployments/31337.json'),
  'Anvil을 켜고 배포 스크립트(forge script ... --broadcast)를 먼저 실행해 주세요.',
)

const code = `// ⚠️ 자동 생성 파일입니다. 직접 고치지 말고 \`npm run sync\` 로 다시 만드세요.
// 출처: contracts/out/*.json (ABI), contracts/deployments/31337.json (주소)

export const CHAIN_ID = ${deployment.chainId}

export const MOCK_USD_ADDRESS = '${deployment.MockUSD}' as const
export const ESCROW_ADDRESS = '${deployment.Escrow}' as const

export const mockUsdAbi = ${JSON.stringify(abiOf('MockUSD'), null, 2)} as const

export const escrowAbi = ${JSON.stringify(abiOf('Escrow'), null, 2)} as const
`

writeFileSync(outFile, code)
console.log(`✅ ${outFile} 생성 완료`)
console.log(`   MockUSD: ${deployment.MockUSD}`)
console.log(`   Escrow : ${deployment.Escrow}`)
