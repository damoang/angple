/**
 * 공유 Lucide 아이콘 맵
 *
 * sidebar.svelte, header.svelte, admin menu 컴포넌트에서 재사용합니다.
 * 아이콘 이름(string) → Svelte 컴포넌트 매핑
 */

import MessageSquare from '@lucide/svelte/icons/message-square';
import Users from '@lucide/svelte/icons/users';
import CircleStar from '@lucide/svelte/icons/circle-star';
import CircleHelp from '@lucide/svelte/icons/circle-help';
import Images from '@lucide/svelte/icons/images';
import Newspaper from '@lucide/svelte/icons/newspaper';
import PenTool from '@lucide/svelte/icons/pen-tool';
import Lightbulb from '@lucide/svelte/icons/lightbulb';
import FolderOpen from '@lucide/svelte/icons/folder-open';
import Gift from '@lucide/svelte/icons/gift';
import MapPin from '@lucide/svelte/icons/map-pin';
import Star from '@lucide/svelte/icons/star';
import TrendingUp from '@lucide/svelte/icons/trending-up';
import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
import Package from '@lucide/svelte/icons/package';
import Megaphone from '@lucide/svelte/icons/megaphone';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Coffee from '@lucide/svelte/icons/coffee';
import UserCheck from '@lucide/svelte/icons/user-check';
import Music from '@lucide/svelte/icons/music';
import Info from '@lucide/svelte/icons/info';
import HelpCircle from '@lucide/svelte/icons/help-circle';
import BookText from '@lucide/svelte/icons/book-text';
import Circle from '@lucide/svelte/icons/circle';
import Cpu from '@lucide/svelte/icons/cpu';
import Code from '@lucide/svelte/icons/code';
import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
import BookOpen from '@lucide/svelte/icons/book-open';
import Apple from '@lucide/svelte/icons/apple';
import Home from '@lucide/svelte/icons/home';
import Rss from '@lucide/svelte/icons/rss';
import Shield from '@lucide/svelte/icons/shield';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import Settings from '@lucide/svelte/icons/settings';
import FileText from '@lucide/svelte/icons/file-text';
import Bell from '@lucide/svelte/icons/bell';
import Search from '@lucide/svelte/icons/search';
import Heart from '@lucide/svelte/icons/heart';
import Bookmark from '@lucide/svelte/icons/bookmark';
import Tag from '@lucide/svelte/icons/tag';
import Folder from '@lucide/svelte/icons/folder';
import Image from '@lucide/svelte/icons/image';
import Video from '@lucide/svelte/icons/video';
import Calendar from '@lucide/svelte/icons/calendar';
import Clock from '@lucide/svelte/icons/clock';
import MapIcon from '@lucide/svelte/icons/map';
import Mail from '@lucide/svelte/icons/mail';
import Phone from '@lucide/svelte/icons/phone';
import CreditCard from '@lucide/svelte/icons/credit-card';
import Award from '@lucide/svelte/icons/award';
import Trophy from '@lucide/svelte/icons/trophy';
import Target from '@lucide/svelte/icons/target';
import Zap from '@lucide/svelte/icons/zap';
import Flame from '@lucide/svelte/icons/flame';
import Sun from '@lucide/svelte/icons/sun';
import Moon from '@lucide/svelte/icons/moon';
import Cloud from '@lucide/svelte/icons/cloud';
import Umbrella from '@lucide/svelte/icons/umbrella';
import Pizza from '@lucide/svelte/icons/pizza';
import Headphones from '@lucide/svelte/icons/headphones';
import Camera from '@lucide/svelte/icons/camera';
import Monitor from '@lucide/svelte/icons/monitor';
import Smartphone from '@lucide/svelte/icons/smartphone';
import Laptop from '@lucide/svelte/icons/laptop';
import Tablet from '@lucide/svelte/icons/tablet';
import Wifi from '@lucide/svelte/icons/wifi';
import Globe from '@lucide/svelte/icons/globe';
import Link from '@lucide/svelte/icons/link';
import ExternalLink from '@lucide/svelte/icons/external-link';
import Download from '@lucide/svelte/icons/download';
import Upload from '@lucide/svelte/icons/upload';
import Share2 from '@lucide/svelte/icons/share-2';
import Send from '@lucide/svelte/icons/send';
import Inbox from '@lucide/svelte/icons/inbox';
import Archive from '@lucide/svelte/icons/archive';
import Trash2 from '@lucide/svelte/icons/trash-2';
import Edit from '@lucide/svelte/icons/edit';
import Pencil from '@lucide/svelte/icons/pencil';
import Brush from '@lucide/svelte/icons/brush';
import Palette from '@lucide/svelte/icons/palette';
import Layers from '@lucide/svelte/icons/layers';
import Grid from '@lucide/svelte/icons/grid-3x3';
import List from '@lucide/svelte/icons/list';
import LayoutGrid from '@lucide/svelte/icons/layout-grid';
import User from '@lucide/svelte/icons/user';
import GraduationCap from '@lucide/svelte/icons/graduation-cap';
import Book from '@lucide/svelte/icons/book';
import Compass from '@lucide/svelte/icons/compass';

export const iconMap: Record<string, typeof Circle> = {
    // sidebar에서 사용하는 아이콘
    MessageSquare,
    Users,
    CircleStar,
    CircleHelp,
    Images,
    Newspaper,
    PenTool,
    Lightbulb,
    FolderOpen,
    Gift,
    MapPin,
    Star,
    TrendingUp,
    ShoppingCart,
    ShoppingBag,
    Package,
    Megaphone,
    Sparkles,
    Coffee,
    UserCheck,
    Music,
    Info,
    HelpCircle,
    BookText,
    Circle,
    Cpu,
    Code,
    Gamepad2,
    BookOpen,
    Apple,
    // 헤더/추가 아이콘
    Home,
    Rss,
    Shield,
    LayoutDashboard,
    Settings,
    FileText,
    Bell,
    Search,
    Heart,
    Bookmark,
    Tag,
    Folder,
    Image,
    Video,
    Calendar,
    Clock,
    Map: MapIcon,
    Mail,
    Phone,
    CreditCard,
    Award,
    Trophy,
    Target,
    Zap,
    Flame,
    Sun,
    Moon,
    Cloud,
    Umbrella,
    Pizza,
    Headphones,
    Camera,
    Monitor,
    Smartphone,
    Laptop,
    Tablet,
    Wifi,
    Globe,
    Link,
    ExternalLink,
    Download,
    Upload,
    Share2,
    Send,
    Inbox,
    Archive,
    Trash2,
    Edit,
    Pencil,
    Brush,
    Palette,
    Layers,
    Grid,
    List,
    LayoutGrid,
    User,
    GraduationCap,
    Book,
    Compass
};

/**
 * 아이콘 이름으로 컴포넌트를 가져옵니다. 없으면 Circle 반환.
 */
export function getIcon(iconName?: string): typeof Circle {
    if (!iconName) return Circle;
    return iconMap[iconName] || Circle;
}
