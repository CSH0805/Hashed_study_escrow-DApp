import { useRoute } from './app/router'
import { NOT_DEPLOYED } from './config/network'
import { CreateDealScreen } from './features/create-deal/CreateDealScreen'
import { DealDetailScreen } from './features/deal-detail/DealDetailScreen'
import { DealsScreen } from './features/deals/DealsScreen'
import { WalletScreen } from './features/wallet/WalletScreen'
import { AppBar } from './layout/AppBar'
import { NotDeployed } from './layout/NotDeployed'
import { TabBar } from './layout/TabBar'
import { useRefreshOnNewBlock } from './shared/hooks/useRefreshOnNewBlock'

/**
 * 앱의 뼈대: 위 앱 바 + 지금 화면 + 아래 탭 바.
 * 이 파일은 "어떤 화면을 보여줄지"만 정한다. 각 화면의 기능은 features/ 폴더에 있다.
 */
export default function App() {
  const { route, go, back } = useRoute()
  const blockNumber = useRefreshOnNewBlock()

  if (NOT_DEPLOYED) return <NotDeployed />

  const openDeal = (id: bigint) => go({ name: 'deal', id })

  return (
    <div className="app">
      <AppBar />
      {/* key: 화면이 바뀔 때마다 새로 그려서 들어오는 애니메이션이 매번 나오게 */}
      <main className="screen-body" key={route.name === 'deal' ? `deal-${route.id}` : route.name}>
        {route.name === 'home' && <DealsScreen onOpen={openDeal} onCreate={() => go({ name: 'create' })} />}
        {route.name === 'create' && <CreateDealScreen onCreated={openDeal} />}
        {route.name === 'wallet' && <WalletScreen blockNumber={blockNumber} />}
        {route.name === 'deal' && <DealDetailScreen id={route.id} onBack={back} />}
      </main>
      {/* 상세 화면에서는 탭 바를 숨긴다 (앱에서 상세로 들어가면 아래 탭이 사라지는 것처럼) */}
      {route.name !== 'deal' && <TabBar active={route.name} onSelect={(name) => go({ name })} />}
    </div>
  )
}
