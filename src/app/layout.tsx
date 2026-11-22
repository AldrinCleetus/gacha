import type { Metadata } from "next";
import "@/styles/globals.css";
import { Shell } from "@/components/layout/Shell";

export const metadata: Metadata = {
  title: "Bhagya - Kerala State Lottery Checker",
  description: "Instant, celebratory Kerala Lottery ticket verification and prize tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased selection:bg-emerald-500 selection:text-white">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
