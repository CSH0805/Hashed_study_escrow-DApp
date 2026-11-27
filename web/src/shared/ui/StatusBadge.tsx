import { STATUS_LABEL } from '../lib/dealStatus'

/** 거래 상태 배지: 진행중(주황) · 지급완료(초록) · 환불완료(회색) */
export function StatusBadge({ status }: { status: number }) {
  return <span className={`badge s${status}`}>{STATUS_LABEL[status]}</span>
}
