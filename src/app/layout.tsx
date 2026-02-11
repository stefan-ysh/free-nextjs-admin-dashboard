import type { Metadata } from "next";
import './globals.css';

import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import ToastProvider from '@/components/common/ToastProvider';
import { AuthProvider } from './auth-context';

const themeInitScript = `(() => {
  try {
    const stored = window.localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
    const root = document.documentElement;
    const body = document.body;
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    body?.classList.toggle('dark', isDark);
    root.dataset.theme = theme;
    if (body) body.dataset.theme = theme;
  } catch (error) {
    console.warn('Theme init failed', error);
  }
})();`;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased transition-colors">
        <ThemeProvider>
          <AuthProvider>
            <SidebarProvider>{children}</SidebarProvider>
            <ToastProvider />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
