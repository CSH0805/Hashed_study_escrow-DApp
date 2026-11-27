/** 유닉스 초 → <input type="datetime-local"> 값 ("2026-11-24T15:00", 내 컴퓨터 시간대 기준) */
export function toLocalInput(seconds: number): string {
  const d = new Date(seconds * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> 값 → 유닉스 초. 비어 있으면 0 */
export function fromLocalInput(value: string): number {
  return value ? Math.floor(new Date(value).getTime() / 1000) : 0
}
