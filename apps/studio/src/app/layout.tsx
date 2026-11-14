import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "danlang Studio",
  description: "See your .dan tree as nodes and test how messages are routed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
