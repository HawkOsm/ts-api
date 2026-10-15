// How GET /contacts/sort can order the contacts: by name A to Z, by name Z to A, or by tag
export type SortOption = "name" | "name_desc" | "tags";

// A known tag, and how many contacts currently have it
export interface TagInfo {
    name: string;
    contactCount: number;
}

// What a PATCH may carry. Every field is optional; null means "clear this field".
export interface ContactPatch {
    first_name?: string;
    last_name?: string;
    isStarred?: boolean;
    email?: string | null;
    phone?: string | null;
    tags?: string[];
}
