import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://opentradex.vercel.app"),
  title: "OpenTradex",
  description:
    "Our implementation. Your strategy. Open-source onboarding, market rails, and a six-step guide for building AI-assisted trading systems.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "OpenTradex",
    description:
      "Our implementation. Your strategy. Open-source onboarding, market rails, and a six-step guide for building AI-assisted trading systems.",
    url: "https://opentradex.vercel.app",
    siteName: "OpenTradex",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="min-h-full antialiased">
      <body className="min-h-screen bg-background text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
