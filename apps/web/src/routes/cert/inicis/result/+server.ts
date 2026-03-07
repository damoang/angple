/**
 * KG이니시스 실명인증 콜백 엔드포인트
 * PHP ini_result.php 대응
 *
 * KG이니시스가 인증 완료 후 이 URL로 POST합니다.
 * 결과를 처리하고 부모 창에 postMessage로 전달하는 HTML을 반환합니다.
 */
import type { RequestHandler } from './$types';
import { processCallback } from '$lib/server/auth/cert-inicis.js';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request, cookies, locals, getClientAddress }) => {
    const formData = await request.formData();
    const clientIp = getClientAddress();

    const txId = (formData.get('txId') as string) || '';
    const resultCode = (formData.get('resultCode') as string) || '';
    const resultMsg = (formData.get('resultMsg') as string) || '';
    const authRequestUrl = (formData.get('authRequestUrl') as string) || '';
    const token = (formData.get('token') as string) || '';

    // 로그인된 사용자의 mb_id (가입 후 인증 시 g5_member 직접 업데이트용)
    const currentMbId = locals.user?.id || undefined;

    // 인증 결과 처리
    const result = await processCallback(
        {
            txId,
            resultCode,
            resultMsg,
            authRequestUrl,
            token: token || undefined
        },
        clientIp,
        currentMbId
    );

    if (!result.success) {
        // 실패 시 알림 후 팝업 닫기
        const errorMsg = (result.error || '인증에 실패했습니다.')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n');
        return new Response(
            `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>인증 결과</title></head>
<body>
<script>
	alert('${errorMsg}');
	window.close();
</script>
</body>
</html>`,
            {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
        );
    }

    // 성공 시 인증 데이터를 쿠키에 저장 (5분 TTL)
    const certData = JSON.stringify({
        certType: result.certType,
        certNo: result.certNo,
        certHash: result.certHash,
        dupinfo: result.dupinfo,
        name: result.name,
        phone: result.phone,
        birthday: result.birthday,
        adult: result.adult
    });

    cookies.set('pending_cert_data', certData, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: !dev,
        maxAge: 300 // 5분
    });

    // 부모 창에 postMessage로 결과 전달 + 팝업 닫기
    // PHP ini_result.php의 jQuery 기반 opener 통신을 postMessage로 대체
    return new Response(
        `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>인증 결과</title></head>
<body>
<script>
	var certResult = {
		success: true,
		certType: '${result.certType}',
		certNo: '${result.certNo}',
		name: '${result.name.replace(/'/g, "\\'")}',
		phone: '${result.phone}',
		adult: ${result.adult}
	};

	alert('본인인증이 완료되었습니다.');

	if (window.opener) {
		window.opener.postMessage({ type: 'cert_result', data: certResult }, '*');
	}
	window.close();
</script>
</body>
</html>`,
        {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
    );
};
