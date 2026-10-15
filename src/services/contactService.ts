import { insertContact, getContactById, updateContact, deleteContact, listContacts, Contact,getPicture,setPicture,removePicture } from "../db/contactStore";
import { DtoError } from "../dto/contactDto";
import type { ContactPatch, SortOption } from "../domain/contact";

// A duplicate email or phone makes SQLite throw "UNIQUE constraint failed: contacts.email" (or .phone).
// Returns which field clashed ("email" or "phone"), or null when the error is something else.
function duplicateField(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const match = /UNIQUE constraint failed: contacts\.(\w+)/.exec(error.message);
  return match?.[1] ?? null;
}

function rethrowAsConflict(error: unknown): never {
  const field = duplicateField(error);
  if (field) throw new DtoError(`A contact with this ${field} already exists`, 409);
  throw error;   // anything else is a real bug: let the error handler answer 500
}

// compares text for sorting, ignoring upper/lower case: "alan" and "Alan" count as the same word.
// "en" is fixed on purpose, so the order does not depend on the language setting of the server.
function compareText(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

// first name, then last name
function byName(a: Contact, b: Contact): number {
  return compareText(a.first_name, b.first_name) || compareText(a.last_name, b.last_name);
}

// the alphabetically first tag of a contact, or null when it has no tags
function firstTag(c: Contact): string | null {
  const sorted = [...(c.tags ?? [])].sort(compareText);
  return sorted[0] ?? null;
}

export class ContactService {
  get(id: number): Contact | null { return getContactById(id); }

  // Every contact in the chosen order. With "tags", contacts are ordered by their first tag,
  // contacts without tags come last, and contacts with the same tag are ordered by name.
  listSorted(by: SortOption): Contact[] {
    const contacts = [...listContacts()];   // a copy: sort() would otherwise reorder the original array
    if (by === "name") return contacts.sort(byName);
    if (by === "name_desc") return contacts.sort((a, b) => byName(b, a));
    return contacts.sort((a, b) => {
      const tagA = firstTag(a);
      const tagB = firstTag(b);
      if (tagA === null && tagB === null) return byName(a, b);
      if (tagA === null) return 1;
      if (tagB === null) return -1;
      return compareText(tagA, tagB) || byName(a, b);
    });
  }

  // Every contact, oldest first. It carries hasPicture but never the picture bytes.
  list(): Contact[] { return listContacts(); }

  // Contacts whose name, email, phone or a tag contains the keyword, ignoring case.
  // Done in code and not with SQL LIKE, so a "%" or "_" typed by the user is just a character.
  search(keyword: string): Contact[] {
    const term = keyword.trim().toLowerCase();
    return listContacts().filter((c) =>
      [c.first_name, c.last_name, `${c.first_name} ${c.last_name}`, c.email ?? "", c.phone ?? "", ...(c.tags ?? [])]
        .some((text) => text.toLowerCase().includes(term)));
  }

  create(contact: Contact): Contact {
    try {
      const id = insertContact(contact);
      return getContactById(id)!;
    } catch (error) {
      return rethrowAsConflict(error);
    }
  }

  replace(id: number, contact: Contact): Contact | null {
    try {
      return updateContact(id, contact) ? getContactById(id) : null;
    } catch (error) {
      return rethrowAsConflict(error);
    }
  }

  // PATCH: change only the fields in `patch`. Returns null when there is no such contact.
  update(id: number, patch: ContactPatch): Contact | null {
    const existing = getContactById(id);
    if (!existing) return null;

    const merged: Contact = {
      id,
      hasPicture: existing.hasPicture,
      isStarred: patch.isStarred ?? existing.isStarred,
      first_name: patch.first_name ?? existing.first_name,
      last_name: patch.last_name ?? existing.last_name,
    };
    const email = patch.email === undefined ? existing.email : patch.email;   // null clears it
    const phone = patch.phone === undefined ? existing.phone : patch.phone;
    const tags = patch.tags ?? existing.tags;
    if (email != null) merged.email = email;
    if (phone != null) merged.phone = phone;
    if (tags !== undefined) merged.tags = tags;

    return this.replace(id, merged);
  }

  // true = deleted, false = there was no such contact. A real database error is not caught here:
  // it reaches the error handler and becomes a 500, instead of being reported as "not found".
  delete(id: number): boolean {
    return deleteContact(id);
  }
  setPicture(id: number, bytes: Uint8Array, type: string): boolean { return setPicture(id, bytes, type); }
  getPicture(id: number) { return getPicture(id); }
  removePicture(id: number): boolean { return removePicture(id); }
}
