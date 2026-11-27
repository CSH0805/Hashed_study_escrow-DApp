import type { DealForm } from './useDealForm'

/** 글쓰기 화면처럼 라벨 위·큰 입력칸: 판매자 주소, 물건, 가격, 마감 */
export function DealFormFields({ form, disabled }: { form: DealForm; disabled: boolean }) {
  const { fields, set } = form
  return (
    <>
      <label>
        <span>
          판매자 지갑 주소 <span className="hint">0x로 시작하는 42자리</span>
        </span>
        <input className="mono" placeholder="0x…" value={fields.seller} onChange={(e) => set.seller(e.target.value.trim())} disabled={disabled} />
      </label>
      <label>
        <span>
          거래 물건 <span className="hint">목록에 제목으로 보여요</span>
        </span>
        <input placeholder="예: 중고 키보드" value={fields.description} onChange={(e) => set.description(e.target.value)} disabled={disabled} />
      </label>
      <label>
        가격
        <div className="price-input">
          <input inputMode="decimal" value={fields.amountText} onChange={(e) => set.amountText(e.target.value)} disabled={disabled} />
          <span className="unit">mUSD</span>
        </div>
      </label>
      <label>
        <span>
          마감일 <span className="hint">이 시각이 지나면 판매자가 직접 받아 갈 수 있어요</span>
        </span>
        <input type="datetime-local" value={fields.deadlineValue} onChange={(e) => set.deadline(e.target.value)} disabled={disabled} />
      </label>
    </>
  )
}
