import { describe, expect, it } from 'vitest';
import {
    buildLogoPreviews,
    getLogoDateContext,
    getLogoTimeZone,
    resolveActiveLogo,
    resolveLogoRequestLocale
} from './logo-schedule';

describe('logo schedule', () => {
    it('resolves recurring logos by timezone-local date', () => {
        const schedules = [
            {
                id: 1,
                name: 'March First',
                logo_url: '/logo-1.svg',
                schedule_type: 'recurring' as const,
                recurring_date: '03-01',
                priority: 10
            },
            {
                id: 2,
                name: 'Default',
                logo_url: '/logo-default.svg',
                schedule_type: 'default' as const,
                priority: 0
            }
        ];
        const now = new Date('2026-02-28T15:30:00Z');

        expect(resolveActiveLogo(schedules, { now, timeZone: 'Asia/Seoul' })?.id).toBe(1);
        expect(resolveActiveLogo(schedules, { now, timeZone: 'America/New_York' })?.id).toBe(2);
    });

    it('keeps recurring over date range and default with priority ordering', () => {
        const schedules = [
            {
                id: 1,
                name: 'Default',
                logo_url: '/default.svg',
                schedule_type: 'default' as const,
                priority: 0
            },
            {
                id: 2,
                name: 'Date Range',
                logo_url: '/range.svg',
                schedule_type: 'date_range' as const,
                start_date: '2026-03-01',
                end_date: '2026-03-31',
                priority: 50
            },
            {
                id: 3,
                name: 'Recurring',
                logo_url: '/recurring.svg',
                schedule_type: 'recurring' as const,
                recurring_date: '03-15',
                priority: 1
            }
        ];
        const now = new Date('2026-03-15T01:00:00Z');

        expect(resolveActiveLogo(schedules, { now, timeZone: 'UTC' })?.id).toBe(3);
    });

    it('supports annual recurring ranges for seasonal periods', () => {
        const schedules = [
            {
                id: 10,
                name: 'Spring Equinox',
                logo_url: '/spring.svg',
                schedule_type: 'recurring' as const,
                recurring_date: '03-20~04-02',
                priority: 20
            },
            {
                id: 11,
                name: 'Winter Season',
                logo_url: '/winter.svg',
                schedule_type: 'recurring' as const,
                recurring_date: '12-20~01-10',
                priority: 10
            },
            {
                id: 12,
                name: 'Default',
                logo_url: '/default.svg',
                schedule_type: 'default' as const,
                priority: 0
            }
        ];

        expect(
            resolveActiveLogo(schedules, {
                now: new Date('2026-03-25T00:00:00Z'),
                timeZone: 'UTC'
            })?.id
        ).toBe(10);
        expect(
            resolveActiveLogo(schedules, {
                now: new Date('2026-12-28T00:00:00Z'),
                timeZone: 'UTC'
            })?.id
        ).toBe(11);
        expect(
            resolveActiveLogo(schedules, {
                now: new Date('2027-01-05T00:00:00Z'),
                timeZone: 'UTC'
            })?.id
        ).toBe(11);
    });

    it('builds previews for all supported locales with current logo info', () => {
        const schedules = [
            {
                id: 7,
                name: 'Default',
                logo_url: '/default.svg',
                schedule_type: 'default' as const,
                priority: 0
            }
        ];

        const previews = buildLogoPreviews(schedules, new Date('2026-03-29T00:00:00Z'));

        expect(previews).toHaveLength(7);
        expect(previews.find((preview) => preview.locale === 'ko')).toMatchObject({
            timeZone: getLogoTimeZone('ko'),
            activeLogoId: 7,
            activeLogoName: 'Default'
        });
    });

    it('resolves request locale with path, cookie, then header precedence', () => {
        expect(
            resolveLogoRequestLocale({
                pathname: '/ja/admin/logos',
                cookieLocale: 'ko',
                acceptLanguage: 'en-US,en;q=0.9'
            })
        ).toBe('ja');

        expect(
            resolveLogoRequestLocale({
                pathname: '/admin/logos',
                cookieLocale: 'vi',
                acceptLanguage: 'en-US,en;q=0.9'
            })
        ).toBe('vi');

        expect(
            resolveLogoRequestLocale({
                pathname: '/admin/logos',
                acceptLanguage: 'es-ES,es;q=0.9'
            })
        ).toBe('es');
    });

    it('formats timezone-local date context', () => {
        expect(getLogoDateContext(new Date('2026-03-29T00:05:00Z'), 'Asia/Seoul')).toMatchObject({
            currentDate: '2026-03-29',
            recurringDate: '03-29'
        });
    });
});
