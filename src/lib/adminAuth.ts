// 관리자 인증 (서버 전용 — API 라우트에서만 import 하세요)
import { createHash, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "saemtteul_admin";

/** 세션 쿠키 유효기간 (초) — 7일 */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * 비밀번호는 코드에 두지 않습니다.
 * 이 저장소는 공개라 소스를 누구나 볼 수 있으므로, 환경변수로만 받습니다.
 *
 * - 로컬: `.env.local` 에 ADMIN_PASSWORD=...
 * - 배포: Vercel > Settings > Environment Variables 에 ADMIN_PASSWORD
 *
 * 값이 없으면 기본값으로 넘어가지 않고 로그인을 아예 막습니다.
 * (예전에는 abc123이 기본값이었는데, 공개 저장소에서는 그대로 두면
 *  주소만 알면 누구나 들어올 수 있습니다)
 */
function serverPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value ? value : null;
}

/** ADMIN_PASSWORD가 설정되어 있는지 */
export function isConfigured(): boolean {
  return serverPassword() !== null;
}

/**
 * 길이에 따라 비교 시간이 달라지지 않도록 양쪽을 해시한 뒤 상수 시간 비교합니다.
 * (짧은 비밀번호라도 한 글자씩 맞춰 보는 공격을 어렵게 합니다)
 */
function equals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** 비밀번호에서 파생한 세션 토큰. 비밀번호 자체는 쿠키에 저장하지 않습니다. */
export function adminToken(): string | null {
  const password = serverPassword();
  if (!password) return null;
  return createHash("sha256")
    .update(`saemtteul-admin-session:${password}`)
    .digest("hex");
}

export function verifyPassword(input: string): boolean {
  const password = serverPassword();
  return password !== null && equals(input, password);
}

export function verifyToken(token: string | undefined): boolean {
  const expected = adminToken();
  return expected !== null && token !== undefined && equals(token, expected);
}
