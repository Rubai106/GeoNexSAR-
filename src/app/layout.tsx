import type { Metadata } from "next";
import "./globals.css";
import "@/styles/atlas.css";

export const metadata: Metadata = {
  title: "Beyonders — Earth Change Atlas | NASA Space Apps 2026",
  description:
    "Explore real NISAR radar observations of a changing wetland, investigate why regions were flagged as radar-change candidates, and challenge every result.",
  keywords: [
    "NISAR",
    "wetland",
    "SAR",
    "radar",
    "inundation",
    "NASA",
    "Space Apps",
    "Beyonders",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
