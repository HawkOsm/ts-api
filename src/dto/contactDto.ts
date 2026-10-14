import { Contact } from "../db/contactStore";

export class DtoError extends Error {
    readonly statusCode: number;
    constructor(message: string, statusCode: number) {
        super(message);
        this.name = "DtoError";
        this.statusCode = statusCode;
    }
}

export class ContactDto {
    private constructor(readonly first_name: string, readonly last_name: string, readonly email?: string, readonly phone?: string) {}

    static fromRequest(body: any): ContactDto {
        if (!body.first_name || !body.last_name) {
            throw new DtoError("First name and last name are required", 400);
        }
        if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            throw new DtoError("Invalid email format", 400);
        }
        if (body.phone && !/^\+?[0-9\s\-()]+$/.test(body.phone)) {
            throw new DtoError("Invalid phone number format", 400);
        }
        return new ContactDto(body.first_name, body.last_name, body.email, body.phone);
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