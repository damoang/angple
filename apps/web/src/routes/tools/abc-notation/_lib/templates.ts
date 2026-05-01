export type Category = 'korean' | 'classical' | 'hymn' | 'kpop' | 'practice';

export interface AbcTemplate {
    name: string;
    category: Category;
    desc: string;
    abc: string;
}

export const CATEGORY_LABEL: Record<Category, string> = {
    korean: '🇰🇷 한국 민요',
    classical: '🎼 클래식',
    hymn: '✝️ 찬송가',
    kpop: '🎤 K-Pop / 가요',
    practice: '📝 연습 / 학습'
};

const korean: AbcTemplate[] = [
    { name: '애국가 (도입부)', category: 'korean', desc: '대한민국 애국가 1절 4마디', abc: `X:1
T:애국가
M:4/4
L:1/4
Q:1/4=80
K:G
|: G2 BA | G2 G2 | E2 GA | B2 B2 |
B2 d2 | e2 d2 | B2 A2 | G4 :|` },

    { name: '아리랑 (본조)', category: 'korean', desc: '강원 본조 아리랑 — 9/8 박자', abc: `X:1
T:Arirang (본조)
M:9/8
L:1/8
Q:3/8=80
K:Bb
|: F3 D2 F G2 A | B3 c2 d c2 B | A3 G2 F D2 F |
G3 F2 D C2 D | F3 D2 F G2 A | B3 c2 d c2 B |
A3 G2 F D2 F | G3 F2 D C2 D :|` },

    { name: '진도 아리랑', category: 'korean', desc: '전라도 진도 아리랑 — 세마치 장단', abc: `X:1
T:진도 아리랑
M:9/8
L:1/8
Q:3/8=84
K:Eb
|: B3 G2 B c2 d | e3 f2 e d2 c | B3 G2 F E2 D |
E3 F2 G F2 E :|` },

    { name: '밀양 아리랑', category: 'korean', desc: '경상도 밀양 아리랑 — 굿거리 장단', abc: `X:1
T:Miryang Arirang
M:6/8
L:1/8
Q:3/8=92
K:F
|: F2A c2c | d3 c3 | A2c d2c | A3 F3 |
F2A c2c | d3 e2d | c2A G2F | F6 :|` },

    { name: '도라지', category: 'korean', desc: '도라지 도라지 백도라지', abc: `X:1
T:도라지 (Doraji)
M:3/4
L:1/4
Q:1/4=120
K:F
|: F G A | c2 c | F G A | c2 c |
A G F | F G A | F G F | F3 :|` },

    { name: '새야 새야 파랑새야', category: 'korean', desc: '동학농민운동 시기 민요', abc: `X:1
T:새야 새야
M:6/8
L:1/8
Q:3/8=80
K:G
|: G2A B2c | d2c B2A | G2A B2c | d3 z3 |
B2c d2e | d2c B2A | G2F G2A | G6 :|` },

    { name: '한오백년', category: 'korean', desc: '강원도 민요 — 한이 깊은 곡', abc: `X:1
T:한오백년
M:3/4
L:1/4
Q:1/4=72
K:Dm
|: D F A | A2 G | F E D | D3 |
F A d | d2 c | A G F | F3 :|` },

    { name: '늴리리야', category: 'korean', desc: '경기 민요 — 흥겨운 곡', abc: `X:1
T:Nilliriya
M:6/8
L:1/8
Q:3/8=100
K:G
|: G2B d2d | B2A G2A | B2d e2d | B3 z3 |
B2d e2d | c2B A2G | F2G A2B | G6 :|` },

    { name: '강강술래', category: 'korean', desc: '전남 추석 강강술래', abc: `X:1
T:Ganggangsullae
M:12/8
L:1/8
Q:3/8=84
K:F
|: F3 A2c c2A G2F | F3 G2A B2A G2F |
A3 c2d c2A G2F | F12 :|` },

    { name: '천안 삼거리', category: 'korean', desc: '충청도 천안삼거리 흥타령', abc: `X:1
T:천안삼거리
M:6/8
L:1/8
Q:3/8=92
K:G
|: G2A B2d | e2d B2A | G2A B2d | B3 z3 |
B2c d2e | d2B A2G | F2G A2B | G6 :|` },

    { name: '군밤타령', category: 'korean', desc: '서울 / 경기 민요 — 흥겨운 자진모리', abc: `X:1
T:Gunbam Taryeong
M:12/8
L:1/8
Q:3/8=110
K:G
|: G3 B2d d3 B2A | G3 B2d d3 B2A |
B2d e2d c2B A2G | F2G A2B G6 :|` },

    { name: '옹헤야', category: 'korean', desc: '경상도 보리타작 노래', abc: `X:1
T:Ongheya
M:2/4
L:1/8
Q:1/4=120
K:F
|: F A c c | c2 c2 | A G F G | F4 :|` },

    { name: '베틀가', category: 'korean', desc: '경북 베 짜는 노동요', abc: `X:1
T:Beteulga
M:4/4
L:1/4
Q:1/4=80
K:Dm
|: D F A A | G F D2 | F G A G | F4 |
A c d c | A G F G | F E D D | D4 :|` },

    { name: '정선 아리랑', category: 'korean', desc: '강원 정선의 깊은 한 가락', abc: `X:1
T:Jeongseon Arirang
M:9/8
L:1/8
Q:3/8=72
K:Bb
|: F3 D2 F G2 A | B3 A2 G F2 D |
G3 F2 D C2 D | D9 :|` },

    { name: '보리수 (한국어)', category: 'korean', desc: '슈베르트 보리수 한국어 가사 5음음계 변형', abc: `X:1
T:Linden Tree (Korean)
M:3/4
L:1/4
Q:1/4=80
K:G
|: G B d | d2 c | B A G | A2 z |
G B d | d2 e | d B A | G3 :|` }
];

const classical: AbcTemplate[] = [
    { name: '카논 진행 (4마디)', category: 'classical', desc: '파헬벨 카논 D — I-V-vi-iii-IV-I-IV-V', abc: `X:1
T:Pachelbel Canon (Excerpt)
M:4/4
L:1/4
Q:1/4=72
K:D
|: D2 A,2 | B,2 F,2 | G,2 D,2 | G,2 A,2 |
D2 A,2 | B,2 F,2 | G,2 D,2 | G,2 A,2 :|` },

    { name: 'Für Elise (도입)', category: 'classical', desc: '베토벤 엘리제를 위하여 첫 8마디', abc: `X:1
T:Für Elise (intro)
C:Beethoven
M:3/8
L:1/8
Q:3/8=104
K:Am
|: e ^d e ^d e B d c | A2 z C E A | B2 z E ^G B | c2 z E e ^d :|` },

    { name: '바흐 미뉴엣 G장조', category: 'classical', desc: 'BWV Anh. 114 도입부', abc: `X:1
T:Minuet in G
C:Bach (attr.)
M:3/4
L:1/4
Q:1/4=120
K:G
|: d B G | A G F | G c B | A2 z |
B A G | F E D | C E G | G3 :|` },

    { name: '모차르트 K.331 (Alla Turca 도입)', category: 'classical', desc: '모차르트 피아노 소나타 11번 3악장', abc: `X:1
T:Rondo Alla Turca
C:Mozart
M:2/4
L:1/8
Q:1/4=120
K:Am
|: B A ^G A | c2 e2 | d c B c | A4 :|` },

    { name: '쇼팽 Prelude E단조 (Op.28 No.4)', category: 'classical', desc: '쇼팽 프렐류드 도입 화성', abc: `X:1
T:Prelude in E minor
C:Chopin
M:2/2
L:1/8
Q:1/4=66
K:Em
|: B,4 B,4 | B,4 A,4 | A,4 G,4 | G,4 F,4 :|` },

    { name: '엘가 사랑의 인사 (도입)', category: 'classical', desc: 'Salut d\'Amour 도입 4마디', abc: `X:1
T:Salut d'Amour
C:Elgar
M:3/4
L:1/4
Q:1/4=88
K:E
|: B B B | A G F | E F G | B3 |
B B B | c B A | G F E | E3 :|` },

    { name: '비제 카르멘 하바네라', category: 'classical', desc: 'Habanera 도입 멜로디', abc: `X:1
T:Habanera (Carmen)
C:Bizet
M:2/4
L:1/8
Q:1/4=72
K:Dm
|: A2 ^G A | A G F E | F2 E F | E4 :|` },

    { name: '드뷔시 달빛 (도입)', category: 'classical', desc: 'Clair de Lune 도입 4마디', abc: `X:1
T:Clair de Lune
C:Debussy
M:9/8
L:1/8
Q:3/8=46
K:Db
|: A,3 D F D F2 D | F3 D F2 A,3 :|` },

    { name: '비발디 사계 봄 (도입)', category: 'classical', desc: 'La Primavera Allegro 도입', abc: `X:1
T:Spring (Four Seasons)
C:Vivaldi
M:4/4
L:1/8
Q:1/4=120
K:E
|: e2 e2 e2 e2 | e2 ^d2 e2 z2 |
B2 B2 B2 B2 | B2 A2 B2 z2 :|` },

    { name: '슈베르트 자장가', category: 'classical', desc: 'Wiegenlied D.498', abc: `X:1
T:Wiegenlied
C:Schubert
M:6/8
L:1/8
Q:3/8=60
K:Ab
|: c c c B A G | F2 F2 z2 | c c c d c B | A3 z3 :|` }
];

const hymn: AbcTemplate[] = [
    { name: 'Amazing Grace', category: 'hymn', desc: '나 같은 죄인 살리신 — 가장 유명한 찬송가', abc: `X:1
T:Amazing Grace
M:3/4
L:1/4
Q:1/4=80
K:G
|: D | G2 B | G2 B | A G E | D3 |
G2 B | A G E | D3 :|` },

    { name: '주 하나님 지으신 모든 세계', category: 'hymn', desc: 'How Great Thou Art — 한국 교회의 사랑받는 찬송', abc: `X:1
T:How Great Thou Art
M:4/4
L:1/4
Q:1/4=72
K:Bb
|: F | B B B B | c2 B A | G F E F | B3 F |
B B B B | c2 B A | G F D F | B3 :|` },

    { name: '내 영혼이 은총 입어', category: 'hymn', desc: '한국 부흥회 단골 찬송 (438장)', abc: `X:1
T:내 영혼이 은총 입어
M:4/4
L:1/4
Q:1/4=80
K:F
|: F2 G2 | A2 c2 | A G F G | F4 |
F2 A2 | c2 d2 | c B A G | F4 :|` },

    { name: 'Holy Holy Holy', category: 'hymn', desc: '거룩 거룩 거룩 — 트리니티 찬송', abc: `X:1
T:Holy Holy Holy
M:4/4
L:1/4
Q:1/4=92
K:D
|: D | D2 D F | A2 A2 | F2 D F | A4 |
A2 A B | A G F E | D2 D F | A4 :|` },

    { name: '주의 친절한 팔에 안기세', category: 'hymn', desc: 'Leaning on the Everlasting Arms — 한국 찬송가 405장', abc: `X:1
T:Leaning on the Everlasting Arms
M:4/4
L:1/4
Q:1/4=84
K:G
|: G G B B | A G E G | A2 A B | A3 z |
G G B B | A G E G | D D B G | G4 :|` },

    { name: 'Be Thou My Vision', category: 'hymn', desc: '내 영의 눈을 밝혀 — 아일랜드 전통 멜로디', abc: `X:1
T:Be Thou My Vision
M:3/4
L:1/4
Q:1/4=72
K:Eb
|: B G B | c B G | F G B | G3 |
B c d | c B G | F E F | G3 :|` },

    { name: '오 거룩한 밤', category: 'hymn', desc: 'O Holy Night — 크리스마스 캐롤', abc: `X:1
T:O Holy Night
M:6/8
L:1/8
Q:3/8=66
K:Eb
|: G3 z2 G | A B c B A G | F2 G2 A2 |
G6 :|` },

    { name: 'Silent Night', category: 'hymn', desc: '고요한 밤 거룩한 밤 — 1818 슈베르트', abc: `X:1
T:Silent Night
M:6/8
L:1/8
Q:3/8=60
K:C
|: G2 A G2 E | G3 z3 | A2 A c2 G | G3 z3 |
F2 F A2 c | A3 F3 | F2 F A2 c | A3 F3 :|` },

    { name: '내 평생 살아온 길', category: 'hymn', desc: 'It Is Well With My Soul — 한국 찬송가 412장', abc: `X:1
T:It Is Well
M:4/4
L:1/4
Q:1/4=80
K:C
|: G2 G G | E2 E F | G2 G c | G3 z |
G2 G G | E F G F | E2 D2 | C4 :|` },

    { name: '주 예수 이름 높이어', category: 'hymn', desc: 'All Hail the Power — 부흥 찬양', abc: `X:1
T:All Hail the Power
M:4/4
L:1/4
Q:1/4=92
K:G
|: G G G B | A G F G | A2 A B | G4 |
G G B d | d c B A | G2 D G | G4 :|` }
];

const kpop: AbcTemplate[] = [
    { name: '학교종', category: 'kpop', desc: '학교 종이 땡땡땡 — 한국 동요', abc: `X:1
T:학교종
M:4/4
L:1/4
Q:1/4=100
K:C
|: G G E E | G G E2 | G G E E | G2 E2 |
A A G G | E E E2 | G G G E | C4 :|` },

    { name: '곰 세 마리', category: 'kpop', desc: '곰 세 마리가 한 집에 있어 — 동요', abc: `X:1
T:곰 세 마리
M:4/4
L:1/4
Q:1/4=120
K:C
|: G E G E | G G E2 | F D F D | F F D2 |
E E E E | F F F2 | G G G E | C4 :|` },

    { name: '나비야', category: 'kpop', desc: '나비야 나비야 이리 날아 오너라 — 동요', abc: `X:1
T:나비야
M:4/4
L:1/4
Q:1/4=110
K:C
|: G E E | F D D | C D E F | G2 G2 |
G E E | F D D | C E G E | C2 z2 :|` },

    { name: '비행기', category: 'kpop', desc: '떴다 떴다 비행기 — 동요', abc: `X:1
T:비행기
M:4/4
L:1/4
Q:1/4=120
K:C
|: G E E | F D D | C E G G | E2 z2 |
G E E | F D D | C E G E | C2 z2 :|` },

    { name: '봄나들이', category: 'kpop', desc: '나리 나리 개나리 — 동요', abc: `X:1
T:봄나들이
M:4/4
L:1/4
Q:1/4=120
K:C
|: G G G E | G G G E | G G E G | C4 |
F F F D | F F F D | E F G E | C4 :|` },

    { name: 'K-Pop 4 코드 (vi-IV-I-V)', category: 'kpop', desc: 'K-발라드 4코드 — C 메이저 진행 데모', abc: `X:1
T:K-Pop 4 chord
M:4/4
L:1/4
Q:1/4=84
K:C
"Am" A2 c2 | "F" F2 A2 | "C" C2 E2 | "G" G2 B2 |
"Am" A2 c2 | "F" F2 A2 | "C" C2 E2 | "G" G3 z |` },

    { name: 'K-Pop 카논 진행', category: 'kpop', desc: '8마디 카논 진행 (수많은 K-발라드)', abc: `X:1
T:K-Canon
M:4/4
L:1/4
Q:1/4=72
K:D
"D" D2 F2 | "A" A,2 E2 | "Bm" B,2 F2 | "F#m" F,2 A2 |
"G" G,2 D2 | "D" D,2 F2 | "G" G,2 B2 | "A" A,3 z |` }
];

const practice: AbcTemplate[] = [
    { name: '12-bar Blues (C)', category: 'practice', desc: '블루스 12 마디 — C 키 (I-IV-V)', abc: `X:1
T:12-Bar Blues in C
M:4/4
L:1/4
Q:1/4=90
K:C
"C7" C E G _B | "C7" C E G _B | "C7" C E G _B | "C7" C E G _B |
"F7" F A c _e | "F7" F A c _e | "C7" C E G _B | "C7" C E G _B |
"G7" G B d f | "F7" F A c _e | "C7" C E G _B | "G7" G B d f |]` },

    { name: 'C 메이저 스케일 (1 옥타브)', category: 'practice', desc: '연습용 - C 메이저 음계 상행/하행', abc: `X:1
T:C Major Scale
M:4/4
L:1/4
Q:1/4=80
K:C
|: C D E F | G A B c | c B A G | F E D C :|` },

    { name: 'A 자연 단음계', category: 'practice', desc: '연습용 - A 마이너 자연 단음계', abc: `X:1
T:A Minor Scale (natural)
M:4/4
L:1/4
Q:1/4=80
K:Am
|: A B c d | e f g a | a g f e | d c B A :|` },

    { name: '5음 음계 (펜타토닉)', category: 'practice', desc: 'C 메이저 펜타토닉 — 즉흥 연주 연습', abc: `X:1
T:Pentatonic
M:4/4
L:1/4
Q:1/4=100
K:C
|: C D E G | A c2 z | a g e d | C2 z2 :|` },

    { name: '아르페지오 연습', category: 'practice', desc: 'I-IV-V 코드 분산화음', abc: `X:1
T:Arpeggio Practice
M:4/4
L:1/8
Q:1/4=100
K:C
|: C E G c G E C2 | F A c f c A F2 | G B d g d B G2 | C E G c2 z4 :|` },

    { name: 'ii-V-I 워킹 라인', category: 'practice', desc: '재즈 베이스 라인 — Dm7-G7-CM7', abc: `X:1
T:ii-V-I Walking
M:4/4
L:1/4
Q:1/4=110
K:C
|: D F A c | G B d f | C E G c | C4 :|` }
];

export const TEMPLATES: AbcTemplate[] = [...korean, ...classical, ...hymn, ...kpop, ...practice];

export const TEMPLATES_BY_CATEGORY: Record<Category, AbcTemplate[]> = {
    korean, classical, hymn, kpop, practice
};

export const CATEGORIES: Category[] = ['korean', 'classical', 'hymn', 'kpop', 'practice'];
