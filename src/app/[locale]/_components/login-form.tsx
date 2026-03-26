"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
      toast.error(result.error.errors[0]?.message, {
        position: "top-center",
      });
      return;
    }

    const { error } = await authClient.signIn.magicLink({
      email: entry,
      callbackURL: "/dashboard",
      newUserCallbackURL: "/settings",
      errorCallbackURL: "/error",
    });

    if (!error) {
      setSentEmail(entry);
    }
  };

  console.log(sentEmail);

  return !sentEmail ? (
    <form action={login}>
      <Input type="text" name="email" placeholder="Enter your email"></Input>
      <Button size="lg" type="submit">
        Send Magic Link
      </Button>
    </form>
  ) : (
    <div>
      <p>Magic link sent to {sentEmail}</p>
    </div>
  );
}
