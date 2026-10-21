import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans, Geist } from 'next/font/google'
import './globals.css'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Final Ball',
  description: 'AI-powered transfer and captain advice for Fantasy Premier League managers.',
  metadataBase: new URL('https://finalball.manavpkothari.dev'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn("dark", ibmPlexSans.variable, ibmPlexMono.variable, "font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
