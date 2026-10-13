if (process.env.GITHUB_ACTIONS !== 'true')
    throw new Error('QA reporting runs on GitHub Actions only.');
const fs = require('node:fs');
const out = process.env.QA_OUTPUT || 'qa-results';
const docs = JSON.parse(fs.readFileSync('scripts/wikiang/fixtures/public-documents.json'))
    .wikiang_pages.rows;
const crawl = fs.existsSync(out + '/crawl.json')
    ? JSON.parse(fs.readFileSync(out + '/crawl.json'))
    : [];
const escape = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
const paths = new Set(docs.map((doc) => doc.path));
const results = docs.map((doc) => {
    const source = doc.content ?? doc.content_raw ?? '';
    const screenshots = crawl.filter((row) => row.id === doc.id);
    const notes = [];
    if (!source.trim()) notes.push('본문 없음');
    if (/Your content here|^#+ Header/m.test(source)) notes.push('작성 예시가 남아 있음');
    if (doc.namespace_id === 0 && source.trim().length < 200)
        notes.push('짧은 문서: 내용 또는 안내 보완 검토');
    if (doc.content_type === 'markdown' && doc.content_raw && doc.content_raw !== source)
        notes.push('이관 원문과 표시용 본문이 다름: 편집 시 표시용 형식 보존');
    if (docs.some((other) => other.id !== doc.id && other.title === doc.title))
        notes.push('같은 제목의 문서 있음: 삭제·병합 전 비교 필요');
    if (doc.path === '/이재명_정부')
        notes.push('정부 이름·임기·내각 서술 간 불일치: 사실관계 검토 필요');
    if (doc.path === '/이재명' || doc.path.endsWith('/정치인/이재명'))
        notes.push('본문 안 출생 정보 등 서로 다른 서술: 출처 대조 필요');
    if (['/대문', '/home', '/wikiang/faq'].includes(doc.path))
        notes.push('현재 기능·편집 정책과 예전 안내 비교 필요');
    const brokenImages = [
        ...new Set(screenshots.flatMap((row) => row.brokenImages.map((img) => img.src)))
    ];
    if (brokenImages.length)
        notes.push('CI에서 외부 이미지 로딩 실패: 삭제·접근 제한·주소 이관 여부 확인 필요');
    const unresolved = [
        ...new Set(
            screenshots.flatMap((row) =>
                row.links
                    .map((link) => link.href)
                    .filter((href) => {
                        if (!href?.startsWith('/') || href.startsWith('//')) return false;
                        let path;
                        try {
                            path = decodeURIComponent(href.split(/[?#]/)[0]);
                        } catch {
                            return true;
                        }
                        return !paths.has(path) && !path.startsWith('/Special:');
                    })
            )
        )
    ];
    return {
        id: doc.id,
        path: doc.path,
        title: doc.title,
        namespace: doc.namespace_id,
        format: doc.content_type,
        chars: source.length,
        checkedWidths: screenshots.map((row) => row.width),
        renderingPassed:
            screenshots.length === 3 &&
            screenshots.every((row) => row.status === 200 && !row.overflow),
        notes,
        brokenImages,
        unresolved
    };
});
fs.writeFileSync(out + '/document-review.json', JSON.stringify(results, null, 2));
fs.writeFileSync(
    out + '/document-review.html',
    `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>위키앙 문서별 QA</title><style>body{font:15px/1.7 system-ui;margin:24px;max-width:1400px}table{width:100%;border-collapse:collapse}td,th{padding:10px;border:1px solid #ddd;text-align:left;vertical-align:top}td{overflow-wrap:anywhere}small{color:#64748b}</style><h1>위키앙 공개 문서 ${docs.length}개 점검</h1><p>375·768·1440px 렌더링 결과와 원문 검토 대상을 구분합니다. 화면 통과는 사실관계의 정확성을 뜻하지 않습니다. 외부 이미지 실패는 CI 네트워크의 접근 제한일 수도 있으며, 없는 문서 링크는 앞으로 작성할 문서를 가리킬 수도 있습니다.</p><table><tr><th>문서</th><th>형식·분량</th><th>화면 검사</th><th>보완 대상</th></tr>${results.map((row) => `<tr><td><a href="https://wikiang.org${row.path.split('/').map(encodeURIComponent).join('/')}">${escape(row.title)}</a><br><small>${escape(row.path)}</small></td><td>${row.format}<br>${row.chars}자</td><td>${row.renderingPassed ? '3개 화면 통과' : escape(row.checkedWidths.join(', ')) || '미실행'}</td><td>${row.notes.map(escape).join('<br>') || '자동 점검에서 별도 표시 없음'}${row.unresolved.length ? `<br>미연결 문서 후보 ${row.unresolved.length}개` : ''}</td></tr>`).join('')}</table></html>`
);
console.log(`Saved per-document review for ${results.length} published documents.`);
