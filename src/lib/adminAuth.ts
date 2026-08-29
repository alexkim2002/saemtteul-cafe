// 관리자 인증 (서버 전용 — API 라우트에서만 import 하세요)
import { createHash } from "crypto";

export const ADMIN_COOKIE = "samteul_admin";

/** 세션 쿠키 유효기간 (초) — 7일 */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * ADMIN_PASSWORD 환경변수를 설정하지 않았을 때 쓰는 기본 비밀번호.
 * 교회 카운터 내부용 포스라 환경변수 없이도 바로 쓸 수 있게 두었습니다.
 * 바꾸고 싶으면 .env.local(또는 Vercel 환경변수)에 ADMIN_PASSWORD를 넣으세요.
 */
const DEFAULT_ADMIN_PASSWORD = "abc123";

function serverPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;
}

/** 비밀번호에서 파생한 세션 토큰. 비밀번호 자체는 쿠키에 저장하지 않습니다. */
export function adminToken(): string {
  return createHash("sha256")
    .update(`samteul-admin-session:${serverPassword()}`)
    .digest("hex");
}

export function verifyPassword(input: string): boolean {
  return input === serverPassword();
}

export function verifyToken(token: string | undefined): boolean {
  return token !== undefined && token === adminToken();
}
