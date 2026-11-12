import type { AuthContext } from "./auth";
import { HttpError, fieldErrors, json, nowIso, readJson } from "./http";
import { formatPhoneForDisplay, normalizePhone } from "./phone";
import { customerCreateSchema, customerUpdateSchema, phoneSearchSchema } from "./schemas";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  phone_normalized: string;
  address: string | null;
  created_at: string;
  updated_at: string;
};

const CUSTOMER_COLUMNS = `id, name, phone, phone_normalized, address, created_at, updated_at`;

export function toCustomer(r: CustomerRow) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    phoneNormalized: r.phone_normalized,
    address: r.address,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function findByPhone(env: Env, orgId: string, normalized: string, excludeId?: string) {
  const { results } = await env.DB.prepare(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers
      WHERE organization_id = ?1 AND phone_normalized = ?2 AND id != ?3
      ORDER BY updated_at DESC LIMIT 20`,
  )
    .bind(orgId, normalized, excludeId ?? "")
    .all<CustomerRow>();
  return results;
}

/** 顧客を取得（他社の顧客は存在しない扱いで 404） */
export async function getCustomerOr404(env: Env, auth: AuthContext, id: string): Promise<CustomerRow> {
  const row = await env.DB.prepare(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ?1 AND organization_id = ?2`)
    .bind(id, auth.organizationId)
    .first<CustomerRow>();
  if (!row) throw new HttpError(404, "customer_not_found", "顧客が見つかりません");
  return row;
}

export async function searchCustomers(url: URL, env: Env, auth: AuthContext): Promise<Response> {
  const parsed = phoneSearchSchema.safeParse({ phone: url.searchParams.get("phone") ?? "" });
  if (!parsed.success) {
    throw new HttpError(400, "validation_error", "電話番号の形式が正しくありません", fieldErrors(parsed.error));
  }
  const normalized = normalizePhone(parsed.data.phone);
  const rows = await findByPhone(env, auth.organizationId, normalized);
  return json({ customers: rows.map(toCustomer) });
}

export async function createCustomer(request: Request, env: Env, auth: AuthContext): Promise<Response> {
  const parsed = customerCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, "validation_error", "入力内容を確認してください", fieldErrors(parsed.error));
  }
  const { name, phone, address, allowDuplicate } = parsed.data;
  const normalized = normalizePhone(phone);

  if (!allowDuplicate) {
    const dupes = await findByPhone(env, auth.organizationId, normalized);
    if (dupes.length > 0) {
      throw new HttpError(409, "duplicate_phone", "この電話番号の顧客はすでに登録されています", {
        customers: dupes.map(toCustomer),
      });
    }
  }

  const now = nowIso();
  const row: CustomerRow = {
    id: crypto.randomUUID(),
    name,
    phone: formatPhoneForDisplay(phone, normalized),
    phone_normalized: normalized,
    address,
    created_at: now,
    updated_at: now,
  };
  await env.DB.prepare(
    `INSERT INTO customers (id, organization_id, name, phone, phone_normalized, address, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(row.id, auth.organizationId, row.name, row.phone, row.phone_normalized, row.address, now, now)
    .run();
  return json({ customer: toCustomer(row) }, 201);
}

export async function getCustomer(id: string, env: Env, auth: AuthContext): Promise<Response> {
  return json({ customer: toCustomer(await getCustomerOr404(env, auth, id)) });
}

export async function updateCustomer(id: string, request: Request, env: Env, auth: AuthContext): Promise<Response> {
  const parsed = customerUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, "validation_error", "入力内容を確認してください", fieldErrors(parsed.error));
  }
  const current = await getCustomerOr404(env, auth, id);
  const { name, phone, address, allowDuplicate } = parsed.data;
  const normalized = normalizePhone(phone);

  if (normalized !== current.phone_normalized && !allowDuplicate) {
    const dupes = await findByPhone(env, auth.organizationId, normalized, id);
    if (dupes.length > 0) {
      throw new HttpError(409, "duplicate_phone", "この電話番号は別の顧客で登録されています", {
        customers: dupes.map(toCustomer),
      });
    }
  }

  const display = formatPhoneForDisplay(phone, normalized);
  const now = nowIso();
  const updated = await env.DB.prepare(
    `UPDATE customers SET name = ?1, phone = ?2, phone_normalized = ?3, address = ?4, updated_at = ?5
      WHERE id = ?6 AND organization_id = ?7
      RETURNING ${CUSTOMER_COLUMNS}`,
  )
    .bind(name, display, normalized, address, now, id, auth.organizationId)
    .first<CustomerRow>();
  if (!updated) throw new HttpError(404, "customer_not_found", "顧客が見つかりません");
  return json({ customer: toCustomer(updated) });
}
