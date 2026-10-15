import { insertContact, getContactById, updateContact, deleteContact, listContacts, Contact,getPicture,setPicture,removePicture, insertTag, listTags, deleteTag, countContacts, inTransaction } from "../db/contactStore";
import { DtoError } from "../dto/contactDto";
import { sameTag, tagKey } from "../domain/contact";
import type { ContactPatch, SortOption, TagInfo } from "../domain/contact";

// The data lives in memory on a small free plan and the API is public, so its size is capped.
const MAX_CONTACTS = 300;
const MAX_TAGS = 200;

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
    // Phones are stored without spaces, dashes or brackets ("+905551234567"), so the keyword is cleaned the same way
    const phoneTerm = term.replace(/[\s\-()]/g, "");
    return listContacts().filter((c) =>
      [c.first_name, c.last_name, `${c.first_name} ${c.last_name}`, c.email ?? "", ...(c.tags ?? [])]
        .some((text) => text.toLowerCase().includes(term))
      || (phoneTerm !== "" && (c.phone ?? "").includes(phoneTerm)));
  }

  // A tag typed with a different capitalization than a known tag takes the known spelling ("work" -> "Work").
  private useKnownTags(contact: Contact): Contact {
    if (!contact.tags) return contact;
    const known = listTags();
    return { ...contact, tags: contact.tags.map((tag) => known.find((k) => sameTag(k, tag)) ?? tag) };
  }

  // Adds a tag to the list of known tags. true = added, false = it was already known. Too many tags is a 409.
  private registerTag(name: string): boolean {
    const known = listTags();
    if (known.some((k) => sameTag(k, name))) return false;
    if (known.length >= MAX_TAGS) throw new DtoError(`Too many tags (at most ${MAX_TAGS}); delete one first`, 409);
    return insertTag(name);
  }

  // After a contact was saved, every new tag on it joins the list of known tags.
  private rememberTags(contact: Contact): void {
    for (const tag of contact.tags ?? []) this.registerTag(tag);
  }

  // The contact and its new tags are saved together: if one part fails, nothing is saved.
  create(contact: Contact): Contact {
    if (countContacts() >= MAX_CONTACTS) {
      throw new DtoError(`The address book is full (at most ${MAX_CONTACTS} contacts); delete one first`, 409);
    }
    const toSave = this.useKnownTags(contact);
    try {
      return inTransaction(() => {
        const id = insertContact(toSave);
        this.rememberTags(toSave);
        return getContactById(id)!;
      });
    } catch (error) {
      return rethrowAsConflict(error);
    }
  }

  replace(id: number, contact: Contact): Contact | null {
    const toSave = this.useKnownTags(contact);
    try {
      return inTransaction(() => {
        if (!updateContact(id, toSave)) return null;
        this.rememberTags(toSave);
        return getContactById(id);
      });
    } catch (error) {
      return rethrowAsConflict(error);
    }
  }

  // ---------- tags ----------

  // Every known tag with the number of contacts that use it. `search` keeps only the tags that contain that text.
  getTags(search?: string): TagInfo[] {
    const term = search?.trim().toLowerCase();
    const counts = new Map<string, number>();   // one pass over the contacts: tag key -> number of contacts
    for (const c of listContacts()) {
      for (const key of new Set((c.tags ?? []).map(tagKey))) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return listTags()
      .filter((name) => !term || name.toLowerCase().includes(term))
      .map((name) => ({ name, contactCount: counts.get(tagKey(name)) ?? 0 }));
  }

  // Adds a tag to the list of known tags. A tag that already exists (ignoring case) is a 409.
  addTag(name: string): TagInfo {
    if (!this.registerTag(name)) throw new DtoError("This tag already exists", 409);
    return { name, contactCount: 0 };
  }

  // Removes the tag from the list AND from every contact that has it, as one unit. false = there was no such tag.
  removeTag(name: string): boolean {
    return inTransaction(() => {
      if (!deleteTag(name)) return false;
      for (const c of listContacts()) {
        if (c.tags?.some((t) => sameTag(t, name))) {
          updateContact(c.id, { ...c, tags: c.tags.filter((t) => !sameTag(t, name)) });
        }
      }
      return true;
    });
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
