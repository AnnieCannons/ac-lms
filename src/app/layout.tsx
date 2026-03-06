import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FocusResetter from "@/components/ui/FocusResetter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AC LMS",
  description: "AC Learning Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: `try{var r=document.documentElement,b=document.body;if(localStorage.getItem('dyslexic-font')==='true')r.classList.add('dyslexic');if(localStorage.getItem('high-contrast')==='true')r.classList.add('high-contrast');if(localStorage.getItem('dark-mode')==='true'){r.classList.add('theme-dark');var hc=r.classList.contains('high-contrast');var dv=hc?{'--color-background':'#050308','--color-surface':'#0f0820','--color-dark-text':'#ffffff','--color-muted-text':'#e8deff','--color-border':'#887098','--color-teal-primary':'#ff90f0','--color-teal-light':'#1c0a34','--color-purple-primary':'#d0aaff','--color-purple-light':'#1a0840'}:{'--color-background':'#120d1e','--color-surface':'#1e1530','--color-dark-text':'#f0eaf8','--color-muted-text':'#a898c0','--color-border':'#2e2245','--color-teal-primary':'#c870b0','--color-teal-light':'#2a1530','--color-purple-primary':'#b080e0','--color-purple-light':'#251540'};Object.keys(dv).forEach(function(k){r.style.setProperty(k,dv[k])});b.style.setProperty('background-color',hc?'#050308':'#120d1e','important');b.style.setProperty('color',hc?'#ffffff':'#f0eaf8','important');}}catch(e){}` }} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-surface focus:border focus:border-teal-primary focus:text-teal-primary focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <FocusResetter />
        {children}
      </body>
    </html>
  );
}
