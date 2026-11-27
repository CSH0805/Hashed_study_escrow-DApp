import { parseUnits } from 'viem'

/** mUSD 소수점 자릿수. 컨트랙트의 decimals()와 같아야 한다. */
export const MUSD_DECIMALS = 6

/** 사용자가 입력한 금액 문자열("12.5") → 체인 정수 금액(12_500_000n). 형식이 틀리면 undefined */
export function parseAmount(text: string): bigint | undefined {
  try {
    return text.trim() ? parseUnits(text.trim(), MUSD_DECIMALS) : undefined
  } catch {
    return undefined
  }
}
