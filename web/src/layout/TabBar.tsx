import type { TabName } from '../app/router'

const TABS: { name: TabName; icon: string; label: string }[] = [
  { name: 'home', icon: '🏠', label: '내 거래' },
  { name: 'create', icon: '✏️', label: '안전결제' },
  { name: 'wallet', icon: '👛', label: '내 지갑' },
]

/** 아래 탭 바: 지금 탭은 진하게 표시. 누르면 그 화면으로 바뀐다 */
export function TabBar({ active, onSelect }: { active?: TabName; onSelect: (tab: TabName) => void }) {
  return (
    <nav className="tabbar" aria-label="화면 이동">
      {TABS.map((t) => (
        <button
          key={t.name}
          className={active === t.name ? 'active' : ''}
          aria-current={active === t.name ? 'page' : undefined}
          onClick={() => onSelect(t.name)}
        >
          <span className="icon" aria-hidden>
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
