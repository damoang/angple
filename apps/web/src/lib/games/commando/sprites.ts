/**
 * 다모앙 특공대 그림 — 외부 그림 파일 없이 코드 안 픽셀 아트. DOM 없음(그리기는 화면 컴포넌트).
 *
 * - 한 글자 = 한 픽셀. '.' 는 빈칸, 나머지 글자는 PALETTE 의 색.
 * - 공용 팔레트 16색. 아군 = 다모앙 색(청록·노랑·파랑), 적 = 붉은 계열.
 * - 캐릭터 24×24, 타일 16×16. 모두 오른쪽을 보고 그렸다(왼쪽은 좌우 뒤집어 그린다).
 * - 대원은 윗몸(14줄)과 다리(10줄)를 따로 그려 합친다 — 달리기 4프레임 × 조준 2가지를 다 그리지 않아도 된다.
 *   엎드리기는 윗몸을 8줄 내리고 아래 2줄에 굽힌 다리(2프레임)를 붙인다.
 */

/** 공용 팔레트 — 글자 → 색 (16색) */
export const PALETTE: Record<string, string> = {
    k: '#1b1a2e', // 외곽선
    w: '#fff7ea', // 밝은 빛
    s: '#f6c9a0', // 피부
    S: '#d9946b', // 피부 그늘
    g: '#3fa7a0', // 아군 옷(청록)
    G: '#2a6f73', // 아군 옷 그늘·풀 그늘
    y: '#f2b544', // 다모앙 노랑
    b: '#5b8fd9', // 아군 바지(파랑)
    r: '#e04f5f', // 적 옷·볼
    R: '#9e2f45', // 적 옷 그늘
    m: '#8a8fa3', // 쇠(총)
    o: '#b5763a', // 나무
    O: '#7a4a26', // 나무 그늘·장화
    e: '#6bbf59', // 풀
    d: '#5a4a3e', // 흙
    c: '#bfe3f2' // 하늘
};

export const CHAR_SIZE = 24;
export const TILE_SIZE = 16;

/* ── 대원 윗몸 (14줄 × 24) ── */

/** 앞으로 조준 — 총구는 (22, 11) 근처 */
export const UPPER_FORWARD = [
    '........................',
    '.........kkkkkk.........',
    '.......kkggggggkk.......',
    '......kggggggggggk......',
    '......kyyyyyyyyyyk......',
    '.....kGGsssssssssk......',
    '.....ksssssskskssk......',
    '.....ksssssskskssk......',
    '.....kSssssssssrsk......',
    '......kSsssssssssk......',
    '.......kkyyyyyykk.......',
    '......kgggggyykmmmmmmk..',
    '......kgggggsskmmmmmmk..',
    '......kGGGGGGkkkk.......'
];

/** 위로 조준 — 총은 19열, 총구는 맨 위 */
export const UPPER_UP = [
    '..................kmk...',
    '.........kkkkkk...kmk...',
    '.......kkggggggkk.kmk...',
    '......kggggggggggkkmk...',
    '......kyyyyyyyyyykkmk...',
    '.....kGGssssssssskkmk...',
    '.....ksssssskskssskmk...',
    '.....ksssssskskssskmk...',
    '.....kSssssssssrskkmk...',
    '......kSsssssssssksk....',
    '.......kkyyyyyykksk.....',
    '......kgggggyygggkk.....',
    '......kgggggggggk.......',
    '......kGGGGGGkkkk.......'
];

/* ── 대원 다리 (10줄 × 24, 그림의 14~23줄) ── */

export const LEGS_STAND = [
    '......kbbbbbbbk.........',
    '......kbbbbbbbk.........',
    '......kbbbkbbbk.........',
    '......kbbbkbbbk.........',
    '......kbbbkbbbk.........',
    '......kbbbkbbbk.........',
    '......kbbk.kbbk.........',
    '......kOOk.kOOk.........',
    '......kOOOkkOOOk........',
    '......kkkkkkkkkk........'
];

/** 달리기 4프레임 */
export const LEGS_RUN = [
    [
        '......kbbbbbbbk.........',
        '......kbbbbbbbbk........',
        '.....kbbbk.kbbbk........',
        '....kbbbk...kbbbk.......',
        '...kbbbk.....kbbbk......',
        '..kbbbk.......kbbk......',
        '..kkkk........kbbk......',
        '.kOOOk........kOOk......',
        '.kkkk.........kOOOk.....',
        '..............kkkkk.....'
    ],
    [
        '......kbbbbbbbk.........',
        '......kbbbbbbbk.........',
        '.......kbbbbbk..........',
        '.......kbbkbbk..........',
        '......kbbk.kbbk.........',
        '......kbbk..kbbk........',
        '.....kbbk...kbbk........',
        '.....kOOk...kOOOk.......',
        '....kOOk....kkkkk.......',
        '....kkk.................'
    ],
    [
        '......kbbbbbbbk.........',
        '......kbbbbbbbbk........',
        '......kbbbkkbbbk........',
        '.....kbbbk..kbbbk.......',
        '....kbbbk....kbbbk......',
        '...kbbk.......kbbbk.....',
        '...kOOk........kbbk.....',
        '..kOOk.........kOOOk....',
        '..kkk..........kkkkk....',
        '........................'
    ],
    [
        '......kbbbbbbbk.........',
        '......kbbbbbbbk.........',
        '.......kbbbbbk..........',
        '.......kbbkbbk..........',
        '.......kbbkbbk..........',
        '......kbbk.kbbk.........',
        '......kbbk.kbbk.........',
        '.....kOOOk.kOOk.........',
        '.....kkkkk.kOOOk........',
        '...........kkkkk........'
    ]
];

/** 점프 2프레임 — 0 = 오르는 중(다리 접음), 1 = 내려가는 중(다리 뻗음) */
export const LEGS_JUMP = [
    [
        '......kbbbbbbbk.........',
        '......kbbbbbbbbk........',
        '......kbbbbbbbbbk.......',
        '.......kbbbkkbbbk.......',
        '........kbbk.kbbk.......',
        '........kOOk.kOOOk......',
        '........kkkk.kkkkk......',
        '........................',
        '........................',
        '........................'
    ],
    [
        '......kbbbbbbbk.........',
        '......kbbbbbbbk.........',
        '......kbbbkbbbk.........',
        '.....kbbbk.kbbbk........',
        '.....kbbk...kbbk........',
        '....kbbk....kbbk........',
        '....kOOk....kOOOk.......',
        '....kkkk....kkkkk.......',
        '........................',
        '........................'
    ]
];

/** 엎드리기 다리 2프레임 (2줄 × 24, 그림의 22~23줄) */
export const LEGS_CROUCH = [
    ['.....kbbbbbbbbbbk.......', '....kOOOkkkkkOOOk.......'],
    ['......kbbbbbbbbbk.......', '.....kOOOkkkkOOOk.......']
];

/** 엎드리면 윗몸이 내려가는 줄 수 */
export const CROUCH_DROP = 8;

/**
 * 대원 한 장(24×24)을 합친다.
 * crouch 가 있으면 윗몸을 CROUCH_DROP 줄 내리고 맨 아래 2줄에 굽힌 다리를 붙인다.
 */
export function composeSoldier(
    upper: string[],
    legs: string[] | null,
    crouch?: string[]
): string[] {
    const blank = '.'.repeat(CHAR_SIZE);
    if (crouch) {
        const rows: string[] = [];
        for (let r = 0; r < CROUCH_DROP; r++) rows.push(blank);
        for (const line of upper) rows.push(line);
        for (const line of crouch) rows.push(line);
        return rows.slice(0, CHAR_SIZE);
    }
    const rows = upper.slice();
    for (const line of legs ?? []) rows.push(line);
    while (rows.length < CHAR_SIZE) rows.push(blank);
    return rows;
}

/**
 * 공중에서 아래로 쏘기 2프레임(24×24 한 장씩) — 0 = 오르는 중(다리 접음), 1 = 내려가는 중(다리 벌림).
 * 총은 몸 가운데(11~12열)에서 아래로 — 총알이 나가는 자리(engine.muzzle: 가운데, 발 아래)와 맞춘다.
 */
export const AIR_DOWN = [
    [
        '........................',
        '.........kkkkkk.........',
        '.......kkggggggkk.......',
        '......kggggggggggk......',
        '......kyyyyyyyyyyk......',
        '.....kGGsssssssssk......',
        '.....ksssssssssssk......',
        '.....ksssssskskssk......',
        '.....kSssssskskrsk......',
        '......kSsssssssssk......',
        '.......kkyyyyyykk.......',
        '......kgggsskkssggk.....',
        '......kgggskmmksggk.....',
        '......kGGGGkmmkGGGk.....',
        '......kbbbbkmmkbbbk.....',
        '.....kbbbbbkmmkbbbbk....',
        '.....kbbk.kkmmkk.kbbk...',
        '......kOOk.kmmk.kOOk....',
        '......kkkk.kmmk.kkkk....',
        '...........kmmk.........',
        '............kk..........',
        '........................',
        '........................',
        '........................'
    ],
    [
        '........................',
        '.........kkkkkk.........',
        '.......kkggggggkk.......',
        '......kggggggggggk......',
        '......kyyyyyyyyyyk......',
        '.....kGGsssssssssk......',
        '.....ksssssssssssk......',
        '.....ksssssskskssk......',
        '.....kSssssskskrsk......',
        '......kSsssssssssk......',
        '.......kkyyyyyykk.......',
        '......kgggsskkssggk.....',
        '......kgggskmmksggk.....',
        '......kGGGGkmmkGGGk.....',
        '.....kbbbbbkmmkbbbbk....',
        '....kbbbbbbkmmkbbbbbk...',
        '...kbbbk...kmmk..kbbbk..',
        '..kbbbk....kmmk...kbbbk.',
        '..kbbk.....kmmk....kbbk.',
        '..kOOk.....kmmk....kOOk.',
        '.kOOOk......kk.....kOOOk',
        '.kkkkk.............kkkkk',
        '........................',
        '........................'
    ]
];

/* ── 적 (24×24, 붉은 계열, 오른쪽을 보고 그림) — 윗몸 16줄 + 다리 8줄 ── */

/** 보병 윗몸 — 붉은 철모, 어깨에 붙인 총. 총구는 6줄 오른쪽 끝(발에서 18px 위 = ENEMY_SHOT_Y) */
export const RIFLE_TOP = [
    '........................',
    '.......kkkkkkk..........',
    '.....kkRRRRRRRkk........',
    '....kRRRRRRRRRRRk.......',
    '....kRRwRRRRRRRRk.......',
    '...kkkkkkkkkkkkkkk......',
    '....ksssssssskmmmmmmmmmk',
    '....ksssskskskkkmkkkkkk.',
    '....ksssskskssk.........',
    '....kSssssssrsk.........',
    '.....kSsssssssk.........',
    '......kkkkkkkk..........',
    '.....kRrrrrrsskk........',
    '....kRrrrrrrrskmk.......',
    '....kRrrrrrrrrk.........',
    '....kkkkkkkkkkk.........'
];

/** 투척병 윗몸 — 방울 달린 털모자, 수류탄 주머니 */
export const THROWER_TOP = [
    '..........kk............',
    '.........kwwk...........',
    '.......kkkRRkkk.........',
    '......kRRRRRRRRk........',
    '.....kRrRrRrRrRRk.......',
    '.....kkkkkkkkkkkk.......',
    '.....kssssssssssk.......',
    '.....ksssssksksk........',
    '.....ksssssksksk........',
    '.....kSsssssssrk........',
    '......kSssssssk.........',
    '.......kkkkkkk..........',
    '.....kRrrrrrrrRk........',
    '....kRrkOOOkrrrRk.......',
    '...ksRrkOOOkrrrRsk......',
    '....kkkkkkkkkkkkk.......'
];

/** 투척병 던지기 직전 — 뒤로 든 손에 수류탄 */
export const THROWER_WINDUP = [
    '.kkkk.....kk............',
    'kRrRRk...kwwk...........',
    'kRRRRk.kkkRRkkk.........',
    '.kkkkkkRRRRRRRRk........',
    '...kskRrRrRrRrRRk.......',
    '...kskkkkkkkkkkkk.......',
    '....kskssssssssssk......',
    '.....kssssssksksk.......',
    '.....ksssssksksk........',
    '.....kSsssssssrk........',
    '......kSssssssk.........',
    '.......kkkkkkk..........',
    '.....kRrrrrrrrRk........',
    '....kRrkOOOkrrrRk.......',
    '....kRrkOOOkrrrRsk......',
    '....kkkkkkkkkkkkk.......'
];

/** 적 다리 — 서기 */
export const ENEMY_LEGS_STAND = [
    '.....kRRRkRRRk..........',
    '.....kRRRkRRRk..........',
    '.....kRRk.kRRk..........',
    '.....kRRk.kRRk..........',
    '.....kRRk.kRRk..........',
    '.....kkkk.kkkk..........',
    '....kdddk.kdddk.........',
    '....kkkkk.kkkkk.........'
];

/** 적 다리 — 걷기 2프레임 */
export const ENEMY_LEGS_WALK = [
    [
        '.....kRRRkRRRk..........',
        '.....kRRRkRRRRk.........',
        '....kRRk...kRRk.........',
        '....kRRk....kRRk........',
        '...kRRk.....kRRk........',
        '...kkkk......kkkk.......',
        '..kdddk......kdddk......',
        '..kkkkk......kkkkk......'
    ],
    [
        '.....kRRRkRRRk..........',
        '......kRRRRRk...........',
        '......kRRkRRk...........',
        '......kRRkRRk...........',
        '.....kRRk.kRRk..........',
        '.....kkkk.kkkk..........',
        '....kdddk.kdddk.........',
        '....kkkkk.kkkkk.........'
    ]
];

/** 적 한 장(24×24) = 윗몸 16줄 + 다리 8줄 */
export function composeEnemy(top: string[], legs: string[]): string[] {
    return top.concat(legs).slice(0, CHAR_SIZE);
}

/* ── 적: 표적병 (24×24) — 붉은 철모, 제자리에서 이따금 쏜다 (시험용) ── */

export const DUMMY = [
    '........................',
    '........................',
    '..........kkkk..........',
    '........kkRRRRkk........',
    '.......kRRRRRRRRk.......',
    '......kRRRRRRRRRRk......',
    '......kkkkkkkkkkkk......',
    '......kssssssssssk......',
    '......kssssskssksk......',
    '......kssssskssksk......',
    '......kSsssssssssk......',
    '.......kkkkkkkkkk.......',
    '......kRrrrrrrrrRk......',
    '.....kRrrrrrrrrrrkmmmk..',
    '.....kRrrrrrrrrsskkk....',
    '.....kRrrrrrrrrrrk......',
    '.....kRRrrrrrrrRRk......',
    '......kkkkkkkkkkk.......',
    '......kRRRkkkRRRk.......',
    '......kRRRk.kRRRk.......',
    '......kRRRk.kRRRk.......',
    '......kkkkk.kkkkk.......',
    '.....kdddk...kdddk......',
    '.....kkkkk...kkkkk......'
];

/* ── 타일 (16×16) ── */

/** 맨 위가 드러난 땅 (풀) */
export const TILE_GRASS = [
    'eeeeeeeeeeeeeeee',
    'eeeeeeeeeeeeeeee',
    'eeGeeeeeGeeeeeGe',
    'dGdGdddGdGdddGdG',
    'dddddddddddddddd',
    'ddddOdddddddddOd',
    'dddddddddOdddddd',
    'dOdddddddddddddd',
    'dddddddddddOdddd',
    'ddddddOddddddddd',
    'dddddddddddddOdd',
    'ddOddddddddddddd',
    'ddddddddOddddddd',
    'dddddddddddddddO',
    'dddOdddddddddddd',
    'dddddddddOdddddd'
];

/** 속 땅 (위에 다른 땅이 있는 칸) */
export const TILE_DIRT = [
    'dddddddddddddddd',
    'ddddOdddddddddOd',
    'dddddddddOdddddd',
    'dOdddddddddddddd',
    'dddddddddddOdddd',
    'ddddddOddddddddd',
    'dddddddddddddOdd',
    'ddOddddddddddddd',
    'ddddddddOddddddd',
    'dddddddddddddddO',
    'dddOdddddddddddd',
    'dddddddddOdddddd',
    'ddddddOddddddddd',
    'dOdddddddddddddd',
    'dddddddddddOdddd',
    'ddddddddddddddOd'
];

/** 발판 (위에서만 밟힌다) */
export const TILE_PLATFORM = [
    'kkkkkkkkkkkkkkkk',
    'oooooooooooooooo',
    'oOoooooooOoooooo',
    'OOOOOOOOOOOOOOOO',
    'kkkkkkkkkkkkkkkk',
    '.kOk........kOk.',
    '.kOk........kOk.',
    '..k..........k..',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................'
];

/** 나무 상자 */
export const TILE_CRATE = [
    'kkkkkkkkkkkkkkkk',
    'kooooooooooooook',
    'kokkkkkkkkkkkkok',
    'kokOooooooooOkok',
    'kokoOooooooOokok',
    'kokooOooooOookok',
    'kokoooOooOoookok',
    'kokooooOOooookok',
    'kokooooOOooookok',
    'kokoooOooOoookok',
    'kokooOooooOookok',
    'kokoOooooooOokok',
    'kokOooooooooOkok',
    'kokkkkkkkkkkkkok',
    'kooooooooooooook',
    'kkkkkkkkkkkkkkkk'
];

/** 상자 금 (체력이 줄면 위에 겹쳐 그린다) */
export const TILE_CRACK = [
    '................',
    '................',
    '.....k..........',
    '.....kk.........',
    '......k.....k...',
    '......kk...kk...',
    '.......k..kk....',
    '.......kkkk.....',
    '........k.......',
    '.......kk.......',
    '......kk........',
    '......k.........',
    '................',
    '................',
    '................',
    '................'
];

/* ── 작은 것들 ── */

/** 수류탄 (6×6) */
export const GRENADE = ['..kk..', '.kGGk.', 'kGgGGk', 'kGGGGk', '.kGGk.', '..kk..'];

/** 적 수류탄 (6×6) — 붉은 몸통 */
export const BOMB = ['..kk..', '.kmmk.', 'kRrRRk', 'kRRRRk', '.kRRk.', '..kk..'];

/** 총구 불꽃 (6×6) */
export const MUZZLE = ['..y...', '.ywy..', 'ywwwyy', '.ywy..', '..y...', '......'];

/** 그림 이름 → 격자 (검사·미리 그리기용) */
export const ART: Record<string, string[]> = {
    dummy: DUMMY,
    bomb: BOMB,
    grass: TILE_GRASS,
    dirt: TILE_DIRT,
    platform: TILE_PLATFORM,
    crate: TILE_CRATE,
    crack: TILE_CRACK,
    grenade: GRENADE,
    muzzle: MUZZLE
};
