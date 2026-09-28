import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Professor Toni · Ambiente de aprendizagem",
  description: "Ambiente de aprendizagem Professor Toni: cursos de Office, Word, Excel e PowerPoint.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
