/**
 * 자동차 주제 허브 파일럿 (SEO L0) — 차종/주제 화이트리스트.
 * 설계: docs/seo-niche-hub-design-20260731.html
 *
 * 왜 화이트리스트인가: 빈약 허브(thin content) 대량 생성은 도메인 전체 품질을
 * 떨어뜨려 역효과다. GSC 수요 + car 게시판 글 수(2026-07-31 실측)가 확인된
 * 주제만 수동 시드한다. 글 20개 미만 주제는 넣지 않는다.
 *
 * keywords: g5_write_car 제목(wr_subject) LIKE 매칭에 쓰는 동의어.
 *           개별 글을 못 고치므로, 허브가 이 키워드로 글을 모아 정보 랭킹을 잡는다.
 */
export interface CarHubTopic {
    /** URL slug (영문·숫자·하이픈). /car/hub/{slug} */
    slug: string;
    /** 표시명·검색 키워드의 대표값 */
    title: string;
    /** 제목 LIKE 매칭 키워드(대표명 포함) */
    keywords: string[];
    /** 색인용 소개문(1~2문장). thin page 방지 + 문맥 키워드 */
    intro: string;
}

export const CAR_HUB_TOPICS: readonly CarHubTopic[] = [
    {
        slug: 'tesla',
        title: '테슬라',
        keywords: ['테슬라', 'Tesla', '모델Y', '모델3', 'FSD', 'EAP', '오토파일럿'],
        intro: '다모앙 자동차 게시판에 모인 테슬라 오너들의 실사용 후기입니다. 오토파일럿·FSD·EAP 경험, 충전·주행거리, 모델Y·모델3 구매기와 관리 팁을 한곳에서 모아 봅니다.'
    },
    {
        slug: 'ev',
        // ⚠️ 'EV' 같은 2자 ASCII 는 'REVIEW'·'level' 등 과매칭 위험이라 제외.
        // 전기차 글은 '전기차'·차종명(EV6/EV9 은 별도)으로 충분히 잡힌다.
        title: '전기차',
        keywords: ['전기차', '전동화', '충전', '완속', '급속', '보조금'],
        intro: '전기차 오너와 예비 오너들의 실경험을 모았습니다. 충전 인프라·주행거리·유지비·보조금 등 전기차 구매와 운용에 필요한 다모앙 커뮤니티의 생생한 정보입니다.'
    },
    {
        slug: 'ioniq',
        title: '아이오닉',
        keywords: ['아이오닉', 'IONIQ', '아이오닉5', '아이오닉6', '아이오닉9'],
        intro: '현대 아이오닉 시리즈(5·6·9) 오너들의 후기 모음입니다. 충전·주행·V2L·실내 활용 등 아이오닉 실사용 경험을 다모앙에서 확인하세요.'
    },
    {
        slug: 'bmw',
        // 'iX'·'i4' 는 'MIX'·'matrix' 등 과매칭 위험이라 제외. BMW 전기차 글도 'BMW'·'비엠'으로 잡힌다.
        title: 'BMW',
        keywords: ['BMW', '비엠', '520d', '530d', 'X3', 'X5'],
        intro: 'BMW 오너들의 실사용 후기와 정비·관리 경험을 모았습니다. 세단부터 SUV, 전기차 i 시리즈까지 다모앙 자동차 게시판의 BMW 이야기입니다.'
    },
    {
        slug: 'genesis',
        title: '제네시스',
        keywords: ['제네시스', 'Genesis', 'GV70', 'GV80', 'G80', 'G90', 'GV60'],
        intro: '제네시스 오너들의 실사용 후기 모음입니다. G80·G90 세단과 GV70·GV80 SUV, 전동화 GV60까지 다모앙 커뮤니티의 제네시스 경험을 확인하세요.'
    },
    {
        slug: 'benz',
        // 'EQ' 는 'Frequency' 등 과매칭 위험이라 제외. 벤츠 전기차(EQ 라인) 글도 '벤츠'·'메르세데스'로 잡힌다.
        title: '벤츠',
        keywords: ['벤츠', 'Benz', '메르세데스', 'E클래스', 'C클래스', 'GLC'],
        intro: '메르세데스-벤츠 오너들의 실사용 후기와 관리 경험입니다. E·C클래스 세단, GLC SUV, EQ 전기차까지 다모앙 자동차 게시판의 벤츠 이야기.'
    },
    {
        slug: 'volvo',
        title: '볼보',
        keywords: ['볼보', 'Volvo', 'XC60', 'XC90', 'XC40', 'S90'],
        intro: '볼보 오너들의 안전·주행 후기 모음입니다. XC 시리즈 SUV와 세단, 전동화 모델까지 다모앙 커뮤니티의 볼보 실사용 경험을 확인하세요.'
    },
    {
        slug: 'audi',
        title: '아우디',
        keywords: ['아우디', 'Audi', 'A6', 'Q5', 'Q7', 'e-tron', 'e트론'],
        intro: '아우디 오너들의 실사용 후기와 정비 경험입니다. A 시리즈 세단, Q 시리즈 SUV, e-tron 전기차까지 다모앙 자동차 게시판의 아우디 이야기.'
    }
] as const;

/** slug → topic (없으면 undefined) */
export function findCarHubTopic(slug: string): CarHubTopic | undefined {
    return CAR_HUB_TOPICS.find((t) => t.slug === slug);
}
