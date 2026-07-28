import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TaskGoblin — Project management from Telegram",
    template: "%s · TaskGoblin",
  },
  description:
    "Turn Telegram project conversations into reviewable tasks, owners, deadlines, decisions, and timely nudges.",
  applicationName: "TaskGoblin",
  keywords: [
    "AI project management",
    "Telegram task extraction",
    "Telegram project manager",
    "team accountability",
    "task board",
  ],
  authors: [{ name: "TaskGoblin" }],
  creator: "TaskGoblin",
  icons: {
    icon: "/brand/taskgoblin-logo.png",
    apple: "/brand/taskgoblin-logo.png",
  },
  openGraph: {
    type: "website",
    title: "TaskGoblin — Project management from Telegram",
    description:
      "Turn Telegram project conversations into clear, accountable work.",
    siteName: "TaskGoblin",
  },
  twitter: {
    card: "summary",
    title: "TaskGoblin — Project management from Telegram",
    description:
      "Turn Telegram project conversations into clear, accountable work.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
