// What a PATCH may carry. Every field is optional; null means "clear this field".
export interface ContactPatch {
    first_name?: string;
    last_name?: string;
    isStarred?: boolean;
    email?: string | null;
    phone?: string | null;
    tags?: string[];
}
