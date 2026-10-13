import { DatabaseSync } from "node:sqlite";       

const db = new DatabaseSync(":memory:");

export interface Contact {
    id: number;
    isStarred: boolean;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    tags?: string[];
}

export function initialize_database(): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isStarred BOOLEAN NOT NULL DEFAULT 0,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        tags TEXT   
        );
    `);
}

initialize_database();


function contactToParams(contact: Contact) {
  return {
    isStarred: contact.isStarred ? 1 : 0,
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email,
    phone: contact.phone ?? null,
    tags: contact.tags ? contact.tags.join(",") : null,
  };
}

const insertStmt = db.prepare(
  "INSERT INTO contacts (isStarred, first_name, last_name, email, phone, tags) VALUES (:isStarred, :first_name, :last_name, :email, :phone, :tags)"
);
export function insertContact(contact: Contact): number {
  const result = insertStmt.run(contactToParams(contact));
  return Number(result.lastInsertRowid);
}

const updateStmt = db.prepare(
  "UPDATE contacts SET isStarred = :isStarred, first_name = :first_name, last_name = :last_name, email = :email, phone = :phone, tags = :tags WHERE id = :id"
);
export function updateContact(id: number, contact: Contact): boolean {
  const result = updateStmt.run({ ...contactToParams(contact), id });
  return result.changes > 0;
}

const deleteStmt = db.prepare("DELETE FROM contacts WHERE id = ?");
export function deleteContact(id: number): boolean {
  const result = deleteStmt.run(id);
  return result.changes > 0;
}
