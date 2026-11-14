import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "danlang: learn to build smarter, cheaper chatbots", template: "%s · danlang" },
  description: "danlang is a simple language for telling a chatbot what to do. Free lessons with examples you can try.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="logo">
            dan<span>lang</span>
          </Link>
          <nav>
            <Link href="/learn/introduction">Tutorial</Link>
            <Link href="/playground">Try it</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
