/**
 * Store Sections Types
 */

export interface StoreSection {
    id: string;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
