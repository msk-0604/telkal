import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerPage } from "@/components/customer-page";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = { title: "顧客詳細" };

export default function Page() {
  return (
    <Suspense fallback={<Spinner label="顧客情報を読み込み中" />}>
      <CustomerPage />
    </Suspense>
  );
}
