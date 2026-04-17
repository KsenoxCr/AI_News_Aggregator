"use client";

import { DigestProvider } from "./_components/digest-context";

export default function FeedLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <DigestProvider>
      {children}
      {modal}
    </DigestProvider>
  );
}
