import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  adminToken,
  isConfigured,
  verifyPassword,
} from "@/lib/adminAuth";

/** 로그인: 비밀번호 확인 후 httpOnly 세션 쿠키 발급 */
export async function POST(request: Request) {
  // 비밀번호가 환경변수에 없으면 아무나 들어오지 못하게 막습니다
  if (!isConfigured()) {
    return Response.json(
      {
        error:
          "서버에 ADMIN_PASSWORD가 설정되지 않았습니다. Vercel > Settings > Environment Variables 에 등록한 뒤 다시 배포해 주세요.",
      },
      { status: 500 }
    );
  }

  const { password } = await request.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !verifyPassword(password)) {
    return Response.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, adminToken()!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: "/",
  });
  return Response.json({ ok: true });
}

/** 로그아웃 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
