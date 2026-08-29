import { redirect } from "next/navigation";

/**
 * 고객용 주문 페이지는 없앴습니다.
 * 이제 카운터의 포스(/admin)에서만 주문을 받으므로 루트로 들어오면 바로 넘겨줍니다.
 */
export default function Home() {
  redirect("/admin");
}
