import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kahoot · Engenharia de Dados',
  description: 'Quiz ao vivo do workshop Engenharia de Dados na era da IA.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
