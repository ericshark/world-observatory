import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist_Mono } from "next/font/google";
import "./globals.css";

const display = Chakra_Petch({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "World Observatory — Global Intelligence",
  description:
    "A command-centre view of the world: population, GDP, government debt, inflation, life expectancy and more on a night-lights map, from real published data.",
};

export const viewport: Viewport = {
  themeColor: "#05040d",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
