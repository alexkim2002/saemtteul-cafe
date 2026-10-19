import type { MetadataRoute } from "next";

/**
 * 홈 화면에 추가하면 주소창 없이 앱처럼 열립니다.
 * 카운터에서 휴대폰으로 쓰는 포스라 standalone + 세로 고정으로 둡니다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "샘뜰 카페 포스",
    short_name: "샘뜰 포스",
    description: "봉원교회 샘뜰 카페 주문·매출 관리",
    lang: "ko",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fefdf9",
    theme_color: "#fefdf9",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
