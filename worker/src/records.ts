import type { AuthContext } from "./auth";
import { getCustomerOr404 } from "./customers";
import { HttpError, fieldErrors, json, nowIso, readJson } from "./http";
import { recordCreateSchema, recordUpdateSchema } from "./schemas";

type RecordRow = {
  id: string;
  customer_id: string;
  title: string;
  construction_date: string | null;
  description: string | null;
  address: string | null;
  status: "planned" | "in_progress" | "completed";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const RECORD_COLUMNS = `id, customer_id, title, construction_date, description, address, status, notes, created_at, updated_at`;

function toRecord(r: RecordRow) {
  return {
    id: r.id,
    customerId: r.customer_id,
    title: r.title,
    constructionDate: r.construction_date,
    description: r.description,
    address: r.address,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** 顧客別の工事履歴（日付未定 → 新しい日付の順） */
export async function listRecords(customerId: string, env: Env, auth: AuthContext): Promise<Response> {
  // 顧客の存在確認と一覧取得を 1 往復で行う
  const [customer, list] = await env.DB.batch<{ id: string } | RecordRow>([
    env.DB.prepare(`SELECT id FROM customers WHERE id = ?1 AND organization_id = ?2`).bind(
      customerId,
      auth.organizationId,
    ),
    env.DB.prepare(
      `SELECT ${RECORD_COLUMNS} FROM construction_records
        WHERE organization_id = ?1 AND customer_id = ?2
        ORDER BY construction_date IS NULL DESC, construction_date DESC, created_at DESC
        LIMIT 500`,
    ).bind(auth.organizationId, customerId),
  ]);
  if (!customer?.results.length) throw new HttpError(404, "customer_not_found", "顧客が見つかりません");
  return json({ records: (list?.results as RecordRow[]).map(toRecord) });
}

export async function createRecord(
  customerId: string,
  request: Request,
  env: Env,
  auth: AuthContext,
): Promise<Response> {
  const parsed = recordCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, "validation_error", "入力内容を確認してください", fieldErrors(parsed.error));
  }
  await getCustomerOr404(env, auth, customerId);
  const d = parsed.data;
  const now = nowIso();
  const row: RecordRow = {
    id: crypto.randomUUID(),
    customer_id: customerId,
    title: d.title,
    construction_date: d.constructionDate,
    description: d.description,
    address: d.address,
    status: d.status,
    notes: d.notes,
    created_at: now,
    updated_at: now,
  };
  await env.DB.prepare(
    `INSERT INTO construction_records
       (id, organization_id, customer_id, title, construction_date, description, address, status, notes, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
  )
    .bind(
      row.id,
      auth.organizationId,
      customerId,
      row.title,
      row.construction_date,
      row.description,
      row.address,
      row.status,
      row.notes,
      now,
      now,
    )
    .run();
  return json({ record: toRecord(row) }, 201);
}

export async function getRecord(id: string, env: Env, auth: AuthContext): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT ${RECORD_COLUMNS} FROM construction_records WHERE id = ?1 AND organization_id = ?2`,
  )
    .bind(id, auth.organizationId)
    .first<RecordRow>();
  if (!row) throw new HttpError(404, "record_not_found", "工事履歴が見つかりません");
  return json({ record: toRecord(row) });
}

export async function updateRecord(id: string, request: Request, env: Env, auth: AuthContext): Promise<Response> {
  const parsed = recordUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, "validation_error", "入力内容を確認してください", fieldErrors(parsed.error));
  }
  const d = parsed.data;
  const row = await env.DB.prepare(
    `UPDATE construction_records
        SET title = ?1, construction_date = ?2, description = ?3, address = ?4, status = ?5, notes = ?6, updated_at = ?7
      WHERE id = ?8 AND organization_id = ?9
      RETURNING ${RECORD_COLUMNS}`,
  )
    .bind(d.title, d.constructionDate, d.description, d.address, d.status, d.notes, nowIso(), id, auth.organizationId)
    .first<RecordRow>();
  if (!row) throw new HttpError(404, "record_not_found", "工事履歴が見つかりません");
  return json({ record: toRecord(row) });
}
