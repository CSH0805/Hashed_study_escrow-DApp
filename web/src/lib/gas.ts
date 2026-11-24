import { formatEther, formatGwei } from 'viem'

/** 가스량 → "69,553" */
export const formatGas = (gas: bigint) => gas.toLocaleString('ko-KR')

/** 수수료(wei) → "0.000139 ETH" (작은 값도 보이도록 유효숫자 기준으로 자름) */
export function formatFee(wei: bigint): string {
  const eth = Number(formatEther(wei))
  return `${eth.toPrecision(3).replace(/\.?0+$/, '')} ETH`
}

/** 가스 가격(wei) → "1.88 gwei" */
export function formatGasPrice(wei: bigint): string {
  return `${Number(formatGwei(wei)).toPrecision(3).replace(/\.?0+$/, '')} gwei`
}
