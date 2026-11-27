/** 상세 화면 위쪽: ← 뒤로 버튼 + 화면 제목 (앱의 내비게이션 바처럼) */
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="screen-header">
      <button className="back" onClick={onBack} aria-label="뒤로">
        ←
      </button>
      <h2>{title}</h2>
    </div>
  )
}
