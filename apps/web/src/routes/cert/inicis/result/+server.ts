/**
 * KG이니시스 간편인증 결과 수신
 * 이니시스에서 POST로 결과를 전송하면 처리 후 팝업 창에 결과 표시
 */
import type { RequestHandler } from './$types';
import { KISA_SEED_CBC } from 'kisa-seed';
import {
    getSeedIV,
    buildDupinfo,
    isValidInicisUrl,
    saveCertResult,
    checkDupinfo,
    getCertPendingMbId
} from '$lib/server/auth/cert-inicis.js';

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
            userName = KISA_SEED_CBC.decrypt(seedKey, seedIV, userName);
            userPhone = KISA_SEED_CBC.decrypt(seedKey, seedIV, userPhone);
            userBirthday = KISA_SEED_CBC.decrypt(seedKey, seedIV, userBirthday);
            userCi = KISA_SEED_CBC.decrypt(seedKey, seedIV, userCi);
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

    // 사용자 확인: 세션 → DB(mTxId) → 쿠키(백업) 순으로 시도
    const certPendingMbId = cookies.get('cert_pending_mbid');
    const mTxId = resData.mTxId || txId;
    const dbPendingMbId = mTxId ? await getCertPendingMbId(mTxId) : null;
    const sessionMbId = locals.user?.id;
    const mbId = sessionMbId || dbPendingMbId || certPendingMbId;
    console.log('[Cert] mbId resolve:', {
        fromSession: sessionMbId,
        fromDB: dbPendingMbId,
        fromCookie: certPendingMbId,
        final: mbId
    });
    if (!mbId) {
        console.error('[Cert] mbId not found');
        return certResultPage(false, '인증 세션이 만료되었습니다. 다시 시도해주세요.');
    }
    // 쿠키 사용 후 삭제
    if (certPendingMbId) {
        cookies.delete('cert_pending_mbid', { path: '/', sameSite: 'none', secure: true });
    }

    // 중복 인증 체크
    const existingId = await checkDupinfo(mbId, mbDupinfo);
    if (existingId) {
        return certResultPage(false, '입력하신 본인확인 정보로 이미 가입된 내역이 존재합니다.');
    }

    // DB 업데이트
    try {
        await saveCertResult(mbId, mbDupinfo, userBirthday);
    } catch (err) {
        console.error('[Cert] DB 저장 실패:', err);
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
