import { insertContact, getContactById, updateContact, deleteContact, Contact,getPicture,setPicture,removePicture } from "../db/contactStore";
import { DtoError } from "../dto/contactDto";

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

  update(id: number, contact: Contact): Contact | null {
    try {
      return updateContact(id, contact) ? getContactById(id) : null;
    } catch (error) {
      return rethrowAsConflict(error);
    }
  }

  delete(id: number): number | null { 
    const contact = getContactById(id);
    if (!contact) return null;
    try {
      deleteContact(id);
    }
    catch (error) {
      console.error(`Error deleting contact with id ${id}:`, error);
      return null; // Return null to indicate failed deletion
    }
    return id; // Return the ID to indicate successful deletion
  }
  setPicture(id: number, bytes: Uint8Array, type: string): boolean { return setPicture(id, bytes, type); }
  getPicture(id: number) { return getPicture(id); }
  removePicture(id: number): boolean { return removePicture(id); }
}
