import type {
    FreePost,
    FreeComment,
    PaginatedResponse,
    MenuItem,
    DamoangUser,
    IndexWidgetsData,
    NewsPost,
    EconomyPost,
    GalleryPost,
    GroupTabsData
} from './types.js';

// Mock 게시글 데이터 생성
function generateMockPost(id: number): FreePost {
    const titles = [
        '다모앙 플랫폼 사용 후기 공유합니다',
        '오늘 점심 뭐 먹을까요? 추천 부탁드려요',
        'SvelteKit 5 업데이트 너무 좋네요!',
        '주말에 갈만한 맛집 추천해주세요',
        '프로그래밍 공부 어떻게 하시나요?',
        '다크모드 디자인 정말 예쁘네요',
        '커뮤니티 활성화를 위한 제안',
        '취미로 시작한 개발, 이제는 직업이 되었습니다',
        '효율적인 코드 리뷰 방법 공유',
        '스타트업에서 일하는 개발자의 하루',
        '리액트 vs 스벨트 비교 후기',
        '원격 근무 꿀팁 공유합니다',
        'TypeScript 타입 잘 쓰는 법',
        'Git 커밋 메시지 작성 가이드',
        'Docker 초보자를 위한 가이드',
        '백엔드 개발자 로드맵 2025',
        'PostgreSQL vs MySQL 어떤게 나을까요?',
        'API 설계 베스트 프랙티스',
        '프론트엔드 성능 최적화 팁',
        '개발자 커뮤니티 모임 후기'
    ];

    const contents = [
        '안녕하세요! 오늘은 제가 경험한 내용을 공유하고자 합니다.\n\n최근에 프로젝트를 진행하면서 많은 것을 배웠는데요, 특히 사용자 경험을 개선하는 부분에서 큰 깨달음을 얻었습니다.\n\n여러분들의 의견도 궁금합니다!',
        '주말에 친구들과 맛집 투어를 다녀왔어요.\n\n정말 맛있는 곳들이 많더라구요. 특히 강남역 근처 파스타집은 정말 강추입니다!\n\n다들 좋은 주말 보내세요~',
        '새로운 기술을 배우는 것은 항상 즐거운 일인 것 같아요.\n\n처음에는 어려워 보였지만, 하나씩 배워가면서 점점 재미있어지더라구요.\n\n포기하지 않고 계속 도전하는 게 중요한 것 같습니다!',
        '요즘 날씨가 정말 좋네요.\n\n이런 날씨에는 밖에 나가서 산책하는 게 최고인 것 같아요.\n\n여러분은 주로 어떻게 시간을 보내시나요?',
        '오늘 하루도 고생 많으셨습니다!\n\n내일은 더 좋은 일만 가득하길 바랍니다.\n\n다들 화이팅!'
    ];

    const authors = [
        '개발자김철수',
        '코딩좋아',
        '프론트엔드마스터',
        '백엔드전문가',
        '풀스택개발자',
        '주니어개발자',
        '시니어개발자',
        '디자이너이영희',
        '기획자박민수',
        '운영자최영수'
    ];

    const tags = [
        ['개발', 'TIP', '공유'],
        ['일상', '음식', '맛집'],
        ['질문', '궁금해요'],
        ['후기', '리뷰'],
        ['기술', '개발'],
        ['프론트엔드', 'JavaScript'],
        ['백엔드', 'Go', 'API'],
        ['데이터베이스', 'PostgreSQL'],
        ['DevOps', 'Docker'],
        ['커리어', '취업']
    ];

    const randomTitle = titles[id % titles.length];
    const randomContent = contents[id % contents.length];
    const randomAuthor = authors[id % authors.length];
    const randomTags = tags[id % tags.length];

    const createdDate = new Date();
    createdDate.setHours(createdDate.getHours() - id * 2);

    return {
        id: String(id),
        title: randomTitle,
        content: randomContent,
        author: randomAuthor,
        author_id: `user_${id % 10}`,
        views: Math.floor(Math.random() * 1000) + 50,
        likes: Math.floor(Math.random() * 100),
        comments_count: Math.floor(Math.random() * 50),
        created_at: createdDate.toISOString(),
        updated_at: createdDate.toISOString(),
        tags: randomTags
    };
}

// 페이지네이션된 Mock 데이터 생성
export function getMockFreePosts(page = 1, limit = 20): PaginatedResponse<FreePost> {
    const total = 100; // 전체 게시글 수
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;

    const posts: FreePost[] = [];
    for (let i = 0; i < limit && startIndex + i < total; i++) {
        posts.push(generateMockPost(startIndex + i + 1));
    }

    return {
        items: posts,
        total,
        page,
        limit,
        total_pages: totalPages
    };
}

// 단일 게시글 Mock 데이터
export function getMockFreePost(id: string): FreePost {
    const numId = parseInt(id) || 1;
    const post = generateMockPost(numId);

    // 상세 페이지용으로 더 긴 내용 추가
    post.content = `# ${post.title}

안녕하세요, ${post.author}입니다.

## 서론

오늘은 제가 경험한 내용을 자세히 공유하고자 합니다. 이 글을 통해 여러분들에게 조금이나마 도움이 되었으면 좋겠습니다.

## 본론

최근에 프로젝트를 진행하면서 많은 것을 배웠는데요, 특히 다음과 같은 부분에서 큰 깨달음을 얻었습니다:

1. **사용자 경험의 중요성**: 기술적으로 완벽한 기능보다, 사용자가 편하게 느끼는 것이 더 중요합니다.
2. **코드 가독성**: 나중에 유지보수할 때를 생각하면, 처음부터 깔끔하게 작성하는 것이 중요합니다.
3. **팀워크**: 혼자 잘하는 것보다, 팀원들과 잘 협업하는 것이 더 중요합니다.

## 결론

이런 경험들을 통해 한 단계 성장할 수 있었습니다. 여러분들도 비슷한 경험이 있으신가요?

댓글로 의견 공유 부탁드립니다!

감사합니다. 😊`;

    return post;
}

// Mock 댓글 데이터 생성
function generateMockComment(id: number, depth: number): FreeComment {
    const contents = [
        '와, SvelteKit 5를 쓰셨다니 대단합니다! 특히 ‘프리렌더링’ 기능이 실제로 얼마나 빠른지 궁금하네요.\n\n혹시 첫 번째 페이지 로딩 시간이 30% 감소한 사례가 있나요?',
        '저도 비슷한 프로젝트를 진행 중인데, ‘타이핑 시 자동완성’ 구현이 어려웠어요. 혹시 어떤 UI 라이브러리를 쓰셨나요?',
        '혹시 비동기 데이터 fetching을 위해 SvelteKit의 load 함수 대신 store를 사용한 경험이 있으신가요?',
        '사용자 경험을 개선했다고 하셨는데, A/B 테스트를 진행하신 적이 있나요? 혹은 사용자 피드백을 수집하기 위해 설계한 설문 도구가 있나요?',
        '새로운 기술을 배우는 과정이 즐거웠다니 다행이에요. 혹시 SvelteKit 5에서 가장 인상 깊었던 기능은 무엇이었나요?'
    ];

    const authors = [
        '개발자김철수',
        '코딩좋아',
        '프론트엔드마스터',
        '백엔드전문가',
        '풀스택개발자',
        '주니어개발자',
        '시니어개발자',
        '디자이너이영희',
        '기획자박민수',
        '운영자최영수'
    ];

    const randomContent = contents[id % contents.length];
    const randomAuthor = authors[id % authors.length];

    const createdDate = new Date();
    createdDate.setHours(createdDate.getHours() - id * 2);

    return {
        id: String(id + 1),
        content: randomContent,
        author: randomAuthor,
        author_id: `user_${id % 10}`,
        likes: Math.floor(Math.random() * 100),
        depth: depth,
        parent_id: '',
        created_at: createdDate.toISOString(),
        updated_at: createdDate.toISOString()
    };
}

// 페이지네이션된 Mock 댓글 데이터 생성
export function getMockFreeComments(page = 1, limit = 50): PaginatedResponse<FreeComment> {
    const total = 100; // 전체 게시글 수
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;

    const commentReplies = [
        {
            author: 1,
            content:
                '첫 페이지 로딩 시간은 약 2.8초에서 1.9초로 감소했어요. prerender와 endpoint 최적화 덕분이죠.'
        },
        {
            author: 0,
            content:
                '아주 인상적인 수치네요. 혹시 prerender를 활용한 특정 페이지가 가장 크게 개선되었다면 그 예시를 공유해 주실 수 있을까요?\n\n또한, endpoint 최적화에서 가장 효과적이었던 기법은 무엇인지 궁금합니다.'
        },
        {
            author: 1,
            content:
                '정적 페이지를 prerender하면 서버 부하가 0이 되고, CDN에서 바로 서빙되므로 사용자에게는 눈에 띄는 차이가 생깁니다.\n\n그리고, endpoint 최적화에서 가장 먼저 적용할 것은 ‘캐시 헤더’와 ‘데이터 최소화’입니다. 두 가지만으로도 30–40 %의 로딩 속도 향상을 기대할 수 있어요.'
        },
        {
            author: 0,
            content: '와, 놀랍군요. 좋은 정보 감사합니다!'
        }
    ];

    const comments: FreeComment[] = [];
    for (let i = 0; i < limit && startIndex + i < total; i++) {
        const comment = generateMockComment(startIndex + i, 0);
        comments.push(comment);

        // 0번째 댓글에 대댓글 생성
        if (startIndex + i === 0) {
            for (let j = 0; j < commentReplies.length; j++) {
                const author = commentReplies[j].author ? '풀스택개발자' : comment.author;
                const authorId = commentReplies[j].author ? 'user_1000' : comment.author_id;

                const createdDate = new Date();
                createdDate.setHours(createdDate.getHours() + (i + j) * 2 + 1);
                comments.push({
                    id: String(i + j),
                    content: commentReplies[j].content,
                    author: author,
                    author_id: authorId,
                    likes: Math.floor(Math.random() * 100),
                    depth: j + 1,
                    parent_id: comment.id,
                    created_at: createdDate.toISOString(),
                    updated_at: createdDate.toISOString()
                });
            }
        }
    }

    return {
        items: comments,
        total,
        page,
        limit,
        total_pages: totalPages
    };
}

// 사이드바 메뉴 Mock 데이터
export function getMockMenus(): MenuItem[] {
    return [
        {
            id: 1,
            title: '커뮤니티',
            url: '#',
            icon: 'MessageSquare',
            depth: 0,
            order_num: 1,
            target: '_self',
            show_in_header: true,
            show_in_sidebar: true,
            children: [
                {
                    id: 11,
                    parent_id: 1,
                    title: '자유게시판',
                    url: '/free',
                    icon: 'Circle',
                    depth: 1,
                    order_num: 1,
                    target: '_self',
                    show_in_header: false,
                    show_in_sidebar: true
                },
                {
                    id: 12,
                    parent_id: 1,
                    title: '질문/답변',
                    url: '/qna',
                    icon: 'CircleHelp',
                    depth: 1,
                    order_num: 2,
                    target: '_self',
                    show_in_header: false,
                    show_in_sidebar: true
                }
            ]
        },
        {
            id: 2,
            title: '소모임',
            url: '#',
            icon: 'Users',
            depth: 0,
            order_num: 2,
            target: '_self',
            show_in_header: true,
            show_in_sidebar: true,
            children: [
                {
                    id: 21,
                    parent_id: 2,
                    title: '전체 소모임',
                    url: '/groups',
                    icon: 'Circle',
                    depth: 1,
                    order_num: 1,
                    target: '_self',
                    show_in_header: false,
                    show_in_sidebar: true
                }
            ]
        },
        {
            id: 3,
            title: '갤러리',
            url: '/gallery',
            icon: 'Images',
            depth: 0,
            order_num: 3,
            target: '_self',
            show_in_header: true,
            show_in_sidebar: true
        },
        {
            id: 4,
            title: '알뜰구매',
            url: '/economy',
            icon: 'ShoppingCart',
            depth: 0,
            order_num: 4,
            target: '_self',
            show_in_header: true,
            show_in_sidebar: true
        }
    ];
}

// 현재 사용자 Mock 데이터
export function getMockCurrentUser(): DamoangUser | null {
    // 로그인 상태 시뮬레이션: 50% 확률로 로그인 사용자 반환
    if (Math.random() > 0.5) {
        return {
            mb_id: 'mockuser',
            mb_name: 'Mock 사용자',
            mb_level: 10,
            mb_email: 'mock@damoang.dev'
        };
    }
    return null; // 비로그인 상태
}

// 인덱스 위젯 Mock 데이터
export function getMockIndexWidgets(): IndexWidgetsData {
    // 새로운 소식 탭 데이터
    const news_tabs: NewsPost[] = [
        {
            id: 1,
            title: 'SvelteKit 5 정식 출시!',
            board: 'news',
            board_name: '새소식',
            author: '관리자',
            created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            comment_count: 15,
            view_count: 234,
            recommend_count: 45,
            url: '/news/1',
            is_notice: true,
            tab: 'new'
        },
        {
            id: 2,
            title: 'Vite 7.0 업데이트 가이드',
            board: 'tips',
            board_name: '팁/노하우',
            author: '개발자김철수',
            created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            comment_count: 8,
            view_count: 156,
            recommend_count: 23,
            url: '/tips/2',
            is_notice: false,
            tab: 'tip'
        },
        {
            id: 3,
            title: 'Tailwind CSS 4.0 사용 후기',
            board: 'reviews',
            board_name: '후기/리뷰',
            author: '프론트엔드마스터',
            created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
            comment_count: 12,
            view_count: 189,
            recommend_count: 31,
            url: '/reviews/3',
            is_notice: false,
            tab: 'review'
        }
    ];

    // 알뜰구매 탭 데이터
    const economy_tabs: EconomyPost[] = [
        {
            id: 1,
            title: '맥북 프로 M4 최저가 정보',
            url: '/economy/1',
            tab: 'economy',
            author: '가성비왕'
        },
        {
            id: 2,
            title: '개발자를 위한 의자 추천',
            url: '/economy/2',
            tab: 'economy',
            author: '알뜰구매'
        },
        {
            id: 3,
            title: '모니터 구매 시 체크사항?',
            url: '/qna/3',
            tab: 'qa',
            author: '질문왕'
        },
        {
            id: 4,
            title: '중고 거래 안전 팁',
            url: '/free/4',
            tab: 'free',
            author: '베테랑'
        }
    ];

    // 갤러리 데이터
    const gallery: GalleryPost[] = [
        {
            id: 1,
            title: '내 작업실 셋업 공유',
            url: '/gallery/1',
            thumbnail_url: 'https://picsum.photos/seed/1/400/300',
            author: '디자이너이영희',
            comment_count: 18,
            view_count: 342,
            recommend_count: 56,
            created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString()
        },
        {
            id: 2,
            title: '개발자 데스크 투어',
            url: '/gallery/2',
            thumbnail_url: 'https://picsum.photos/seed/2/400/300',
            author: '개발자김철수',
            comment_count: 24,
            view_count: 456,
            recommend_count: 78,
            created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString()
        },
        {
            id: 3,
            title: '키보드 커스텀 완성!',
            url: '/gallery/3',
            thumbnail_url: 'https://picsum.photos/seed/3/400/300',
            author: '키보드매니아',
            comment_count: 31,
            view_count: 589,
            recommend_count: 92,
            created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString()
        },
        {
            id: 4,
            title: '미니멀 셋업 완성',
            url: '/gallery/4',
            thumbnail_url: 'https://picsum.photos/seed/4/400/300',
            author: '미니멀리스트',
            comment_count: 15,
            view_count: 267,
            recommend_count: 43,
            created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString()
        }
    ];

    // 소모임 탭 데이터
    const group_tabs: GroupTabsData = {
        all: [
            {
                id: 1,
                title: '같이 스터디하실 분!',
                url: '/group/1',
                recommend_count: 12,
                author: '공부왕'
            },
            {
                id: 2,
                title: '주말 코딩 모임',
                url: '/group/2',
                recommend_count: 8,
                author: '코딩좋아'
            }
        ],
        '24h': [
            {
                id: 3,
                title: '오늘 저녁 맛집 추천',
                url: '/group/3',
                recommend_count: 15,
                author: '맛집탐방가'
            }
        ],
        week: [
            {
                id: 4,
                title: '이번 주 독서모임',
                url: '/group/4',
                recommend_count: 6,
                author: '책벌레'
            }
        ],
        month: [
            {
                id: 5,
                title: '월간 프로젝트 공유',
                url: '/group/5',
                recommend_count: 20,
                author: '프로젝트매니아'
            }
        ]
    };

    return {
        news_tabs,
        economy_tabs,
        gallery,
        group_tabs
    };
}
