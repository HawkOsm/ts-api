import { DatabaseSync } from "node:sqlite";
import { tagKey } from "../domain/contact";

const db = new DatabaseSync(":memory:");

export interface Contact {
    id: number;
    isStarred: boolean;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    tags?: string[];
  hasPicture: boolean;
}

export function initialize_database(): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isStarred BOOLEAN NOT NULL DEFAULT 0,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT UNIQUE,
        tags TEXT,
        picture BLOB,
        picture_type TEXT
        );

        -- the list of known tags; key is tagKey(name), so the database and the code agree on "same tag"
        CREATE TABLE IF NOT EXISTS tags (
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
        );
    `);
}

initialize_database();

function contactToParams(contact: Contact) {
  return {
    isStarred: contact.isStarred ? 1 : 0,
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    tags: contact.tags ? contact.tags.join(",") : null
  };
}


function paramsToContact(params: any): Contact {
  return {
    id: Number(params.id),
    isStarred: !!params.isStarred,
    first_name: String(params.first_name),
    last_name: String(params.last_name),
    hasPicture: !!params.has_picture,
    ...(params.email ? { email: String(params.email) } : {}),
    ...(typeof params.phone === "string" ? { phone: params.phone } : {}),
    ...(typeof params.tags === "string" ? { tags: params.tags.split(",").filter(Boolean) } : {})
  };
}

const insertStmt = db.prepare(
  "INSERT INTO contacts (isStarred, first_name, last_name, email, phone, tags) VALUES (:isStarred, :first_name, :last_name, :email, :phone, :tags)"
);
const updateStmt = db.prepare(
  "UPDATE contacts SET isStarred = :isStarred, first_name = :first_name, last_name = :last_name, email = :email, phone = :phone, tags = :tags WHERE id = :id"
);
const contactColumns =
  "id, isStarred, first_name, last_name, email, phone, tags, picture IS NOT NULL AS has_picture";
const setPictureStmt = db.prepare(
  "UPDATE contacts SET picture = :picture, picture_type = :type WHERE id = :id"
);
const getPictureStmt = db.prepare(
  "SELECT picture, picture_type FROM contacts WHERE id = :id"
);
const removePictureStmt = db.prepare(
  "UPDATE contacts SET picture = NULL, picture_type = NULL WHERE id = :id AND picture IS NOT NULL"
);
const selectStmt = db.prepare(`SELECT ${contactColumns} FROM contacts WHERE id = :id`);

// CRUD operations
export function insertContact(contact: Contact): number {
  const result = insertStmt.run(contactToParams(contact));
  return Number(result.lastInsertRowid);
}

export function updateContact(id: number, contact: Contact): boolean {
  const result = updateStmt.run({ ...contactToParams(contact), id });
  return result.changes > 0;
}

const deleteStmt = db.prepare("DELETE FROM contacts WHERE id = :id");
export function deleteContact(id: number): boolean {
  const result = deleteStmt.run({ id });
  return result.changes > 0;
}

export function getContactById(id: number): Contact | null {
  const row = selectStmt.get({ id });
  if (!row) return null;
  return paramsToContact(row);
}

// ORDER BY id makes "oldest first" a guarantee; without it SQLite does not promise any order
const selectAllStmt = db.prepare(`SELECT ${contactColumns} FROM contacts ORDER BY id`);
export function listContacts(): Contact[] {
  const rows = selectAllStmt.all();
  return rows.map((row): Contact => (paramsToContact(row)));
}

export function setPicture(id: number, bytes: Uint8Array, type: string): boolean {
  return setPictureStmt.run({ picture: bytes, type, id }).changes > 0;
}

export function getPicture(id: number): { bytes: Uint8Array; type: string } | null {
  const row = getPictureStmt.get({ id });
  if (!row || !(row.picture instanceof Uint8Array)) return null;
  return { bytes: row.picture, type: String(row.picture_type) };
}

export function removePicture(id: number): boolean {
  return removePictureStmt.run({ id }).changes > 0;
}

// ---------- the list of known tags ----------

// true = the tag was added, false = the same tag (see tagKey) already existed
const insertTagStmt = db.prepare("INSERT INTO tags (key, name) VALUES (:key, :name) ON CONFLICT(key) DO NOTHING");
export function insertTag(name: string): boolean {
  return insertTagStmt.run({ key: tagKey(name), name }).changes > 0;
}

const listTagsStmt = db.prepare("SELECT name FROM tags ORDER BY key");
export function listTags(): string[] {
  return listTagsStmt.all().map((row) => String(row.name));
}

// true = deleted, false = no such tag
const deleteTagStmt = db.prepare("DELETE FROM tags WHERE key = :key");
export function deleteTag(name: string): boolean {
  return deleteTagStmt.run({ key: tagKey(name) }).changes > 0;
}

// ---------- helpers for the service ----------

const countContactsStmt = db.prepare("SELECT COUNT(*) AS n FROM contacts");
export function countContacts(): number {
  return Number(countContactsStmt.get()?.n ?? 0);
}

// Runs `work` as one unit: if it throws, every change it made is undone (do not nest calls).
export function inTransaction<T>(work: () => T): T {
  db.exec("BEGIN");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}