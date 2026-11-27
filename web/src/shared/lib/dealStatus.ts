/** 컨트랙트 enum Status 값(0,1,2)과 같은 순서. Escrow.sol의 enum을 바꾸면 여기도 바꿔야 한다. */
export const STATUS = { Funded: 0, Released: 1, Refunded: 2 } as const

/** 상태 값 → 한국어 */
export const STATUS_LABEL = ['진행중', '지급완료', '환불완료'] as const

/** 상태 값 → 목록 썸네일 아이콘 (상품 사진 자리) */
export const STATUS_ICON = ['📦', '🤝', '↩️'] as const

/** 거래에서 "나"의 역할. 버튼을 무엇을 보여줄지 정하는 기준 */
export type DealRole = '구매자' | '판매자' | '제3자'

export function getRole(me: string | undefined, deal: { buyer: string; seller: string }): DealRole {
  const m = me?.toLowerCase()
  if (m === deal.buyer.toLowerCase()) return '구매자'
  if (m === deal.seller.toLowerCase()) return '판매자'
  return '제3자'
}
