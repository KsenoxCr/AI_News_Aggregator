"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Typography } from "./typography";
import { EmailSchemaFactory } from "~/lib/validators/user";
import { authClient } from "~/server/better-auth/client";
import { Spinner } from "~/components/ui/spinner";

export function LoginForm() {
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const t = useTranslations();

  const login = async (formData: FormData) => {
    setLoading(true);

    const entry = String(formData.get("email"));

    const result = EmailSchemaFactory(t).safeParse(entry);

    if (result.error) {
      toast.error(result.error.errors[0]?.message, { position: "top-center" });
      setLoading(false);
      return;
    }

    const { error } = await authClient.signIn.magicLink({
      email: entry,
      callbackURL: "/feed",
      newUserCallbackURL: "/settings",
    });

    if (error) {
      setLoading(false);
      throw error;
    }

    setSentEmail(entry);
  };

  if (sentEmail) {
    return (
      <div className="flex flex-col">
        <Typography variant="body-sm" color="muted" className="text-center">
          {t.rich("landing.login.magicLinkSent", {
            address: sentEmail,
            email: (chunks) => (
              <span className="text-foreground font-medium">{chunks}</span>
            ),
          })}
        </Typography>
      </div>
    );
  }

  return (
    <form action={login} className="flex flex-col gap-4">
      <Input
        type="text"
        name="email"
        placeholder={t("landing.login.emailPlaceholder")}
      />
      <Button size="lg" type="submit" className="w-full">
        {loading ? (
          <Spinner className="size-4" />
        ) : (
          t("landing.login.submitButton")
        )}
      </Button>
      <Typography variant="body-sm" color="muted" className="text-center">
        {t("landing.login.description")}
      </Typography>
    </form>
  );
}
