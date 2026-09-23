/**
 * KG이니시스 간편인증 결과 수신
 * 이니시스에서 POST로 결과를 전송하면 처리 후 팝업 창에 결과 표시
 */
import type { RequestHandler } from './$types';
import {
    getSeedIV,
    buildDupinfo,
    buildDupinfoAlt,
    isValidInicisUrl,
    saveCertResult,
    checkDupinfo,
    flagDupinfoCollision,
    verifySameIdentity,
    flagIdentityMismatch,
    getCertPendingMbId,
    logCertAttempt,
    type CertAttempt
} from '$lib/server/auth/cert-inicis.js';
import { readPool } from '$lib/server/db.js';
import { resolveClientIp } from '$lib/server/rate-limit.js';
import type { RowDataPacket } from 'mysql2';

type SeedCipher = {
    decrypt: (seedKey: string, seedIV: string, encrypted: string) => string;
};

let cachedSeedCipher: SeedCipher | null = null;

async function getSeedCipher(): Promise<SeedCipher> {
    if (cachedSeedCipher) return cachedSeedCipher;

    const moduleName = 'kisa-seed';
    const mod = (await import(/* @vite-ignore */ moduleName)) as {
        KISA_SEED_CBC?: SeedCipher;
    };
    if (!mod?.KISA_SEED_CBC?.decrypt) {
        throw new Error('kisa-seed module is missing KISA_SEED_CBC.decrypt');
    }
    cachedSeedCipher = mod.KISA_SEED_CBC;
    return cachedSeedCipher;
}

export const POST: RequestHandler = async ({ request, locals, cookies, getClientAddress }) => {
    const formData = await request.formData();

    const txId = (formData.get('txId') as string) || '';
    const resultCode = (formData.get('resultCode') as string) || '';
    const resultMsg = (formData.get('resultMsg') as string) || '';
    const authRequestUrl = (formData.get('authRequestUrl') as string) || '';
    const seedKey = (formData.get('token') as string) || '';

    // 시도 로그 공통값 — 모든 분기의 return 직전에 남긴다 (fail-open, 개인정보 없음)
    // IP 는 rate-limit 과 같은 해석기(getClientAddress → XFF/x-real-ip 폴백) — 빈값이면 ''
    const ip = resolveClientIp(getClientAddress, request) ?? '';
    const userAgent = request.headers.get('user-agent') ?? '';
    const log = (row: Omit<CertAttempt, 'tx_id' | 'ip' | 'user_agent'> & { mb_id?: string }) =>
        logCertAttempt({
            tx_id: txId,
            ip,
            user_agent: userAgent,
            mb_id: row.mb_id ?? locals.user?.id ?? '',
            ...row
        });

    // 인증 실패
    if (resultCode !== '0000') {
        await log({
            result: 'provider_fail',
            result_code: resultCode,
            result_msg: decodeURIComponent(resultMsg || '')
        });
        return certResultPage(false, `인증 실패: ${decodeURIComponent(resultMsg || resultCode)}`);
    }

    // URL 검증
    if (!isValidInicisUrl(authRequestUrl)) {
        await log({ result: 'invalid', result_msg: 'invalid authRequestUrl' });
        return certResultPage(false, '잘못된 요청입니다.');
    }

    // 이니시스 서버에 결과 조회
    const mid = txId.substring(6, 16);
    const response = await fetch(authRequestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ mid, txId })
    });

    const resText = await response.text();
    let resData: Record<string, string>;
    try {
        resData = JSON.parse(resText);
    } catch {
        console.error('[Cert] JSON parse failed, raw:', resText);
        await log({ result: 'invalid', result_msg: 'provider response parse failed' });
        return certResultPage(false, '인증 서버 응답을 처리할 수 없습니다.');
    }

    if (resData.resultCode !== '0000') {
        await log({
            result: 'provider_fail',
            result_code: resData.resultCode || '',
            result_msg: decodeURIComponent(resData.resultMsg || '')
        });
        return certResultPage(
            false,
            `인증 실패: ${decodeURIComponent(resData.resultMsg || resData.resultCode)}`
        );
    }

    // SEED 복호화
    let userName = resData.userName || '';
    let userPhone = resData.userPhone || '';
    let userBirthday = resData.userBirthday || '';
    let userCi = resData.userCi || '';

    if (seedKey) {
        const seedIV = getSeedIV();
        if (!seedIV) {
            console.error('[Cert] SEED IV is empty — check CERT_INICIS_SEED_IV env var');
            await log({ result: 'invalid', result_msg: 'seed iv missing' });
            return certResultPage(false, '인증 서버 설정 오류입니다.');
        }
        try {
            const seedCipher = await getSeedCipher();
            userName = seedCipher.decrypt(seedKey, seedIV, userName);
            userPhone = seedCipher.decrypt(seedKey, seedIV, userPhone);
            userBirthday = seedCipher.decrypt(seedKey, seedIV, userBirthday);
            userCi = seedCipher.decrypt(seedKey, seedIV, userCi);
        } catch (err) {
            console.error('[Cert] SEED decrypt error:', err);
            await log({ result: 'decrypt_fail', result_msg: 'seed decrypt error' });
            return certResultPage(false, '인증 데이터 복호화에 실패했습니다.');
        }
    }

    if (!userPhone) {
        console.error('[Cert] userPhone empty after processing');
        await log({ result: 'invalid', result_msg: 'userPhone empty' });
        return certResultPage(false, '정상적인 인증이 아닙니다.');
    }

    // CI 기반 dupinfo 생성
    const mbDupinfo = buildDupinfo(userCi);
    // 보조 DI — 2026-07-19 키 전환기(1,292명)와 대조하기 위한 값.
    // 보조 키 미설정이면 빈 문자열이고, 저장·조회에서 자동 제외된다.
    const mbDupinfoAlt = buildDupinfoAlt(userCi);
    // ⛔ 생년월일은 로그에 남기지 않는다 — 파드 로그는 개인정보 저장소가 아니다.
    console.log('[Cert] dupinfo generated:', {
        dupinfoPrefix: mbDupinfo.slice(0, 16),
        hasCi: !!userCi
    });

    // 사용자 확인: 세션 → DB(mTxId) → 쿠키(백업) 순으로 시도
    const certPendingMbId = cookies.get('cert_pending_mbid');
    const mTxId = resData.mTxId || txId;
    const dbPendingMbId = mTxId ? await getCertPendingMbId(mTxId) : null;
    const sessionMbId = locals.user?.id;
    const mbId = sessionMbId || dbPendingMbId || certPendingMbId;
    if (!mbId) {
        console.error('[Cert] mbId not found');
        await log({ result: 'no_session', dupinfo: mbDupinfo, result_msg: 'mbId not found' });
        return certResultPage(false, '인증 세션이 만료되었습니다. 다시 시도해주세요.');
    }
    // 쿠키 사용 후 삭제
    if (certPendingMbId) {
        cookies.delete('cert_pending_mbid', { path: '/', sameSite: 'none', secure: true });
    }

    // 중복 인증 체크
    const existingId = await checkDupinfo(mbId, mbDupinfo, mbDupinfoAlt);
    console.log('[Cert] dupinfo check result:', {
        mbId,
        dupinfoPrefix: mbDupinfo.slice(0, 16),
        existingId
    });
    if (existingId) {
        // DI 충돌 하드닝(구멍②): 충돌 계정이 제재/탈퇴면 재인증 시도를 durable 운영 플래그로
        // 기록(다중이/징계회피 감사용). 차단 자체는 위 checkDupinfo 로 이미 성립하므로,
        // 플래그 기록 실패가 응답 흐름을 막지 않도록 방어적으로 처리한다.
        // ⛔ 보조 DI 도 넘긴다 — checkDupinfo 가 두 값으로 차단했는데 여기서 주 DI 만 보면
        //    키 전환기(2026-07-19~08-13) 계정과의 충돌이 기록되지 않는다.
        const collision = await flagDupinfoCollision(mbId, mbDupinfo, mbDupinfoAlt).catch((e) => {
            console.error('[Cert] DI 충돌 플래그 기록 실패:', e);
            return null;
        });
        // ⭐ 어느 소셜로 들어가야 하는지 **알려준다**.
        // 예전 문구는 "기존 계정으로 로그인해 주시고" 로 끝났는데, 회원은 정작
        // **어느 소셜이었는지를 모른다**. 로그인 화면은 버튼 순서를 매번 섞어
        // (login/+page.svelte 의 shuffle) 위치 기억도 소용이 없다.
        // 2026-09 한 주에만 같은 문의가 4건 왔고, 네 분 다 옛 계정이 살아 있는데
        // 다른 소셜로 로그인해 새 계정이 생긴 경우였다.
        // ⛔ 보여주는 것은 **제공자 이름뿐**이다. mb_id·닉네임·이메일은 말하지 않는다.
        //    DI 가 일치하므로 같은 사람의 계정이지만, 필요한 최소만 알린다.
        // ★ 누가 막았는지 영구 기록 — 「이 DI 가 누구 것인가」를 나중에 추측 없이 확정한다.
        // result_msg 에 조문 분류(sanction/withdrawn/active)를 남긴다 — 처분 없는 단순 탈퇴 충돌을 통계로 볼 수 있게.
        await log({
            result: 'dup',
            mb_id: mbId,
            dupinfo: mbDupinfo,
            existing_mb_id: existingId,
            result_msg: collision?.kind ?? ''
        });
        const howToLogin = await describeLoginMethod(existingId, mbId);
        return certResultPage(
            false,
            '이전에 가입하신 계정이 있어 본인인증이 제한되었습니다.\n\n' +
                howToLogin +
                '\n\n계정을 되살리기 어려우시면 contact@damoang.net 으로 알려주세요.'
        );
    }

    // 명의 동일성 확인(구멍③) — 이미 DI 가 있는 계정이 **다른 명의로** 갈아타는 것을 막는다.
    // checkDupinfo 는 다른 계정과의 충돌만 보므로, 빌린 명의의 주인이 회원이 아니면 통과해 버린다.
    const identity = await verifySameIdentity(mbId, mbDupinfo, mbDupinfoAlt);
    if (identity.hasPrior && !identity.sameIdentity) {
        await flagIdentityMismatch(mbId).catch((e) => {
            console.error('[Cert] 명의 불일치 플래그 기록 실패:', e);
        });
        await log({ result: 'id_mismatch', mb_id: mbId, dupinfo: mbDupinfo });
        return certResultPage(
            false,
            '기존에 본인인증하신 명의와 일치하지 않습니다. 본인 명의로 진행해 주세요. ' +
                '변경이 필요하시면 contact@damoang.net 으로 메일을 보내주세요.'
        );
    }

    // DB 업데이트
    try {
        await saveCertResult(mbId, mbDupinfo, userBirthday, mbDupinfoAlt);
    } catch (err) {
        console.error('[Cert] DB 저장 실패:', err);
        // 방어선이 막은 경우와 실제 저장 실패를 구분해 안내한다 —
        // "저장 실패"로 뭉뚱그리면 회원이 재시도만 반복하게 된다.
        const reason = err instanceof Error ? err.message : '';
        // ⛔ 로그엔 원문 메시지를 넣지 않는다 — MySQL 1292/1366 류는 문제 값(생년 등)을 메시지에 포함한다.
        //    내부 센티널이면 그대로, 아니면 드라이버 오류코드만.
        const safeReason =
            reason === 'IDENTITY_MISMATCH' || reason === 'DI_COLLISION_BLOCKED'
                ? reason
                : ((err as { code?: string })?.code ?? 'db_error');
        await log({ result: 'save_fail', mb_id: mbId, dupinfo: mbDupinfo, result_msg: safeReason });
        if (reason === 'IDENTITY_MISMATCH') {
            return certResultPage(
                false,
                '기존에 본인인증하신 명의와 일치하지 않습니다. 본인 명의로 진행해 주세요. ' +
                    '변경이 필요하시면 contact@damoang.net 으로 메일을 보내주세요.'
            );
        }
        if (reason === 'DI_COLLISION_BLOCKED') {
            return certResultPage(
                false,
                '이전에 가입하신 계정이 있어 본인인증이 제한되었습니다. ' +
                    '기존 계정으로 로그인해 주시고, 그 계정을 되살리고 싶으시면 ' +
                    'contact@damoang.net 으로 복원 요청 메일을 보내주세요.'
            );
        }
        return certResultPage(false, '인증 정보 저장에 실패했습니다.');
    }

    await log({ result: 'success', mb_id: mbId, dupinfo: mbDupinfo });
    return certResultPage(true, '본인인증이 완료되었습니다.');
};

/** 인증 결과를 부모 창에 전달하는 HTML 페이지 */
/** 소셜 제공자 코드 → 회원이 로그인 화면에서 보는 이름. */
const PROVIDER_LABEL: Record<string, string> = {
    naver: '네이버',
    kakao: '카카오',
    google: '구글',
    apple: '애플'
};

/** 그 계정에 연결된 소셜 제공자 코드들. */
async function providersOf(mbId: string): Promise<string[]> {
    const [rows] = await readPool.query<RowDataPacket[]>(
        'SELECT DISTINCT provider FROM g5_member_social_profiles WHERE mb_id = ?',
        [mbId]
    );
    return rows.map((r) => String(r.provider));
}

/**
 * 기존 계정에 들어가는 방법을 회원이 읽을 문장으로 만든다.
 *
 * ⛔ 실패하면 **막지 않는다.** 조회가 안 되거나 소셜이 없으면(전체의 1.8%)
 *    예전과 같은 일반 문구를 돌려준다. 안내를 못 해도 회원 흐름은 그대로 가야 한다.
 * ⛔ 제공자 이름만 말한다. mb_id·닉네임·이메일은 담지 않는다.
 */
async function describeLoginMethod(existingId: string, currentId: string): Promise<string> {
    const generic = '기존에 쓰시던 계정으로 로그인해 주세요.';
    try {
        const [oldProviders, curProviders] = await Promise.all([
            providersOf(existingId),
            providersOf(currentId)
        ]);
        const names = oldProviders.map((p) => PROVIDER_LABEL[p]).filter((v): v is string => !!v);
        if (names.length === 0) return generic;
        const joined = names.join(' 또는 ');

        // ⛔ 같은 제공자를 **여러 개** 가진 경우 — 2026-09-15 에 실제로 겪었다.
        //
        //    한 회원이 네이버 계정을 둘 갖고 있었다. 기존 계정도 네이버, 새 계정도 네이버라
        //    「네이버로 로그인해 주세요」가 아무 도움이 안 됐다. 이미 네이버로 하고 있었기
        //    때문이다. 안내를 보고도 같은 계정에서 인증을 재시도했고 또 막혔다.
        //
        //    ⭐ 제공자가 겹치면 **「다른 계정일 수 있다」**까지 말해야 단서가 된다.
        const overlap = oldProviders.some((p) => curProviders.includes(p));
        if (overlap) {
            return (
                `그 계정은 ${joined}로 연결되어 있습니다.\n` +
                `지금 로그인하신 ${joined} 계정과 다른 ${joined} 계정일 수 있습니다.\n` +
                `${joined}에서 로그아웃하신 뒤, 예전에 쓰시던 아이디로 다시 로그인해 주세요.`
            );
        }
        return (
            `그 계정은 ${joined}로 로그인하시면 들어가실 수 있습니다.\n` +
            `로그인 화면에서 ${joined}를 선택해 주세요.`
        );
    } catch (e) {
        console.error('[Cert] 기존 계정 로그인 방법 조회 실패:', e);
        return generic;
    }
}

function certResultPage(success: boolean, message: string) {
    const html = `<!DOCTYPE html>
<html>
<head><title>인증 결과</title></head>
<body>
<p style="text-align:center;margin-top:40px;font-family:sans-serif;color:#666;white-space:pre-line;line-height:1.7;">${success ? '인증이 완료되었습니다. 잠시 후 이동합니다...' : message}</p>
<script>
(function() {
    // localStorage 이벤트로 부모 창에 결과 전달 (window.opener가 끊겨도 동작)
    try {
        localStorage.setItem('cert_result', JSON.stringify({ success: ${success}, ts: Date.now() }));
    } catch(e) {}

    // postMessage도 시도
    if (window.opener) {
        try {
            window.opener.postMessage({ type: 'cert_complete', success: ${success} }, '*');
        } catch(e) {}
    }

    ${success ? '' : `alert(${JSON.stringify(message)});`}

    // 팝업 닫기 시도, 실패하면 리다이렉트
    try { window.close(); } catch(e) {}
    setTimeout(function() {
        if (!window.closed) window.location.href = '/register/cert';
    }, 500);
})();
</script>
</body>
</html>`;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}
