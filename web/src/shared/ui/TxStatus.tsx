import type { TxState } from '../hooks/useTx'
import { formatFee, formatGas } from '../lib/gas'
import { EXPLORER_URL, NETWORK_NAME } from '../../config/network'

const MESSAGES: Record<TxState['phase'], string> = {
  idle: '',
  switching: `MetaMask에서 ${NETWORK_NAME} 네트워크로 전환(또는 추가)을 승인해 주세요…`,
  simulating: '실행 결과를 미리 확인하는 중… (읽기 · 가스 없음)',
  signing: 'MetaMask 창에서 확인(서명)해 주세요…',
  pending: '전송 완료! 블록에 담기기를 기다리는 중…',
  success: '성공! 블록에 기록됐어요.',
  error: '실패',
}

/** 트랜잭션 진행 상황을 한국어로 보여주는 작은 안내 상자 */
export function TxStatus({ state, successText }: { state: TxState; successText?: string }) {
  if (state.phase === 'idle') return null
  return (
    <div className={`tx tx-${state.phase}`} role="status">
      <div>
        {state.phase === 'error'
          ? `❌ ${state.error ?? MESSAGES.error}`
          : state.phase === 'success' && successText
            ? successText
            : MESSAGES[state.phase]}
      </div>
      {/* 성공했을 때만: 영수증에 적힌 실제 비용 */}
      {state.phase === 'success' && state.gasUsed !== undefined && state.fee !== undefined && (
        <div className="small">
          ⛽ 블록 #{state.blockNumber?.toString()} · 가스 {formatGas(state.gasUsed)} 사용 · 수수료 {formatFee(state.fee)}
        </div>
      )}
      {state.hash && (
        <div className="muted mono small" title={state.hash}>
          tx:{' '}
          {/* Sepolia에서는 Etherscan에서 누구나 이 트랜잭션을 확인할 수 있다 */}
          {EXPLORER_URL ? (
            <a href={`${EXPLORER_URL}/tx/${state.hash}`} target="_blank" rel="noreferrer">
              {state.hash.slice(0, 10)}…{state.hash.slice(-8)} ↗
            </a>
          ) : (
            <>
              {state.hash.slice(0, 10)}…{state.hash.slice(-8)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
