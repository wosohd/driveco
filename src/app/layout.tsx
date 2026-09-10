import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DriveCo | Driver Application",
  description:
    "Apply for driver opportunities with DriveCo. Complete the online driver application form and submit the required information.",
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
