import type { Metadata } from "next";
import { Gaegu, Noto_Sans_KR } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// 본문/폼/버튼용 기본 sans. Pretendard가 Google Fonts 정식 배포가 아니라 Noto Sans KR로 갈음.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// 제목/브랜드용 손글씨체. 일기장 느낌의 아날로그 터치를 제목 영역에만 제한적으로 얹는다.
const gaegu = Gaegu({
  variable: "--font-handwritten",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "일기장",
  description: "AI가 감정과 해시태그를 달아주는 개인 일기장",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${notoSansKr.variable} ${gaegu.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
