/**
 * 읽기 / 쓰기 / 서명 표시 태그 (학습용).
 *   read  [읽기]  view 함수 — 가스 없음, 서명 없음
 *   write [쓰기]  트랜잭션 — 서명 + 가스, 블록에 기록
 *   sign  [서명]  메시지 서명 — 가스 없음, 블록에 기록 안 됨
 */
const LABEL = {
  read: '읽기 · 가스 없음',
  write: '쓰기 · 트랜잭션',
  sign: '서명 · 가스 없음',
} as const

export function Tag({ kind, text }: { kind: keyof typeof LABEL; text?: string }) {
  return <span className={`tag ${kind}`}>{text ?? LABEL[kind]}</span>
}
