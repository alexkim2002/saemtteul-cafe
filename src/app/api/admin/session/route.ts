import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyToken } from "@/lib/adminAuth";

/** 현재 브라우저의 관리자 세션 유효 여부 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  return Response.json({ authed: verifyToken(token) });
}
