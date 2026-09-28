import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trials · Ambiente de aprendizagem",
  description: "Cursos de Office com aulas e avaliações práticas.",
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
