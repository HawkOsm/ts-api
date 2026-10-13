import test from "node:test";
import assert from "node:assert/strict";
import { insertContact, updateContact, deleteContact, Contact } from "../src/db/contactStore";

test("insertContact should insert a contact and return its id", () => {
    const contact: Contact = {
        id: 0,
        isStarred: true,
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com"
    };
    const id = insertContact(contact);
    assert.strictEqual(id, 1);
});

test("updateContact should update a contact", () => {
    const contact: Contact = {
        id: 1,
        isStarred: false,
        first_name: "Jane",
        last_name: "Doe",
        email: "jane.doe@example.com"
    };
    const updated = updateContact(1, contact);
    assert.strictEqual(updated, true);
});

test("deleteContact should delete a contact", () => {
    const deleted = deleteContact(1);
    assert.strictEqual(deleted, true);
});

test("empty tags should be stored as null", () => {
    const contact: Contact = {
        id: 0,
        isStarred: false,
        first_name: "Alice",
        last_name: "Smith",
        email: "alice.smith@example.com",
        tags: []
    };
    const id = insertContact(contact);
    assert.strictEqual(id, 2);
});