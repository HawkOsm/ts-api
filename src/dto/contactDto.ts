import { Contact } from "../db/contactStore";
import { sameTag } from "../domain/contact";
import type { ContactPatch, SortOption } from "../domain/contact";

export class DtoError extends Error {
    readonly statusCode: number;
    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "DtoError";
        this.statusCode = statusCode;
    }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9\s\-()]+$/;

// "+90 (555) 123-45 67" and "+905551234567" are the same number: keep only a leading "+" and the digits,
// so the database can detect a duplicate phone whatever the formatting
function normalizePhone(raw: string): string {
    const text = raw.trim();
    return (text.startsWith("+") ? "+" : "") + text.replace(/[^0-9]/g, "");
}

// ---------- small readers: each checks ONE field and returns a clean value, or throws a 400 ----------

function readEmail(value: unknown): string {
    if (typeof value !== "string" || !EMAIL.test(value.trim())) {
        throw new DtoError("Invalid email format", 400);
    }
    return value.trim().toLowerCase();   // lowercase: Ann@x.com and ann@x.com are one email
}

function readPhone(value: unknown): string {
    if (typeof value !== "string" || !PHONE.test(value.trim())) {
        throw new DtoError("Invalid phone number format", 400);
    }
    const phone = normalizePhone(value);
    if (phone.replace("+", "").length < 7 || phone.replace("+", "").length > 15) {
        throw new DtoError("Invalid phone number format", 400);
    }
    return phone;
}

function readFlag(value: unknown): boolean {
    if (typeof value !== "boolean") {
        throw new DtoError("isStarred must be true or false", 400);
    }
    return value;
}

// The one rule for a tag name, used for tags on contacts and for POST/DELETE /tags:
// text, not blank, no comma (a comma separates the tags inside a contact). Returns it trimmed, or null when invalid.
function cleanTag(value: unknown): string | null {
    if (typeof value !== "string" || value.trim() === "" || value.includes(",")) return null;
    return value.trim();
}

function readTags(value: unknown): string[] {
    if (!Array.isArray(value)) throw new DtoError("tags must be a list of text", 400);
    const tags: string[] = [];
    for (const item of value) {
        const tag = cleanTag(item);
        if (tag === null) throw new DtoError("Every tag must be non-empty text without commas", 400);
        if (!tags.some((t) => sameTag(t, tag))) tags.push(tag);   // drop duplicates
    }
    return tags;
}

// A request body must be a JSON object (not missing, a list, or a plain value)
function asObject(body: unknown): Record<string, any> {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new DtoError("Request body must be a JSON object", 400);
    }
    return body as Record<string, any>;
}

function readName(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim() === "") {
        throw new DtoError(`${field} must be non-empty text`, 400);
    }
    return value.trim();
}

export class ContactDto {
    private constructor(readonly contact: Contact) {}

    static fromRequest(raw: unknown): ContactDto {
        const body = asObject(raw);
        if (typeof body.first_name !== "string" || body.first_name.trim() === ""
            || typeof body.last_name !== "string" || body.last_name.trim() === "") {
            throw new DtoError("First name and last name are required", 400);
        }

        // the id and hasPicture are decided by the server, never by the client
        const contact: Contact = {
            id: 0,
            hasPicture: false,
            isStarred: false,
            first_name: body.first_name.trim(),
            last_name: body.last_name.trim(),
        };

        if (body.email != null) contact.email = readEmail(body.email);   // `!= null` skips both "missing" and null
        if (body.phone != null) contact.phone = readPhone(body.phone);
        if (body.isStarred !== undefined) contact.isStarred = readFlag(body.isStarred);
        if (body.tags != null) contact.tags = readTags(body.tags);

        return new ContactDto(contact);
    }

    toContact(): Contact {
        return this.contact;
    }
}

// PATCH: any subset of the fields, at least one. null clears email or phone (and empties the tags).
export class ContactPatchDto {
    private constructor(readonly patch: ContactPatch) {}

    static fromRequest(raw: unknown): ContactPatchDto {
        const body = asObject(raw);
        const patch: ContactPatch = {};
        if (body.first_name !== undefined) patch.first_name = readName(body.first_name, "first_name");
        if (body.last_name !== undefined) patch.last_name = readName(body.last_name, "last_name");
        if (body.isStarred !== undefined) patch.isStarred = readFlag(body.isStarred);
        if (body.email !== undefined) patch.email = body.email === null ? null : readEmail(body.email);
        if (body.phone !== undefined) patch.phone = body.phone === null ? null : readPhone(body.phone);
        if (body.tags !== undefined) patch.tags = body.tags === null ? [] : readTags(body.tags);

        if (Object.keys(patch).length === 0) {   // unknown fields (id, hasPicture...) are ignored, so they count as nothing
            throw new DtoError("Send at least one field to update", 400);
        }
        return new ContactPatchDto(patch);
    }

    toPatch(): ContactPatch {
        return this.patch;
    }
}

const SORTS: readonly SortOption[] = ["name", "name_desc", "tags"];

// ?by=... of GET /contacts/sort: required, and one of the allowed words (a repeated "by" arrives as a list, so it is rejected)
export function parseSortBy(raw: unknown): SortOption {
    if (typeof raw !== "string" || !SORTS.includes(raw as SortOption)) {
        throw new DtoError(`Query parameter 'by' is required and must be one of: ${SORTS.join(", ")}`, 400);
    }
    return raw as SortOption;
}

// A tag name, from a request body or from the URL: text, not blank, no comma (a comma separates the tags inside a contact)
export function parseTagName(raw: unknown): string {
    const name = cleanTag(raw);
    if (name === null) throw new DtoError("Tag name must be non-empty text without commas", 400);
    return name;
}

// the body of POST /tags: { "name": "Gym" }
export function parseTagBody(body: unknown): string {
    return parseTagName(asObject(body).name);
}

// ?search=... of GET /tags: optional text; empty means "no filter"
export function parseTagSearch(raw: unknown): string | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw !== "string") throw new DtoError("Query parameter 'search' must be text", 400);
    return raw.trim() === "" ? undefined : raw.trim();
}

// ?keyword=... of GET /contacts/search: required, text, not blank (a repeated keyword arrives as a list, so it is rejected)
export function parseKeyword(raw: unknown): string {
    if (typeof raw !== "string" || raw.trim() === "") {
        throw new DtoError("Query parameter 'keyword' is required", 400);
    }
    return raw.trim();
}

// "1" and "42" are ids; "abc", "1.5", "1abc", "-3", "0" and absurdly large numbers are not
export function parseId(raw: unknown): number {
    if (typeof raw !== "string" || !/^[1-9][0-9]*$/.test(raw)) {
        throw new DtoError("Id must be a positive whole number", 400);
    }
    const id = Number(raw);
    if (!Number.isSafeInteger(id)) {
        throw new DtoError("Id must be a positive whole number", 400);
    }
    return id;
}