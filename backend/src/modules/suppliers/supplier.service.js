import db from "../../db/db.js";

export async function getSuppliers() {
  const result = await db.query("SELECT * FROM tbl_suppliers ORDER BY supplier_id");
  return result.rows;
}

export async function createSupplier(payload) {
  const { supplier_name, email_address, address } = payload;

  const result = await db.query(
    `INSERT INTO tbl_suppliers
     (supplier_name, email_address, address)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [supplier_name, email_address, address]
  );

  return result.rows[0];
}

export async function updateSupplier(id, payload) {
  const { supplier_name, email_address, address } = payload;

  const result = await db.query(
    `UPDATE tbl_suppliers
     SET supplier_name = $1,
         email_address = $2,
         address = $3,
         updated_at = now()
     WHERE supplier_id = $4
     RETURNING *`,
    [supplier_name, email_address, address, id]
  );

  return result.rows[0];
}

export async function deleteSupplier(id) {
  await db.query("DELETE FROM tbl_suppliers WHERE supplier_id = $1", [id]);
}
