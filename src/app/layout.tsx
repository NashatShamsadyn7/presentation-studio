import type { Metadata, Viewport } from 'next';
import { Vazirmatn } from 'next/font/google';
import Offline from '@/components/Offline';
// فۆرموولی بیرکاری — فۆنتەکانی KaTeX لەگەڵ بەستەکەدا دەڕۆن،
// بۆیە لە دۆخی بێ ئینتەرنێتیشدا کاردەکەن (بڕوانە PWA)
import 'katex/dist/katex.min.css';
import './globals.css';

// فۆنتی ڕووکار — پشتگیری کوردی سۆرانی و عەرەبی دەکات
const vazir = Vazirmatn({
  variable: '--font-ui',
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'ستودیۆی پێشکەشکردن',
  description: 'دروستکەری پێشکەشکردنی ئەکادیمی بە AI — کوردی، عەرەبی، ئینگلیزی',
  manifest: './manifest.webmanifest',
  icons: { icon: './icon.svg', apple: './icon.svg' },
  appleWebApp: { capable: true, title: 'پێشکەشکردن', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#3B5BDB',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // suppressHydrationWarning: زۆر لە پێوەکراوەکانی وێبگەڕ (بۆ نموونە
    // ئەوانەی ئاراستەی ڕاست-بۆ-چەپ) پۆل و سیفەت دەخەنە سەر <html> و <body>
    // پێش ئەوەی React بار بێت. ئەوە جیاوازییەکی ڕووکەشە و کاری تێدا نییە،
    // بەڵام React وەک هەڵەیەکی گەورە پیشانی دەدات. تەنها لەم دوو تاگەدا
    // کپ دەکرێتەوە — نەک لە ناوەڕۆکی ئەپەکەدا.
    <html lang="ckb" dir="rtl" className={vazir.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Offline />
      </body>
    </html>
  );
}
