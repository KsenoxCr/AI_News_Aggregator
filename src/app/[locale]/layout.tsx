import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TRPCReactProvider } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Geist, Figtree } from "next/font/google";
import "~/styles/globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "~/lib/i18n/routing";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) notFound();

  const messages = await getMessages();

  return (
    <html
      className={cn(geist.variable, "font-sans", figtree.variable)}
      lang={locale}
      suppressHydrationWarning
    >
      <body>
        <TRPCReactProvider>
          <NextIntlClientProvider messages={messages}>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              disableTransitionOnChange
            >
              {children}
              <Toaster />
            </ThemeProvider>
          </NextIntlClientProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
