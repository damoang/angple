/**
 * KG이니시스 간편인증 결과 수신
 * 이니시스에서 POST로 결과를 전송하면 처리 후 팝업 창에 결과 표시
 */
import type { RequestHandler } from './$types';
import { KISA_SEED_CBC } from 'kisa-seed';
import {
    SEED_IV,
    buildDupinfo,
    isValidInicisUrl,
    saveCertResult,
    checkDupinfo
} from '$lib/server/auth/cert-inicis.js';

export const POST: RequestHandler = async ({ request, locals }) => {
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

    const resData = await response.json();

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
        try {
            userName = KISA_SEED_CBC.decrypt(seedKey, SEED_IV, userName);
            userPhone = KISA_SEED_CBC.decrypt(seedKey, SEED_IV, userPhone);
            userBirthday = KISA_SEED_CBC.decrypt(seedKey, SEED_IV, userBirthday);
            userCi = KISA_SEED_CBC.decrypt(seedKey, SEED_IV, userCi);
        } catch {
            return certResultPage(false, '인증 데이터 복호화에 실패했습니다.');
        }
    }

    if (!userPhone) {
        return certResultPage(false, '정상적인 인증이 아닙니다.');
    }

    // CI 기반 dupinfo 생성
    const mbDupinfo = buildDupinfo(userCi);

    // 로그인 사용자 확인
    const mbId = locals.user?.mb_id;
    if (!mbId) {
        return certResultPage(false, '로그인 세션이 만료되었습니다.');
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

/** 인증 결과를 부모 창에 postMessage로 전달하는 HTML 페이지 */
function certResultPage(success: boolean, message: string) {
    const html = `<!DOCTYPE html>
<html>
<head><title>인증 결과</title></head>
<body>
<script>
    alert(${JSON.stringify(message)});
    if (window.opener) {
        window.opener.postMessage({ type: 'cert_complete', success: ${success} }, '*');
    }
    window.close();
</script>
</body>
</html>`;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}
