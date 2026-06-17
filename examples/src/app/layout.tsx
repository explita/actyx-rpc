import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "../providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Actyx RPC — Type-Safe RPC & React Query Toolkit",
  description:
    "Explore Actyx RPC, a type-safe remote procedure call and React query toolkit with built-in caching, optimistic updates, infinite queries, and SSE support. View live examples of queries, mutations, pagination, and subscriptions.",
  keywords: [
    "actyx rpc",
    "react rpc",
    "type-safe api",
    "react query",
    "optimistic updates",
    "infinite query react",
    "server-sent events react",
    "rpc typescript",
    "react data fetching",
    "react mutation",
  ],
  authors: [{ name: "explita" }],
  openGraph: {
    title: "Actyx RPC — React Query & RPC Toolkit Examples",
    description:
      "A lightweight, type-safe RPC framework for React with built-in caching, pagination, optimistic updates, and real-time SSE support.",
    type: "website",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
