/**
 * 이모티콘 플러그인 타입 정의
 */

export interface EmoticonPack {
    id: number;
    slug: string;
    name: string;
    default_width: number;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface EmoticonItem {
    id: number;
    pack_id: number;
    filename: string;
    thumb_path: string;
    mime_type: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface EmoticonParseResult {
    filename: string;
    width: number;
}
