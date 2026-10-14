import { Contact } from "../db/contactStore";

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

export class ContactDto {
    private constructor(readonly contact: Contact) {}

    static fromRequest(body: any): ContactDto {
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
            throw new DtoError("Request body must be a JSON object", 400);
        }
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

        if (body.email != null) {   // `!= null` skips both "missing" and null
            if (typeof body.email !== "string" || !EMAIL.test(body.email.trim())) {
                throw new DtoError("Invalid email format", 400);
            }
            contact.email = body.email.trim().toLowerCase();   // lowercase: Ann@x.com and ann@x.com are one email
        }

        if (body.phone != null) {
            if (typeof body.phone !== "string" || !PHONE.test(body.phone.trim())) {
                throw new DtoError("Invalid phone number format", 400);
            }
            const phone = normalizePhone(body.phone);
            if (phone.replace("+", "").length < 7 || phone.replace("+", "").length > 15) {
                throw new DtoError("Invalid phone number format", 400);
            }
            contact.phone = phone;
        }

        if (body.isStarred !== undefined) {
            if (typeof body.isStarred !== "boolean") {
                throw new DtoError("isStarred must be true or false", 400);
            }
            contact.isStarred = body.isStarred;
        }

        if (body.tags != null) {
            if (!Array.isArray(body.tags)) throw new DtoError("tags must be a list of text", 400);
            const tags: string[] = [];
            for (const item of body.tags) {
                if (typeof item !== "string" || item.trim() === "" || item.includes(",")) {
                    throw new DtoError("Every tag must be non-empty text without commas", 400);
                }
                const tag = item.trim();
                if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);   // drop duplicates
            }
            contact.tags = tags;
        }

        return new ContactDto(contact);
    }

    toContact(): Contact {
        return this.contact;
    }
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