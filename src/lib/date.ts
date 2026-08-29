// 날짜 유틸 — 매출/주문내역은 모두 "로컬 시간 기준 하루"로 끊습니다.

/** 로컬 기준 "YYYY-MM-DD" 키 */
export function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" → Date (그날 00:00 로컬) */
export function dayStart(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00`);
}

/** 하루 조회 범위 [start, end) */
export function dayRange(dayKey: string): { start: Date; end: Date } {
  const start = dayStart(dayKey);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** dayKey에서 delta일 이동한 dayKey */
export function shiftDay(dayKey: string, delta: number): string {
  const d = dayStart(dayKey);
  d.setDate(d.getDate() + delta);
  return dayKeyOf(d);
}

/** 화면 표시용 라벨 (예: "8월 28일 (금)") */
export function formatDayLabel(dayKey: string): string {
  return dayStart(dayKey).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/** 시:분 (예: "14:05") */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
