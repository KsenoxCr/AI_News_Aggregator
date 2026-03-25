import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import { TRPCReactProvider } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Geist, Figtree } from "next/font/google";
import "~/styles/globals.css";

const figtree = Figtree({subsets:['latin'],variable:'--font-sans'});

const geist = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
});

export default function LocaleLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html className={cn(geist.variable, "font-sans", figtree.variable)} lang="en">
            <body>
                <TRPCReactProvider>
                    {children}
                    <ReactQueryDevtools initialIsOpen={false} />
                </TRPCReactProvider>
            </body>
        </html>
    );
}
