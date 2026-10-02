import { describe, it, expect } from 'vitest';
import {
    MEMBER_IMAGE_ACCEPT,
    MEMBER_IMAGE_MAX_BYTES,
    MEMBER_IMAGE_SIZE_ERROR,
    MEMBER_IMAGE_TYPE_ERROR,
    MEMBER_IMAGE_TYPES,
    validateMemberImageFile
} from './member-image-upload';

describe('validateMemberImageFile', () => {
    it.each(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])('%s 허용', (type) => {
        expect(validateMemberImageFile({ type, size: 1024 })).toBeNull();
    });

    it('MIME 대소문자 무시', () => {
        expect(validateMemberImageFile({ type: 'IMAGE/PNG', size: 1024 })).toBeNull();
    });

    it.each(['image/svg+xml', 'image/heic', 'image/heif', 'image/bmp', 'video/mp4', ''])(
        '%s 거부',
        (type) => {
            expect(validateMemberImageFile({ type, size: 1024 })).toBe(MEMBER_IMAGE_TYPE_ERROR);
        }
    );

    it('정확히 5MB 는 허용', () => {
        expect(
            validateMemberImageFile({ type: 'image/jpeg', size: MEMBER_IMAGE_MAX_BYTES })
        ).toBeNull();
    });

    it('5MB 초과는 거부', () => {
        expect(
            validateMemberImageFile({ type: 'image/jpeg', size: MEMBER_IMAGE_MAX_BYTES + 1 })
        ).toBe(MEMBER_IMAGE_SIZE_ERROR);
    });

    it('형식 오류가 크기 오류보다 먼저', () => {
        expect(
            validateMemberImageFile({ type: 'image/svg+xml', size: MEMBER_IMAGE_MAX_BYTES + 1 })
        ).toBe(MEMBER_IMAGE_TYPE_ERROR);
    });
});

describe('상수', () => {
    it('accept 는 허용 형식 목록과 같다', () => {
        expect(MEMBER_IMAGE_ACCEPT.split(',')).toEqual([...MEMBER_IMAGE_TYPES]);
    });

    it('accept 에 SVG 가 없다', () => {
        expect(MEMBER_IMAGE_ACCEPT).not.toContain('svg');
    });

    it('상한은 5MB', () => {
        expect(MEMBER_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
        expect(MEMBER_IMAGE_SIZE_ERROR).toContain('5MB');
    });
});
