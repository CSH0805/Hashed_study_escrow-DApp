// Anvil nonce 맞추기 — "블록에 담기기를 기다리는 중…"에서 멈췄을 때
//
// 실행: npm run fix-nonce   (web/ 폴더에서, Anvil이 켜져 있어야 함)
//
// 왜 필요한가?
//   Anvil을 껐다 켜면 체인이 처음부터 시작해서 계정 nonce가 0으로 돌아간다.
//   그런데 MetaMask는 예전 체인에서 쓰던 nonce(예: 15)를 기억하고 그 번호로 트랜잭션을 보낸다.
//   노드는 "0번부터 14번이 먼저 와야 15번을 처리할 수 있다"며 15번을 대기열(queued)에 넣고 기다린다.
//
// 이 스크립트가 하는 일:
//   대기열에 걸린 트랜잭션을 찾아서, 그 계정의 체인 nonce를 "가장 작은 대기 nonce"로 올린다(anvil_setNonce).
//   그다음 대기 중이던 트랜잭션을 대기열에서 꺼냈다가(anvil_dropTransaction) 그대로 다시 넣는다(eth_sendRawTransaction).
//   이미 MetaMask가 서명해 둔 트랜잭션이라 서명 없이 재전송할 수 있다. → 순서가 맞아져서 바로 블록에 담긴다.
//   ※ anvil_setNonce는 로컬 개발 노드에만 있는 치트 기능이다. 실제 이더리움에서는 nonce를 마음대로 바꿀 수 없다.
//   ※ MetaMask 쪽을 고치는 정석 방법: 설정 → (고급 또는 개발자 도구) → "활동 및 논스 데이터 지우기"

import { keccak256, serializeTransaction } from 'viem'

const RPC = 'http://127.0.0.1:8545'

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }).catch(() => {
    console.error('❌ Anvil(127.0.0.1:8545)에 연결할 수 없어요. 터미널에서 anvil이 켜져 있는지 확인해 주세요.')
    process.exit(1)
  })
  const json = await res.json()
  if (json.error) throw new Error(`${method}: ${json.error.message}`)
  return json.result
}

const pool = await rpc('txpool_content')
const queued = Object.entries(pool.queued ?? {})
if (queued.length === 0) {
  console.log('✅ 대기열에 걸린 트랜잭션이 없어요. nonce는 정상이에요.')
  process.exit(0)
}

for (const [address, txs] of queued) {
  const list = Object.values(txs).sort((a, b) => Number(BigInt(a.nonce) - BigInt(b.nonce)))
  const target = BigInt(list[0].nonce)
  const current = BigInt(await rpc('eth_getTransactionCount', [address, 'latest']))
  console.log(`🔧 ${address}: 체인 nonce ${current} → ${target} (대기 중인 nonce: ${list.map((t) => BigInt(t.nonce)).join(', ')})`)
  await rpc('anvil_setNonce', [address, `0x${target.toString(16)}`])

  for (const tx of list) {
    // 노드가 보관 중인 필드 + 서명(r, s, yParity)으로 원래의 서명된 트랜잭션(raw)을 다시 만든다
    const raw = serializeTransaction(
      {
        type: 'eip1559',
        chainId: Number(tx.chainId),
        nonce: Number(tx.nonce),
        gas: BigInt(tx.gas),
        maxFeePerGas: BigInt(tx.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(tx.maxPriorityFeePerGas),
        to: tx.to ?? undefined,
        value: BigInt(tx.value),
        data: tx.input,
        accessList: tx.accessList ?? [],
      },
      { r: tx.r, s: tx.s, yParity: Number(tx.yParity ?? tx.v) },
    )
    if (keccak256(raw) !== tx.hash) {
      console.log(`   ⚠️ nonce ${BigInt(tx.nonce)}: 트랜잭션을 복원하지 못해 건너뜀`)
      continue
    }
    await rpc('anvil_dropTransaction', [tx.hash])
    await rpc('eth_sendRawTransaction', [raw])
    console.log(`   ↻ nonce ${BigInt(tx.nonce)} 재전송 (${tx.hash.slice(0, 10)}…)`)
  }
}

await rpc('evm_mine') // 대기열이 풀린 트랜잭션들을 블록에 담는다
const left = await rpc('txpool_content')
const remaining = Object.values(left.queued ?? {}).reduce((n, txs) => n + Object.keys(txs).length, 0)
console.log(remaining === 0 ? '✅ 대기 중이던 트랜잭션이 모두 처리됐어요. 화면을 새로고침하세요.' : `⚠️ 아직 ${remaining}개가 대기 중이에요. 한 번 더 실행해 보세요.`)
