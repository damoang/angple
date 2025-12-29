/**
 * Action Hook: page_loaded
 *
 * 페이지가 로드될 때 실행됩니다.
 * 예시: 페이지 조회수 추적, 분석 데이터 전송 등
 */

export default async function onPageLoad(pageData) {
    console.log('📄 [Sample Theme Hook] Page loaded:', pageData);

    // 예시: 페이지 로드 시간 추적
    if (typeof window !== 'undefined' && window.performance) {
        const loadTime = performance.now();
        console.log(`⏱️ [Sample Theme Hook] Page load time: ${loadTime.toFixed(2)}ms`);
    }

    // 예시: 로컬 스토리지에 방문 기록 저장
    if (typeof localStorage !== 'undefined') {
        const visitCount = parseInt(localStorage.getItem('sample-theme-visits') || '0', 10);
        localStorage.setItem('sample-theme-visits', String(visitCount + 1));
        console.log(`👀 [Sample Theme Hook] Total visits: ${visitCount + 1}`);
    }
}
