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
    getCertPendingMbId
} from '$lib/server/auth/cert-inicis.js';

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

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
    const formData = await request.formData();

    const txId = (formData.get('txId') as string) || '';
    const resultCode = (formData.get('resultCode') as string) || '';
    const resultMsg = (formData.get('resultMsg') as string) || '';
    const authRequestUrl = (formData.get('authRequestUrl') as string) || '';
    const seedKey = (formData.get('token') as string) || '';

    // 인증 실패
    if (resultCode !== '0000') {
        return certResultPage(false, `인증 실패: ${decodeURIComponent(resultMsg || resultCode)}`);
    }

    // URL 검증
    if (!isValidInicisUrl(authRequestUrl)) {
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
        return certResultPage(false, '인증 서버 응답을 처리할 수 없습니다.');
    }

    if (resData.resultCode !== '0000') {
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
            return certResultPage(false, '인증 데이터 복호화에 실패했습니다.');
        }
    }

    if (!userPhone) {
        console.error('[Cert] userPhone empty after processing');
        return certResultPage(false, '정상적인 인증이 아닙니다.');
    }

    // CI 기반 dupinfo 생성
    const mbDupinfo = buildDupinfo(userCi);
    // 보조 DI — 2026-07-19 키 전환기(1,292명)와 대조하기 위한 값.
    // 보조 키 미설정이면 빈 문자열이고, 저장·조회에서 자동 제외된다.
    const mbDupinfoAlt = buildDupinfoAlt(userCi);
    console.log('[Cert] dupinfo generated:', {
        dupinfoPrefix: mbDupinfo.slice(0, 16),
        hasCi: !!userCi,
        birthDay: userBirthday
    });

    // 사용자 확인: 세션 → DB(mTxId) → 쿠키(백업) 순으로 시도
    const certPendingMbId = cookies.get('cert_pending_mbid');
    const mTxId = resData.mTxId || txId;
    const dbPendingMbId = mTxId ? await getCertPendingMbId(mTxId) : null;
    const sessionMbId = locals.user?.id;
    const mbId = sessionMbId || dbPendingMbId || certPendingMbId;
    if (!mbId) {
        console.error('[Cert] mbId not found');
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
        await flagDupinfoCollision(mbId, mbDupinfo, mbDupinfoAlt).catch((e) => {
            console.error('[Cert] DI 충돌 플래그 기록 실패:', e);
        });
        return certResultPage(
            false,
            '이전에 가입하신 계정이 있어 본인인증이 제한되었습니다. ' +
                '기존 계정으로 로그인해 주시고, 그 계정을 되살리고 싶으시면 ' +
                'contact@damoang.net 으로 복원 요청 메일을 보내주세요.'
        );
    }

    // 명의 동일성 확인(구멍③) — 이미 DI 가 있는 계정이 **다른 명의로** 갈아타는 것을 막는다.
    // checkDupinfo 는 다른 계정과의 충돌만 보므로, 빌린 명의의 주인이 회원이 아니면 통과해 버린다.
    const identity = await verifySameIdentity(mbId, mbDupinfo, mbDupinfoAlt);
    if (identity.hasPrior && !identity.sameIdentity) {
        await flagIdentityMismatch(mbId).catch((e) => {
            console.error('[Cert] 명의 불일치 플래그 기록 실패:', e);
        });
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

    return certResultPage(true, '본인인증이 완료되었습니다.');
};

/** 인증 결과를 부모 창에 전달하는 HTML 페이지 */
function certResultPage(success: boolean, message: string) {
    const html = `<!DOCTYPE html>
<html>
<head><title>인증 결과</title></head>
<body>
<p style="text-align:center;margin-top:40px;font-family:sans-serif;color:#666;">${success ? '인증이 완료되었습니다. 잠시 후 이동합니다...' : message}</p>
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
