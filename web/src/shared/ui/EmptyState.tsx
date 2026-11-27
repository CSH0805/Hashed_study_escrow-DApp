import type { ReactNode } from 'react'

/** 목록이 비었을 때 가운데에 보여주는 큰 아이콘 + 안내 문구 */
export function EmptyState({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden>
        {icon}
      </span>
      {children}
    </div>
  )
}
