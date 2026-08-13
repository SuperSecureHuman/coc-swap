import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clan Swap — Clash of Cards trade planner",
  description: "Coordinate Clash of Cards trades with your clan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="max-w-5xl mx-auto p-4">{children}</div>
      </body>
    </html>
  );
}
