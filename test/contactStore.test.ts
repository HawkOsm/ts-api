import test from "node:test";
import assert from "node:assert/strict";
import { insertContact, updateContact, deleteContact, Contact, getContactById, listContacts, setPicture, getPicture, removePicture } from "../src/db/contactStore";
import { readFileSync } from "node:fs";

let counter = 0;
function newContact(name: string): Contact {
    counter++;
    return {
        id: counter,
        isStarred: false,
        first_name: name,
        last_name: "Test",
        email: `${name.toLowerCase()}@example.com`,
        hasPicture: false
    };
}


test("updateContact should update a contact", () => {
    const id = insertContact(newContact("Alice"));
    const updated = updateContact(id, { ...getContactById(id)!, first_name: "Alice", last_name: "Smith" });
    assert.equal(getContactById(id)?.last_name, "Smith");
});

test("deleteContact should delete a contact", () => {
    const id = insertContact(newContact("Bob"));
    const deleted = deleteContact(id);
    assert.strictEqual(deleted, true);
    assert.strictEqual(getContactById(id), null);
});

test("pictures should be stored and retrieved correctly", () => {
    const original = readFileSync("test/fixtures/images.jpg");
    const id = insertContact({
        id: 0,
        isStarred: false,
        first_name: "Eve",
        last_name: "Adams",
        email: "eve.adams@example.com",
        hasPicture: false
    });
    assert.strictEqual(getContactById(id)?.hasPicture, false);
    assert.strictEqual(getPicture(id), null);

    assert.strictEqual(setPicture(id, original, "image/jpeg"), true);

    assert.strictEqual(getContactById(id)?.hasPicture, true);
    const stored = getPicture(id);
    assert.strictEqual(stored?.type, "image/jpeg");
    assert.deepStrictEqual(Buffer.from(stored!.bytes), original);
});

test("updateContact should keep the contact's picture", () => {
    const original = readFileSync("test/fixtures/images.jpg");
    const contact: Contact = {
        id: 0,
        isStarred: false,
        first_name: "Frank",
        last_name: "Miller",
        email: "frank.miller@example.com",
        hasPicture: false
    };
    const id = insertContact(contact);
    setPicture(id, original, "image/jpeg");

    // edit the text fields only
    const updated = updateContact(id, { ...contact, id, first_name: "Franklin", isStarred: true });
    assert.strictEqual(updated, true);

    assert.strictEqual(getContactById(id)?.first_name, "Franklin");
    assert.strictEqual(getContactById(id)?.hasPicture, true);
    const stored = getPicture(id);
    assert.strictEqual(stored?.type, "image/jpeg");
    assert.deepStrictEqual(Buffer.from(stored!.bytes), original);
});

test("removePicture should clear the picture but keep the contact", () => {
    const original = readFileSync("test/fixtures/images.jpg");
    const id = insertContact({
        id: 0,
        isStarred: false,
        first_name: "Grace",
        last_name: "Hopper",
        email: "grace.hopper@example.com",
        hasPicture: false
    });
    setPicture(id, original, "image/jpeg");

    assert.strictEqual(removePicture(id), true);

    assert.strictEqual(getPicture(id), null);
    assert.strictEqual(getContactById(id)?.hasPicture, false);
    assert.strictEqual(getContactById(id)?.first_name, "Grace");
    // nothing left to remove
    assert.strictEqual(removePicture(id), false);
});

test("getContactById should return a contact with tags", () => {
    const id = insertContact({
        id: 0,
        isStarred: true,
        first_name: "Alice",
        last_name: "Smith",
        email: "alice.smith@example.com",
        tags: ["work", "family"],
        hasPicture: false
    });
    const contact = getContactById(id);

    assert.strictEqual(contact?.first_name, "Alice");
    assert.strictEqual(contact?.last_name, "Smith");
    assert.strictEqual(contact?.email, "alice.smith@example.com");
    assert.strictEqual(contact?.isStarred, true);
    assert.deepStrictEqual(contact?.tags, ["work", "family"]);
});

test("listContacts should return contacts with empty tags", () => {
    const id = insertContact({
        id: 0,
        isStarred: false,
        first_name: "Bob",
        last_name: "Jones",
        email: "bob.jones@example.com",
        tags: [],
        hasPicture: false
    });
    // check our own contact, not the total: other tests also add contacts
    const listed = listContacts().find((c) => c.id === id);
    assert.strictEqual(listed?.first_name, "Bob");
    assert.deepStrictEqual(listed?.tags, []);

    const contact = getContactById(id);
    assert.strictEqual(contact?.first_name, "Bob");
    assert.deepStrictEqual(contact?.tags, []);
});

test("getContactById should return null for a missing id", () => {
    const insertedId = insertContact({
        id: 0,
        isStarred: false,
        first_name: "Carol",
        last_name: "Brown",
        email: "carol.brown@example.com",
        hasPicture: false
    });

    const contact = getContactById(insertedId + 1);
    assert.strictEqual(contact, null);
});