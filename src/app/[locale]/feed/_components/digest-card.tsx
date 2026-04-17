"use client";

import { type Dispatch, type SetStateAction } from "react";
import { useRouter } from "~/lib/i18n/routing";
import { Typography } from "../../_components/typography";
import { Spinner } from "~/components/ui/spinner";
import { type Digest } from "~/lib/types/feed";
import { useDigestContext } from "./digest-context";
import { CategoryBadge } from "./category-badge";

export function DigestCard({
  digest,
  setSelectedDigest,
}: {
  digest: Digest;
  setSelectedDigest: Dispatch<SetStateAction<Digest | null>>;
}) {
  const router = useRouter();
  const { loadingDigest, setLoadingDigest } = useDigestContext();

  const openModal = () => {
    setSelectedDigest(digest);
    setLoadingDigest(digest);
    router.push("/feed/digests/open");
  };

  return (
    <div
      className="bg-card border-border rounded-xl border p-5"
      onClick={() => {
        if (window.matchMedia("(pointer: fine)").matches) openModal();
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {digest.categories.map((c) => (
            <CategoryBadge key={c} category={c} />
          ))}{" "}
        </div>
        <Typography as="h3" variant="heading-3">
          {digest.title}
        </Typography>
        {/* <Typography variant="body-sm" color="muted"> */}
        {/*   {digest.digest} */}
        {/* </Typography> */}
        <Typography variant="body-sm" color="muted">
          Generated at {digest.updated_at.toLocaleDateString()}
        </Typography>
        <div className="my-1 hidden w-full items-center justify-center md:flex">
          {loadingDigest === digest ? (
            <Spinner className="size-4" />
          ) : (
            <Typography
              as="button"
              variant="body-sm"
              className="text-primary"
              onClick={() => openModal()}
            >
              Summary
            </Typography>
          )}
        </div>
      </div>
    </div>
  );
}
