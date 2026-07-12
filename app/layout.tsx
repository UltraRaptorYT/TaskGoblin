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
    default: "TaskGoblin — Turn project chaos into action",
    template: "%s · TaskGoblin",
  },
  description:
    "Upload a project brief or Telegram export and turn scattered context into clear tasks, owners, deadlines, risks, and timely nudges.",
  applicationName: "TaskGoblin",
  keywords: [
    "AI project management",
    "Telegram task extraction",
    "project brief analyzer",
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
    title: "TaskGoblin — Turn project chaos into action",
    description:
      "Turn project briefs and team conversations into accountable work in one scan.",
    siteName: "TaskGoblin",
  },
  twitter: {
    card: "summary",
    title: "TaskGoblin — Turn project chaos into action",
    description:
      "Turn project briefs and team conversations into accountable work in one scan.",
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
