export type Customer = {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecordStatus = "planned" | "in_progress" | "completed";

export type ConstructionRecord = {
  id: string;
  customerId: string;
  title: string;
  constructionDate: string | null;
  description: string | null;
  address: string | null;
  status: RecordStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CurrentUser = {
  user: { id: string; name: string; email: string };
  organization: { id: string; name: string };
};

export const STATUS_LABELS: Record<RecordStatus, string> = {
  planned: "予定",
  in_progress: "進行中",
  completed: "完了",
};

export const STATUS_OPTIONS: RecordStatus[] = ["planned", "in_progress", "completed"];
