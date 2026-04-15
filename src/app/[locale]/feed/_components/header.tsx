"use client";

import { ArrowLeft, Menu } from "lucide-react";
import Link from "next/link";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Typography } from "../../_components/typography";
import { BRAND } from "~/config/business";
import { authClient } from "~/server/better-auth/client";
import { useRouter } from "~/lib/i18n/routing";

export function Header() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleLogout = async () => {
    await authClient.signOut();
    router.replace("/");
  };

  return (
    <header className="border-border md:bg-background/80 relative border-b px-4 py-3 md:sticky md:top-0 md:z-10 md:backdrop-blur-sm">
      <div className="relative flex items-center">
        <Drawer direction="left">
          <DrawerTrigger asChild>
            <button className="text-muted-foreground">
              <Menu className="size-8" />
            </button>
          </DrawerTrigger>
          <DrawerContent className="w-1/4 p-0 before:inset-0 before:rounded-none">
            <div className="bg-popover flex h-screen flex-col gap-1 p-4">
              <DrawerClose asChild>
                <button className="text-muted-foreground mb-2 self-start">
                  <ArrowLeft className="size-8" />
                </button>
              </DrawerClose>
              <DrawerClose asChild>
                <Link
                  href="/settings"
                  className="text-foreground hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
                >
                  Settings
                </Link>
              </DrawerClose>
              <button
                onClick={handleLogout}
                className="text-foreground hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
              >
                Log out
              </button>
            </div>
          </DrawerContent>
        </Drawer>
        <Typography
          as="h1"
          variant="heading-1"
          size="2xl"
          className="absolute left-1/2 -translate-x-1/2"
        >
          {BRAND.appName}
        </Typography>
        <Typography
          variant="body-sm"
          color="muted"
          className="absolute right-0 hidden md:block"
        >
          {session?.user.email}
        </Typography>
      </div>
    </header>
  );
}
