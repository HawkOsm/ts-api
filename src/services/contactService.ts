import { insertContact, getContactById, updateContact, deleteContact, Contact,getPicture,setPicture,removePicture } from "../db/contactStore";
// Export the database class
export class ContactService {
  get(id: number): Contact | null { return getContactById(id); }

  create(contact: Contact): Contact {
    const id = insertContact(contact);
    return getContactById(id) || contact;
  }
  
  update(id: number, contact: Contact): Contact | null { 
    return updateContact(id, contact) ? getContactById(id) : null; 
  }

  delete(id: number): Contact | null { 
    const contact = getContactById(id);
    if (!contact) return null;
    try {
      deleteContact(id);
    }
    catch (error) {
      console.error(`Error deleting contact with id ${id}:`, error);
      return contact; // Return the contact even if deletion failed
    }
    return null; // Return null to indicate successful deletion
  }
  setPicture(id: number, bytes: Uint8Array, type: string): boolean { return setPicture(id, bytes, type); }
  getPicture(id: number) { return getPicture(id); }
  removePicture(id: number): boolean { return removePicture(id); }
}
