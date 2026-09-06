/**
 * 읽은 글 표시 기능 스토어
 *
 * localStorage(L1) 기반으로 읽은 글 ID를 저장하고 관리합니다.
 * 최대 MAX_ENTRIES개까지 유지하며, 오래된 것은 자동 삭제됩니다.
 *
 * 로그인 회원은 서버 read-set(L2, Redis)을 병합해 기기·브라우저 간 읽음이
 * 일관되게 표시됩니다(메일 인앱브라우저·타기기 크로스기기). L1은 즉시 반응·
 * 오프라인·비로그인 용도로 유지하고, L2는 mergeServerReadPosts()로 합칩니다.
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'angple_read_posts';

/**
 * L1(localStorage) 보관 상한.
 *
 * ⛔ 개수 상한은 구조적으로 "많이 읽는 사람이 벌 받는" 방식이다. 같은 2,000개라도
 *    담기는 기간은 실측에서 17일 / 46일 / 65일로 4배 가까이 벌어졌다(하루 118개
 *    읽는 회원은 17일치밖에 못 남긴다). 「본 글이 자꾸 초기화된다」 제보의 실제 원인이
 *    이것이고, LRU 축출(evicted_keys 0)도 TTL 만료(179일 잔여)도 아니었다.
 *
 * 2026-09-07 Redis 실측: rp: 키 23,149명 중 25%(표본 400명 기준 100명)가 정확히
 * 2,000개로 포화. 제보자도 2,000개 포화.
 *
 * 10,000으로 올린 근거 — 저장 비용은 브라우저 쪽에만 붙는다:
 *   직렬화 크기 2,000개 58KB → 10,000개 291KB(UTF-16 실점유 약 0.57MB)
 *   = 브라우저 한도 5~10MB의 6~11%. 이 origin의 다른 localStorage 키는 전부
 *     설정값(테마·폰트·밀도)이라 용량 경합이 없다.
 *   헤비 유저(118개/일) 기준 17일 → 85일치로 늘어난다.
 *
 * ⛔ 서버(L2, lib/server/read-posts.ts의 MAX_READ_ENTRIES)는 2,000 그대로 둔다.
 *    Redis rp: 총량이 이미 422MB로 인스턴스 613MB의 72%(maxmemory 2GB)라,
 *    5,000이면 +355MB · 10,000이면 +948MB로 한도에 붙어 allkeys-lru가 발동한다.
 *    즉 "주 기기에서는 10,000개를 기억하고, 서버 비용은 0"이 이 변경의 요지다.
 *    기기를 바꾸면 최근 2,000개가 이어지는데 그건 지금과 동일하다.
 */
const MAX_ENTRIES = 10000;

/**
 * 쿼터 초과 시 축소 재시도의 하한.
 * 여기까지 줄여도 저장이 안 되면 저장 자체가 막힌 환경(사파리 프라이빗 등)으로 본다.
 */
const QUOTA_MIN_ENTRIES = 500;

interface ReadPostsData {
    // postId를 key로, timestamp를 value로 저장 (FIFO 삭제용)
    posts: Record<string, number>;
}

function createReadPostsStore() {
    let data = $state<ReadPostsData>({ posts: {} });

    // 브라우저에서만 localStorage 로드
    if (browser) {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                data = JSON.parse(stored);
            }
        } catch {
            // localStorage 접근 실패 시 무시
        }
    }

    function trySave(posts: Record<string, number>): boolean {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ posts }));
            return true;
        } catch {
            return false;
        }
    }

    /** timestamp 내림차순으로 최신 limit개만 담은 새 객체를 만든다(원본 불변). */
    function newestSnapshot(limit: number): Record<string, number> {
        const entries = Object.entries(data.posts);
        entries.sort((a, b) => b[1] - a[1]);
        return Object.fromEntries(entries.slice(0, limit));
    }

    /**
     * 저장. 쿼터 초과면 상한을 절반씩 낮춰 재시도한다.
     *
     * ⛔ 종전 구현은 setItem 실패를 그냥 삼켰다. 그러면 메모리에는 최신 목록이 남지만
     *    localStorage에는 "마지막으로 성공한 시점"이 남아, 새로고침하는 순간 그 시점으로
     *    되돌아간다. 회원 눈에는 정확히 「또 초기화됐다」로 보인다. 2,000 → 10,000으로
     *    올리면 저장량이 5배가 되니 이 경로에 걸릴 여지도 그만큼 커진다.
     *
     * 그래서 실패하면 오래된 것부터 잘라낸 사본으로 다시 쓴다.
     *
     * ⛔ 메모리(data)는 "실제로 저장에 성공한 내용"으로만 맞춘다. 잘라내기부터 하고
     *    쓰면, 쿼터가 아니라 저장 자체가 막힌 환경(사파리 프라이빗 등 setItem이 항상
     *    throw)에서 저장은 여전히 실패한 채 메모리만 500개로 깎여 이번 세션 표시까지
     *    잃는다. 사본으로 시도해서 성공한 것만 반영하면 메모리와 저장소가 어긋나지도
     *    않고(=위의 "되돌아감"이 안 생기고) 저장 불가 환경에서도 세션 표시는 살아남는다.
     */
    function save(): void {
        if (!browser) return;
        if (trySave(data.posts)) return;

        for (
            let limit = Math.floor(MAX_ENTRIES / 2);
            limit >= QUOTA_MIN_ENTRIES;
            limit = Math.floor(limit / 2)
        ) {
            const snapshot = newestSnapshot(limit);
            if (trySave(snapshot)) {
                data.posts = snapshot;
                return;
            }
        }
        // 여기까지 오면 저장 불가 환경. 메모리 data는 건드리지 않는다.
    }

    /** timestamp 오름차순으로 오래된 것부터 잘라 limit개만 남긴다. */
    function pruneOldest(limit: number): void {
        const entries = Object.entries(data.posts);
        if (entries.length <= limit) return;

        entries.sort((a, b) => a[1] - b[1]);
        const toRemove = entries.slice(0, entries.length - limit);

        for (const [key] of toRemove) {
            delete data.posts[key];
        }
    }

    /**
     * 상한 초과분 정리.
     *
     * ⛔ 종전 구현은 Object.entries()를 먼저 만들고 나서 길이를 비교했다. 상한에 안 걸리는
     *    대부분의 호출에서도 10,000쌍짜리 배열을 매번 새로 할당한다는 뜻이다.
     *    Node 22 실측(10,000개 기준): Object.entries().length 2.402ms vs
     *    Object.keys().length 0.852ms → 가드만 바꿔서 2.8배 싸졌다.
     *
     * 정렬 자체 비용(측정치, 10,000개):
     *   Object.entries + sort           2.601ms   (2,000개일 때 0.383ms)
     *   포화 상태 markAsRead 1회 전체     8.364ms   (spread 2.997 + sort 2.601 + stringify 2.512)
     * 이 8.4ms는 목록 렌더가 아니라 "글을 연 시점"에 한 번 드는 비용이다. 목록에서 쓰는
     * isRead()는 `key in` 이라 O(1)이고, getReadPostIds()는 현재 호출부가 없다.
     * 저사양 단말(CPU 4배 스로틀 가정) 환산 ~33ms이나 이미 네트워크 요청이 붙는
     * 핸들러라 렌더를 막는 수준은 아니라고 보고 정렬 구조는 그대로 둔다.
     *
     * ⛔ 초과 시 MAX*0.9까지 미리 내려두는 고수위 방식도 재봤는데 8.364ms → 6.199ms에
     *    그쳤다. 지배 비용이 정렬이 아니라 매 호출 무조건 드는 spread + stringify라서다.
     *    복잡도 대비 이득이 없어 채택하지 않았다.
     */
    function cleanup(): void {
        if (Object.keys(data.posts).length <= MAX_ENTRIES) return;
        pruneOldest(MAX_ENTRIES);
    }

    return {
        /**
         * 글을 읽음으로 표시
         * @param boardId 게시판 ID
         * @param postId 게시글 ID
         */
        markAsRead(boardId: string, postId: number): void {
            const key = `${boardId}:${postId}`;
            data.posts = { ...data.posts, [key]: Date.now() };
            cleanup();
            save();
        },

        /**
         * 글을 읽었는지 확인
         * @param boardId 게시판 ID
         * @param postId 게시글 ID
         */
        isRead(boardId: string, postId: number): boolean {
            const key = `${boardId}:${postId}`;
            return key in data.posts;
        },

        /**
         * 특정 게시판의 읽은 글 목록 조회
         * @param boardId 게시판 ID
         */
        getReadPostIds(boardId: string): Set<number> {
            const prefix = `${boardId}:`;
            const result = new Set<number>();

            for (const key of Object.keys(data.posts)) {
                if (key.startsWith(prefix)) {
                    const postId = parseInt(key.slice(prefix.length), 10);
                    if (!isNaN(postId)) {
                        result.add(postId);
                    }
                }
            }

            return result;
        },

        /**
         * 서버 read-set(L2)을 로컬(L1)에 병합
         *
         * 로그인 시 /api/read-posts 응답(`boardId:postId` 키 배열)을 받아
         * 로컬에 없는 항목만 추가합니다. 기존 로컬 항목의 timestamp는 보존해
         * "방금 읽음"이 서버 병합으로 밀려나지 않도록 합니다.
         *
         * 서버 응답은 L2 상한 그대로 최대 2,000개다. 병합분은 아래에서 로컬 최소
         * timestamp보다 낮은 값을 받으므로, 합친 뒤 상한을 넘으면 병합분이 먼저 잘린다.
         * ⛔ 즉 로컬이 상한에 포화해 있으면 이 병합은 사실상 no-op이었다. 상한이 2,000이던
         *    시절에는 포화 회원이 25%였으니 그 회원들에게는 크로스기기 병합이 아예 닿지
         *    않았다는 뜻이다. 상한을 10,000으로 올리면 로컬 여유가 생겨 병합분이 실제로
         *    남는다(10,000 + 최대 2,000 = 12,000 → cleanup으로 10,000까지 정리).
         * @param keys `boardId:postId` 형식 키 배열 (서버 최신순)
         */
        mergeServerReadPosts(keys: string[]): void {
            if (!Array.isArray(keys) || keys.length === 0) return;
            const next = { ...data.posts };
            // 병합 항목은 로컬 최소 timestamp보다 아래로 부여 → cleanup 시 로컬(실제
            // 최근 읽음)을 우선 보존하고 서버 병합분이 먼저 밀려나게 한다.
            // 서버는 최신순이므로 index 0이 가장 높고(=base) 이후 감소해 순서 보존.
            let localMin = Number.POSITIVE_INFINITY;
            for (const ts of Object.values(next)) {
                if (ts < localMin) localMin = ts;
            }
            const base = (Number.isFinite(localMin) ? localMin : Date.now()) - 1;
            let added = 0;
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (typeof key !== 'string' || !key.includes(':')) continue;
                if (key in next) continue; // 로컬에 있으면 로컬 timestamp 유지
                next[key] = base - i;
                added++;
            }
            if (added === 0) return;
            data.posts = next;
            cleanup();
            save();
        },

        /**
         * 모든 읽은 글 기록 삭제
         */
        clear(): void {
            data = { posts: {} };
            save();
        },

        /**
         * 저장된 글 개수
         */
        get count(): number {
            return Object.keys(data.posts).length;
        }
    };
}

export const readPostsStore = createReadPostsStore();
