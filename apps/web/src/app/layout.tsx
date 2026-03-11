import type { Metadata } from "next";
import { AuthProvider } from "../context/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Linkly Calendar",
  description: "커플 캘린더 웹앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
