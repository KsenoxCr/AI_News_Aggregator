"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

function GenFeedBtn() {
  const [date, setDate] = useState<Date>(new Date(2024, 3, 20));

  api.news.generateFeed.useSubscription(date);

  const setNow = () => {
    setDate(new Date());
  };

  return <Button onClick={setNow}>generateFeed</Button>;
}

function AddSourceBtn() {
  const mutation = api.source.addSource.useMutation();

  const handleClick = () => {
    // mutation.mutate({
    //   slug: "url_fails",
    //   url: "https://example.com/notafeed.xml",
    // });
  };

  return <Button onClick={handleClick}>addSource</Button>;
}

export default function TestProcedures() {
  return (
    <div className="m-4 flex flex-col gap-2">
      <GenFeedBtn />
      <AddSourceBtn />
    </div>
  );
}
