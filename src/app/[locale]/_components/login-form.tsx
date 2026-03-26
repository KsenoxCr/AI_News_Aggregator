"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { EmailSchemaFactory } from "~/lib/validators/user";
import { authClient } from "~/server/better-auth/client";

export function LoginForm() {
  // TODO: useState for form | instructions

  const t = useTranslations();

  const login = async (formData: FormData) => {
    const entry = String(formData.get("email"));

    const schema = EmailSchemaFactory(t);
    const result = schema.safeParse(entry);

    console.log("pre-pass");

    if (result.error) {
      toast.error(result.error.errors[0]?.message, {
        position: "top-center",
      });
      return;
    }

    console.log("pass");

    const { data, error } = await authClient.signIn.magicLink({
      email: entry,
      callbackURL: "/dashboard",
      newUserCallbackURL: "/settings",
      errorCallbackURL: "/error",
    });
  };

  return (
    <form action={login}>
      <Input type="text" name="email" placeholder="Enter your email"></Input>
      <Button size="lg" type="submit">
        Send Magic Link
      </Button>
    </form>
  );
}
