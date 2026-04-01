import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "BuyerOS — 해외 바이어 발굴 플랫폼",
  description: "바이어 발굴부터 이메일 캠페인까지 한 곳에서",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
