"use client";

import { createContext, useContext, useState } from "react";
import { type Digest } from "~/lib/types/feed";

type DigestContextValue = {
  selectedDigest: Digest | null;
  setSelectedDigest: (digest: Digest | null) => void;
  loadingDigest: Digest | null;
  setLoadingDigest: (digest: Digest | null) => void;
};

const DigestContext = createContext<DigestContextValue | null>(null);

export function DigestProvider({ children }: { children: React.ReactNode }) {
  const [selectedDigest, setSelectedDigest] = useState<Digest | null>(null);
  const [loadingDigest, setLoadingDigest] = useState<Digest | null>(null);

  return (
    <DigestContext.Provider
      value={{
        selectedDigest,
        setSelectedDigest,
        loadingDigest,
        setLoadingDigest,
      }}
    >
      {children}
    </DigestContext.Provider>
  );
}

export function useDigestContext() {
  const ctx = useContext(DigestContext);
  if (!ctx)
    throw new Error("useDigestContext must be used within DigestProvider");
  return ctx;
}
