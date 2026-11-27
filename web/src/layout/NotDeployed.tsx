import { NETWORK_NAME, TARGET_CHAIN } from '../config/network'

/** 이 네트워크에 컨트랙트가 아직 없을 때: 버튼을 눌러도 실패만 하므로 안내만 보여준다 */
export function NotDeployed() {
  return (
    <div className="app">
      <section className="card">
        <h2>{NETWORK_NAME}에 아직 배포되지 않았어요</h2>
        <p className="small">
          contracts/deployments/{TARGET_CHAIN.id}.json 이 없어요. 컨트랙트를 {NETWORK_NAME}에 배포한 뒤 web/ 폴더에서{' '}
          <code>npm run sync</code> 를 실행하고 새로고침해 주세요. (docs/SEPOLIA.md 참고)
        </p>
      </section>
    </div>
  )
}
