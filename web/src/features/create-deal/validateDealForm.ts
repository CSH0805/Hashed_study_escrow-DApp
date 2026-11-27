import { isAddress } from 'viem'

type Input = { me?: string; seller: string; amount?: bigint; deadline: number; now: number }

/**
 * 화면에서 먼저 걸러 주는 검사. 문제가 있으면 안내 문장, 없으면 null.
 * 컨트랙트도 같은 규칙을 검사하지만(custom error), 서명 창을 띄우기 전에 알려 주면 친절하다.
 */
export function validateDealForm({ me, seller, amount, deadline, now }: Input): string | null {
  if (!me) return '먼저 지갑을 연결해 주세요.'
  if (!isAddress(seller)) return '판매자 주소를 0x로 시작하는 42자리 주소로 입력해 주세요.'
  if (seller.toLowerCase() === me.toLowerCase()) return '자기 자신을 판매자로 지정할 수 없어요.'
  if (amount === undefined) return '금액을 숫자로 입력해 주세요. (소수점 6자리까지)'
  if (amount <= 0n) return '금액은 0보다 커야 해요.'
  if (!deadline) return '마감일을 입력해 주세요.'
  if (deadline <= now) return '마감은 체인의 현재 시각보다 뒤여야 해요.'
  return null
}
