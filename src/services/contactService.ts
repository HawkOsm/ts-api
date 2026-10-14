import { insertContact, getContactById, updateContact, deleteContact, Contact,getPicture,setPicture,removePicture } from "../db/contactStore";
import { DtoError } from "../dto/contactDto";
import type { ContactPatch } from "../domain/contact";

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

export class ContactService {
  get(id: number): Contact | null { return getContactById(id); }

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
