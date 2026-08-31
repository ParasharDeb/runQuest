import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pragjyotishpur Tale",
  description: "Outrun the Asura through the shrine woods.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
