import { Suspense } from "react";
import { PhoneSearch } from "@/components/phone-search";
import { Spinner } from "@/components/ui";

export default function HomePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PhoneSearch />
    </Suspense>
  );
}
