// 관리자 인증 (서버 전용 — API 라우트에서만 import 하세요)
import { createHash } from "crypto";

export const ADMIN_COOKIE = "samteul_admin";

/** 세션 쿠키 유효기간 (초) — 7일 */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function serverPassword(): string | null {
  return process.env.ADMIN_PASSWORD ?? null;
}

/** 비밀번호에서 파생한 세션 토큰. 비밀번호 자체는 쿠키에 저장하지 않습니다. */
export function adminToken(): string | null {
  const password = serverPassword();
  if (!password) return null;
  return createHash("sha256")
    .update(`samteul-admin-session:${password}`)
    .digest("hex");
}

export function verifyPassword(input: string): boolean {
  const password = serverPassword();
  return password !== null && input === password;
}

export function verifyToken(token: string | undefined): boolean {
  const expected = adminToken();
  return expected !== null && token === expected;
}
