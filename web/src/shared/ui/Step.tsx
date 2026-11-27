import type { ReactNode } from 'react'
import type { TxState } from '../hooks/useTx'
import { Tag } from './Tag'
import { TxStatus } from './TxStatus'

type StepProps = {
  n: number
  kind: 'write' | 'sign'
  title: string
  desc: string
  done: boolean
  tx: TxState
  successText?: string
  /** 이 단계의 실행 버튼 */
  children: ReactNode
}

/** "1단계 · 승인" 같은 진행 단계 한 줄: 상태 아이콘, 제목, 버튼, 설명, 진행 상자 */
export function Step({ n, kind, title, desc, done, tx, successText, children }: StepProps) {
  const icon = done ? '✅' : tx.phase === 'error' ? '❌' : tx.phase === 'idle' ? '⬜' : '⏳'
  return (
    <li className={`step ${done ? 'done' : ''}`}>
      <div className="step-head">
        <span>
          {icon} {n}단계 · {title} <Tag kind={kind} />
        </span>
        {children}
      </div>
      <div className="muted small">{desc}</div>
      <TxStatus state={tx} successText={successText} />
    </li>
  )
}
