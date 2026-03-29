import {
    DEFAULT_LOCALE,
    LOCALE_METADATA,
    SUPPORTED_LOCALES,
    detectLocaleFromHeader,
    extractLocaleFromPath,
    isValidLocale,
    type SupportedLocale
} from '@angple/i18n';

export interface LogoScheduleLike {
    id: number;
    name: string;
    logo_url: string;
    schedule_type: 'recurring' | 'date_range' | 'default';
    recurring_date?: string;
    start_date?: string;
    end_date?: string;
    priority: number;
}

const MMDD_REGEX = /^\d{2}-\d{2}$/;
const RECURRING_RANGE_REGEX = /^(\d{2}-\d{2})~(\d{2}-\d{2})$/;

export interface LogoPreview {
    locale: SupportedLocale;
    label: string;
    flag: string;
    region: string;
    timeZone: string;
    currentDate: string;
    currentTime: string;
    activeLogoId: number | null;
    activeLogoName: string | null;
}

const LOGO_TIME_ZONES: Record<SupportedLocale, string> = {
    en: 'America/New_York',
    ko: 'Asia/Seoul',
    ja: 'Asia/Tokyo',
    zh: 'Asia/Shanghai',
    es: 'Europe/Madrid',
    ar: 'Asia/Riyadh',
    vi: 'Asia/Ho_Chi_Minh'
};

interface ZonedDateParts {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
}

function getZonedDateParts(now: Date, timeZone: string): ZonedDateParts {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find((part) => part.type === type)?.value ?? '';

    return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hour: get('hour'),
        minute: get('minute')
    };
}

function compareLogoPriority(a: LogoScheduleLike, b: LogoScheduleLike): number {
    const scheduleOrder = (logo: LogoScheduleLike): number => {
        switch (logo.schedule_type) {
            case 'recurring':
                return 0;
            case 'date_range':
                return 1;
            default:
                return 2;
        }
    };

    const typeDiff = scheduleOrder(a) - scheduleOrder(b);
    if (typeDiff !== 0) return typeDiff;

    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.id - a.id;
}

function isValidMmdd(value: string): boolean {
    return MMDD_REGEX.test(value);
}

export function isValidRecurringDateInput(value: string): boolean {
    if (isValidMmdd(value)) return true;

    const normalized = value.replace(/\s+/g, '');
    const match = normalized.match(RECURRING_RANGE_REGEX);
    if (!match) return false;

    return isValidMmdd(match[1]) && isValidMmdd(match[2]);
}

export function normalizeRecurringDateInput(value: string): string {
    const trimmed = value.trim();
    if (isValidMmdd(trimmed)) {
        return trimmed;
    }

    const normalized = trimmed.replace(/\s+/g, '');
    const match = normalized.match(RECURRING_RANGE_REGEX);
    if (!match) return trimmed;

    return `${match[1]}~${match[2]}`;
}

export function dateInputToRecurringMmdd(value: string): string {
    if (!value) return '';
    const [, month, day] = value.split('-');
    if (!month || !day) return '';
    return `${month}-${day}`;
}

export function recurringMmddToDateInput(value: string, year: number): string {
    if (!value || !isValidMmdd(value)) return '';
    const [month, day] = value.split('-');
    return `${String(year)}-${month}-${day}`;
}

function normalizeRecurringRange(
    recurringDate?: string
): { start: string; end: string; wrapsYear: boolean } | null {
    if (!recurringDate) return null;

    const [start, end] = recurringDate.split('~').map((value) => value.trim());
    if (!start || !end || !isValidMmdd(start) || !isValidMmdd(end)) return null;

    return {
        start,
        end,
        wrapsYear: start > end
    };
}

function matchesRecurringSchedule(recurringDate: string | undefined, currentMmdd: string): boolean {
    if (!recurringDate) return false;
    const normalized = normalizeRecurringDateInput(recurringDate);
    if (isValidMmdd(normalized)) {
        return normalized === currentMmdd;
    }

    const range = normalizeRecurringRange(normalized);
    if (!range) return false;

    if (!range.wrapsYear) {
        return currentMmdd >= range.start && currentMmdd <= range.end;
    }

    return currentMmdd >= range.start || currentMmdd <= range.end;
}

export function normalizeLogoLocale(locale?: string | null): SupportedLocale {
    if (locale && isValidLocale(locale)) {
        return locale;
    }
    return DEFAULT_LOCALE;
}

export function resolveLogoRequestLocale(options: {
    pathname?: string;
    cookieLocale?: string | null;
    acceptLanguage?: string | null;
}): SupportedLocale {
    const pathLocale = options.pathname ? extractLocaleFromPath(options.pathname) : null;
    if (pathLocale) return pathLocale;

    if (options.cookieLocale && isValidLocale(options.cookieLocale)) {
        return options.cookieLocale;
    }

    if (options.acceptLanguage) {
        return detectLocaleFromHeader(options.acceptLanguage);
    }

    return DEFAULT_LOCALE;
}

export function getLogoTimeZone(locale: SupportedLocale): string {
    return LOGO_TIME_ZONES[locale];
}

export function resolveBrowserLogoTimeZone(requestLocale: SupportedLocale): string {
    if (typeof Intl === 'undefined') {
        return getLogoTimeZone(requestLocale);
    }

    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTimeZone) {
        return getLogoTimeZone(requestLocale);
    }

    try {
        Intl.DateTimeFormat('en-US', { timeZone: browserTimeZone }).format(new Date());
        return browserTimeZone;
    } catch {
        return getLogoTimeZone(requestLocale);
    }
}

export function getLogoDateContext(
    now: Date = new Date(),
    timeZone: string = getLogoTimeZone(DEFAULT_LOCALE)
): {
    currentDate: string;
    currentTime: string;
    recurringDate: string;
} {
    const zoned = getZonedDateParts(now, timeZone);

    return {
        currentDate: `${zoned.year}-${zoned.month}-${zoned.day}`,
        currentTime: `${zoned.hour}:${zoned.minute}`,
        recurringDate: `${zoned.month}-${zoned.day}`
    };
}

export function resolveActiveLogo(
    schedules: LogoScheduleLike[],
    options: {
        now?: Date;
        timeZone?: string;
    } = {}
): LogoScheduleLike | null {
    if (!schedules || schedules.length === 0) return null;

    const { currentDate, recurringDate } = getLogoDateContext(
        options.now,
        options.timeZone ?? getLogoTimeZone(DEFAULT_LOCALE)
    );

    const ordered = [...schedules].sort(compareLogoPriority);

    const recurring = ordered.find(
        (logo) =>
            logo.schedule_type === 'recurring' &&
            matchesRecurringSchedule(logo.recurring_date, recurringDate)
    );
    if (recurring) return recurring;

    const range = ordered.find(
        (logo) =>
            logo.schedule_type === 'date_range' &&
            !!logo.start_date &&
            !!logo.end_date &&
            logo.start_date <= currentDate &&
            logo.end_date >= currentDate
    );
    if (range) return range;

    return ordered.find((logo) => logo.schedule_type === 'default') ?? null;
}

export function buildLogoPreviews(
    schedules: LogoScheduleLike[],
    now: Date = new Date()
): LogoPreview[] {
    return SUPPORTED_LOCALES.map((locale) => {
        const meta = LOCALE_METADATA[locale];
        const timeZone = getLogoTimeZone(locale);
        const { currentDate, currentTime } = getLogoDateContext(now, timeZone);
        const activeLogo = resolveActiveLogo(schedules, { now, timeZone });

        return {
            locale,
            label: meta.englishName,
            flag: meta.flag,
            region: meta.region ?? locale.toUpperCase(),
            timeZone,
            currentDate,
            currentTime,
            activeLogoId: activeLogo?.id ?? null,
            activeLogoName: activeLogo?.name ?? null
        };
    });
}
