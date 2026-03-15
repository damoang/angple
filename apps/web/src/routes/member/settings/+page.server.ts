/**
 * 회원 설정 페이지 - 프로필 관리 + 소셜 계정 관리
 */
import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { getSocialProfilesByMember } from '$lib/server/auth/oauth/social-profile.js';
import {
    getMemberFullProfile,
    updateNickname,
    updateEmail,
    changePassword,
    updateProfile
} from '$lib/server/auth/member-update.js';

export const load: PageServerLoad = async ({ locals }) => {
    // 인증 확인 (locals.user 기반 — /my/* 패턴과 동일)
    if (!locals.user) {
        redirect(303, '/login?redirect=/member/settings');
    }

    const mbId = locals.user.id!;

    // 병렬 조회
    const [profiles, memberProfile] = await Promise.all([
        getSocialProfilesByMember(mbId),
        getMemberFullProfile(mbId)
    ]);

    // 닉네임 변경 가능일 계산
    let nickChangeDaysLeft = 0;
    if (memberProfile?.mb_nick_date) {
        const lastChange = new Date(memberProfile.mb_nick_date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
        nickChangeDaysLeft = Math.max(0, 30 - diffDays);
    }

    return {
        mbId,
        profile: memberProfile
            ? {
                  mb_nick: memberProfile.mb_nick,
                  mb_email: memberProfile.mb_email,
                  mb_homepage: memberProfile.mb_homepage,
                  mb_signature: memberProfile.mb_signature,
                  mb_open: memberProfile.mb_open,
                  mb_mailling: memberProfile.mb_mailling,
                  mb_level: memberProfile.mb_level,
                  mb_image_url: memberProfile.mb_image_url || '',
                  mb_image_updated_at: memberProfile.mb_image_updated_at || '',
                  mb_certify: memberProfile.mb_certify || ''
              }
            : null,
        nickChangeDaysLeft,
        socialProfiles: profiles.map((p) => ({
            mpNo: p.mp_no,
            provider: p.provider,
            displayname: p.displayname,
            identifier: p.identifier,
            registeredAt: p.mp_register_day,
            latestAt: p.mp_latest_day
        }))
    };
};

export const actions: Actions = {
    updateNickname: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: '로그인이 필요합니다.' });

        const formData = await request.formData();
        const nickname = formData.get('nickname') as string;
        if (!nickname) return fail(400, { error: '닉네임을 입력해주세요.' });

        try {
            const result = await updateNickname(locals.user.id!, nickname);
            if (!result.success) {
                return fail(400, { error: result.error });
            }
        } catch (err) {
            console.error('닉네임 변경 에러:', err);
            return fail(500, { error: '닉네임 변경 중 오류가 발생했습니다.' });
        }

        return { success: true, message: '닉네임이 변경되었습니다.' };
    },

    updateEmail: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: '로그인이 필요합니다.' });

        const formData = await request.formData();
        const email = formData.get('email') as string;
        if (!email) return fail(400, { error: '이메일을 입력해주세요.' });

        const result = await updateEmail(locals.user.id!, email);
        if (!result.success) {
            return fail(400, { error: result.error });
        }

        return { success: true, message: result.message };
    },

    changePassword: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: '로그인이 필요합니다.' });

        const formData = await request.formData();
        const currentPassword = formData.get('currentPassword') as string;
        const newPassword = formData.get('newPassword') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (!currentPassword || !newPassword) {
            return fail(400, { error: '비밀번호를 입력해주세요.' });
        }

        if (newPassword !== confirmPassword) {
            return fail(400, { error: '새 비밀번호가 일치하지 않습니다.' });
        }

        const result = await changePassword(locals.user.id!, currentPassword, newPassword);
        if (!result.success) {
            return fail(400, { error: result.error });
        }

        return { success: true, message: '비밀번호가 변경되었습니다.' };
    },

    updateAvatar: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: '로그인이 필요합니다.' });

        const formData = await request.formData();
        const avatarUrl = (formData.get('avatar_url') as string) || '';

        const result = await updateProfile(locals.user.id!, { mb_image_url: avatarUrl });
        if (!result.success) {
            return fail(400, { error: result.error });
        }

        return { success: true, message: '프로필 사진이 변경되었습니다.' };
    },

    updateProfile: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: '로그인이 필요합니다.' });

        const formData = await request.formData();
        const result = await updateProfile(locals.user.id!, {
            mb_homepage: (formData.get('homepage') as string) || '',
            mb_signature: (formData.get('signature') as string) || '',
            mb_open: formData.get('open') === 'on' ? 1 : 0,
            mb_mailling: formData.get('mailling') === 'on' ? 1 : 0
        });

        if (!result.success) {
            return fail(400, { error: result.error });
        }

        return { success: true, message: '설정이 저장되었습니다.' };
    }
};
