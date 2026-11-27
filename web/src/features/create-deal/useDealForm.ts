import { useState } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { useChainNow } from '../../shared/hooks/useChainNow'
import { parseAmount } from '../../shared/lib/amount'
import { fromLocalInput, toLocalInput } from '../../shared/lib/time'
import { validateDealForm } from './validateDealForm'

/** 안전결제 만들기 입력값(판매자·물건·가격·마감)과, 그 값을 체인용 숫자로 바꾼 결과 */
export function useDealForm() {
  const { address } = useAccount()
  const { now } = useChainNow()

  const [seller, setSeller] = useState('')
  const [description, setDescription] = useState('')
  const [amountText, setAmountText] = useState('100')
  const [deadlineText, setDeadlineText] = useState('')

  // 마감 기본값: 사용자가 아직 고르지 않았다면 "체인 시각 + 1일"
  const deadlineValue = deadlineText || (now > 0 ? toLocalInput(now + 86400) : '')
  const amount = parseAmount(amountText)
  const deadline = fromLocalInput(deadlineValue)
  const problem = validateDealForm({ me: address, seller, amount, deadline, now })

  return {
    fields: { seller, description, amountText, deadlineValue },
    set: { seller: setSeller, description: setDescription, amountText: setAmountText, deadline: setDeadlineText },
    /** 체인에 보낼 값. problem이 null일 때만 믿고 쓸 수 있다 */
    values: { seller: seller as Address, description, amount, deadline: BigInt(deadline) },
    problem,
    now,
  }
}

export type DealForm = ReturnType<typeof useDealForm>
