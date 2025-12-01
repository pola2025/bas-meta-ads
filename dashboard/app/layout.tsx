import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polarad Meta 광고리포트 시스템",
  description: "Meta 광고 성과 분석 대시보드",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
