"use client";

import type { Customer } from "@/lib/types";
import { CustomerCard } from "./customer-card";
import { RecordsSection } from "./records-section";

/** 顧客情報カード + 工事履歴 */
export function CustomerView({ customer, onUpdated }: { customer: Customer; onUpdated: (c: Customer) => void }) {
  return (
    <div className="space-y-5">
      <CustomerCard customer={customer} onUpdated={onUpdated} />
      <RecordsSection key={customer.id} customer={customer} />
    </div>
  );
}
