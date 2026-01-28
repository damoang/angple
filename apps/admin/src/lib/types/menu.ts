/**
 * 메뉴 관련 타입 정의
 */

export interface Menu {
    id: number;
    parent_id: number | null;
    title: string;
    url: string;
    icon?: string;
    shortcut?: string;
    description?: string;
    target: string;
    depth: number;
    order_num: number;
    view_level: number;
    show_in_header: boolean;
    show_in_sidebar: boolean;
    is_active: boolean;
    children?: Menu[];
}

export interface CreateMenuRequest {
    parent_id?: number | null;
    title: string;
    url: string;
    icon?: string;
    shortcut?: string;
    description?: string;
    target: string;
    show_in_header: boolean;
    show_in_sidebar: boolean;
    view_level: number;
    is_active: boolean;
}

export interface UpdateMenuRequest {
    parent_id?: number | null;
    title?: string;
    url?: string;
    icon?: string;
    shortcut?: string;
    description?: string;
    target?: string;
    show_in_header?: boolean;
    show_in_sidebar?: boolean;
    view_level?: number;
    is_active?: boolean;
}

export interface ReorderMenuItem {
    id: number;
    parent_id: number | null;
    order_num: number;
}

export interface ReorderMenusRequest {
    items: ReorderMenuItem[];
}

/**
 * 아이콘 목록 (Lucide 아이콘)
 */
export const MENU_ICONS = [
    'Home',
    'LayoutDashboard',
    'Users',
    'Settings',
    'FileText',
    'MessageSquare',
    'Bell',
    'Search',
    'Star',
    'Heart',
    'Bookmark',
    'Tag',
    'Folder',
    'Image',
    'Video',
    'Music',
    'Calendar',
    'Clock',
    'Map',
    'Mail',
    'Phone',
    'ShoppingCart',
    'CreditCard',
    'Gift',
    'Award',
    'Trophy',
    'Target',
    'Zap',
    'Flame',
    'Sparkles',
    'Sun',
    'Moon',
    'Cloud',
    'Umbrella',
    'Coffee',
    'Pizza',
    'Gamepad2',
    'Headphones',
    'Camera',
    'Monitor',
    'Smartphone',
    'Laptop',
    'Tablet',
    'Wifi',
    'Globe',
    'Link',
    'ExternalLink',
    'Download',
    'Upload',
    'Share2',
    'Send',
    'Inbox',
    'Archive',
    'Trash2',
    'Edit',
    'Pencil',
    'Brush',
    'Palette',
    'Layers',
    'Grid',
    'List',
    'LayoutGrid',
    'Menu',
    'MoreHorizontal',
    'MoreVertical',
    'Plus',
    'Minus',
    'X',
    'Check',
    'ChevronDown',
    'ChevronUp',
    'ChevronLeft',
    'ChevronRight',
    'ArrowDown',
    'ArrowUp',
    'ArrowLeft',
    'ArrowRight',
    'RefreshCw',
    'RotateCw',
    'Loader',
    'Info',
    'AlertCircle',
    'AlertTriangle',
    'HelpCircle',
    'XCircle',
    'CheckCircle',
    'Lock',
    'Unlock',
    'Key',
    'Shield',
    'Eye',
    'EyeOff',
    'User',
    'UserPlus',
    'UserMinus',
    'UserCheck',
    'UserX',
    'Newspaper',
    'BookOpen',
    'Book',
    'GraduationCap'
] as const;

export type MenuIcon = (typeof MENU_ICONS)[number];

/**
 * 플랫 메뉴 배열을 트리 구조로 변환
 */
export function buildMenuTree(menus: Menu[]): Menu[] {
    const menuMap = new Map<number, Menu>();
    const rootMenus: Menu[] = [];

    // 모든 메뉴를 Map에 등록
    for (const menu of menus) {
        menu.children = [];
        menuMap.set(menu.id, menu);
    }

    // 트리 구조 구축
    for (const menu of menus) {
        if (menu.parent_id === null) {
            rootMenus.push(menu);
        } else {
            const parent = menuMap.get(menu.parent_id);
            if (parent) {
                if (!parent.children) {
                    parent.children = [];
                }
                parent.children.push(menu);
            }
        }
    }

    return rootMenus;
}

/**
 * 트리 구조를 플랫 배열로 변환 (reorder용)
 */
export function flattenMenuTree(menus: Menu[], parentId: number | null = null): ReorderMenuItem[] {
    const result: ReorderMenuItem[] = [];

    menus.forEach((menu, index) => {
        result.push({
            id: menu.id,
            parent_id: parentId,
            order_num: index
        });

        if (menu.children && menu.children.length > 0) {
            result.push(...flattenMenuTree(menu.children, menu.id));
        }
    });

    return result;
}
