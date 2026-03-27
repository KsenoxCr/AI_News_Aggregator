"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Typography } from "./typography";
import { EmailSchemaFactory } from "~/lib/validators/user";
import { authClient } from "~/server/better-auth/client";

export function LoginForm() {
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const t = useTranslations();

  const login = async (formData: FormData) => {
    const entry = String(formData.get("email"));

    const schema = EmailSchemaFactory(t);
    const result = schema.safeParse(entry);

    if (result.error) {
      toast.error(result.error.errors[0]?.message, { position: "top-center" });
      return;
    }

    const { error } = await authClient.signIn.magicLink({
      email: entry,
      callbackURL: "/feed",
      newUserCallbackURL: "/settings",
    });

    // TODO: Translate

    if (!error) {
      setSentEmail(entry);
    } else if ((error.code = "RATE_LIMIT_EXCEEDED")) toast.error(error.message);
  };

  if (sentEmail) {
    return (
      <div className="flex flex-col">
        <Typography variant="body-sm" color="muted" className="text-center">
          Magic link sent to{" "}
          <span className="text-foreground font-medium">{sentEmail}</span>.
          Check your inbox.
        </Typography>
      </div>
    );
  }

  return (
    <form action={login} className="flex flex-col gap-4">
      <Input type="text" name="email" placeholder="Enter your email" />
      <Button size="lg" type="submit" className="w-full">
        Send Magic Link
      </Button>
      <Typography variant="body-sm" color="muted" className="text-center">
        No password needed. We&apos;ll email you a sign-in link.
      </Typography>
    </form>
  );
}
