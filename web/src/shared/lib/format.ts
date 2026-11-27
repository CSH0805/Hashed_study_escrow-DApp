import { formatUnits } from 'viem'
import { MUSD_DECIMALS } from './amount'

/** 체인의 정수 금액(1_000_000) → 화면용 문자열("1") */
export function formatMusd(amount: bigint | undefined): string {
  if (amount === undefined) return '-'
  return Number(formatUnits(amount, MUSD_DECIMALS)).toLocaleString('ko-KR', { maximumFractionDigits: 6 })
}

/** 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 → 0xf39F…2266 */
export function shortAddress(addr: string | undefined): string {
  if (!addr) return '-'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** 유닉스 시각(초) → "2026. 11. 24. 오후 3:00" */
export function formatTime(seconds: bigint | number): string {
  return new Date(Number(seconds) * 1000).toLocaleString('ko-KR')
}

/** 남은 시간(초) → "2일 3시간 4분" */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0분'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return [d && `${d}일`, h && `${h}시간`, `${m}분`].filter(Boolean).join(' ')
}
