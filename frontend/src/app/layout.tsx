import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { UiFeedbackProvider } from "@/context/UiFeedbackContext";
import AppLayout from "@/components/layout/AppLayout";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Audito - AI-Powered Audit Platform",
  description:
    "Simplify audits and strengthen compliance with our comprehensive audit management solution.",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="app-background font-sans">
        <AuthProvider>
          <UiFeedbackProvider>
            <AppLayout>{children}</AppLayout>
          </UiFeedbackProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
