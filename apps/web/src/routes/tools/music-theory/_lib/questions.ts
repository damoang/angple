export type Category = 'interval' | 'chord' | 'key' | 'progression' | 'rhythm' | 'korean';

export interface Question {
    category: Category;
    q: string;
    choices: string[];
    answer: number;
    explain: string;
    difficulty?: 1 | 2 | 3;
}

export const CATEGORY_LABEL: Record<Category, string> = {
    interval: '음정',
    chord: '코드',
    key: '조성',
    progression: '진행',
    rhythm: '리듬',
    korean: '한국 음악'
};

export const CATEGORY_DESC: Record<Category, string> = {
    interval: '두 음 사이의 거리 (장2도, 단3도, 완전5도 등)',
    chord: '메이저 / 마이너 / 7th / 텐션 / sus 코드 구성음',
    key: '조성 식별, 조표, 평행조 / 관계조',
    progression: 'I-V-vi-IV, ii-V-I, 12-bar blues, K-Pop 4코드 등',
    rhythm: '박자표, 점음표, 잇단음표, 리듬 표기',
    korean: '평조 / 계면조 / 판소리 박자 / 한국 전통 음악 이론'
};

const interval: Question[] = [
    { category: 'interval', q: 'C 에서 G 까지 음정은?', choices: ['장3도', '완전4도', '완전5도', '장6도'], answer: 2, explain: 'C-D-E-F-G — 5음 = 완전5도 (P5). 7반음.' , difficulty: 1 },
    { category: 'interval', q: 'C 에서 E♭ 까지 음정은?', choices: ['단3도', '장3도', '증3도', '감4도'], answer: 0, explain: 'C-D-E♭ — 3음에 ♭ → 단3도 (m3). 3반음.', difficulty: 1 },
    { category: 'interval', q: 'C 에서 F♯ 까지 음정은?', choices: ['완전4도', '증4도(트라이톤)', '단5도', '장4도'], answer: 1, explain: '증4도 = 트라이톤 = 6반음. 감5도와 동일 음높이.', difficulty: 2 },
    { category: 'interval', q: 'D 에서 A 까지 음정은?', choices: ['완전4도', '완전5도', '장6도', '단7도'], answer: 1, explain: 'D-E-F♯-G-A — 7반음 = 완전5도.', difficulty: 1 },
    { category: 'interval', q: 'A 에서 C 까지 음정은?', choices: ['장3도', '단3도', '완전3도', '감3도'], answer: 1, explain: 'A-B-C — 3반음 = 단3도. (장3도는 4반음)', difficulty: 1 },
    { category: 'interval', q: '한 옥타브 = 몇 반음?', choices: ['7반음', '8반음', '12반음', '13반음'], answer: 2, explain: '서양 12평균율: 한 옥타브 = 12반음.', difficulty: 1 },
    { category: 'interval', q: '단7도 (m7) 와 음높이가 같은 음정은?', choices: ['증6도', '장6도', '완전7도', '감7도'], answer: 0, explain: '단7도 = 10반음. 증6도와 enharmonic 동치.', difficulty: 3 },
    { category: 'interval', q: '음정의 종류 (질) 은?', choices: ['완전 / 장 / 단', '완전 / 장 / 단 / 증 / 감', '단 / 중 / 장', '낮음 / 보통 / 높음'], answer: 1, explain: '완전(P) / 장(M) / 단(m) / 증(A) / 감(d) 5종.', difficulty: 1 },
    { category: 'interval', q: 'B 에서 F 까지 음정은?', choices: ['완전5도', '감5도', '증4도', '장5도'], answer: 1, explain: 'B-C-D-E-F — 6반음, 5음정 → 감5도.', difficulty: 2 },
    { category: 'interval', q: '전음 (whole tone) = 몇 반음?', choices: ['1반음', '2반음', '3반음', '4반음'], answer: 1, explain: '전음 = 장2도 = 2반음. 반음 (semitone) = 1반음 = 단2도.', difficulty: 1 },
    { category: 'interval', q: 'F 에서 D 까지 (위로) 음정은?', choices: ['장5도', '완전6도', '장6도', '완전5도'], answer: 2, explain: 'F-G-A-B-C-D — 9반음, 6음정 → 장6도.', difficulty: 2 },
    { category: 'interval', q: '두 옥타브의 거리는?', choices: ['12반음', '14반음', '21반음', '24반음'], answer: 3, explain: '한 옥타브 12 × 2 = 24반음.', difficulty: 1 },
    { category: 'interval', q: '단3도 + 단3도 = ?', choices: ['감5도', '완전5도', '장5도', '증5도'], answer: 0, explain: '3 + 3 = 6반음 = 감5도 (디미니쉬드 5).', difficulty: 2 },
    { category: 'interval', q: '장3도 + 단3도 = ?', choices: ['감5도', '완전5도', '증5도', '장5도'], answer: 1, explain: '4 + 3 = 7반음 = 완전5도. 메이저 트라이어드 구조.', difficulty: 2 },
    { category: 'interval', q: '단3도 + 장3도 = ?', choices: ['완전5도', '감5도', '증5도', '장5도'], answer: 0, explain: '3 + 4 = 7반음 = 완전5도. 마이너 트라이어드 구조.', difficulty: 2 },
    { category: 'interval', q: '장3도 + 장3도 = ?', choices: ['완전5도', '감5도', '증5도', '단5도'], answer: 2, explain: '4 + 4 = 8반음 = 증5도 (오그멘티드). aug 코드 구조.', difficulty: 2 },
    { category: 'interval', q: 'A♭ 에서 C♭ 까지 음정은?', choices: ['장3도', '단3도', '감3도', '완전3도'], answer: 1, explain: 'A♭-B♭-C♭ — 3반음 = 단3도.', difficulty: 2 },
    { category: 'interval', q: '협화 음정 (consonance) 에 속하는 것은?', choices: ['장2도', '완전5도', '증4도', '단7도'], answer: 1, explain: '완전 1/4/5/8도 = 완전 협화. 장단3/6도 = 불완전 협화. 2/7도 = 불협화.', difficulty: 2 },
    { category: 'interval', q: 'enharmonic 동치인 음정 쌍은?', choices: ['장3도-단3도', '증4도-감5도', '완전5도-단6도', '장2도-단3도'], answer: 1, explain: '증4도 (6반음) = 감5도 (6반음) = 트라이톤. 표기만 다름.', difficulty: 3 },
    { category: 'interval', q: 'D♯ 에서 F♯ 까지 음정은?', choices: ['장3도', '단3도', '완전3도', '감3도'], answer: 1, explain: 'D♯-E-F♯ — 3반음 = 단3도.', difficulty: 2 }
];

const chord: Question[] = [
    { category: 'chord', q: 'C 메이저 코드의 구성음은?', choices: ['C-E-G', 'C-E♭-G', 'C-E-G♯', 'C-F-A'], answer: 0, explain: '메이저 트라이어드 = 근음 + 장3도 + 완전5도.', difficulty: 1 },
    { category: 'chord', q: 'A 마이너 코드 (Am) 의 구성음은?', choices: ['A-C-E', 'A-C♯-E', 'A-C-E♭', 'A-C-F'], answer: 0, explain: '마이너 트라이어드 = 근음 + 단3도 + 완전5도.', difficulty: 1 },
    { category: 'chord', q: 'F 메이저 코드의 구성음은?', choices: ['F-A-C', 'F-A♭-C', 'F-A-C♯', 'F-G-C'], answer: 0, explain: 'F 메이저 = F + A (장3) + C (완5).', difficulty: 1 },
    { category: 'chord', q: 'D 마이너 코드 (Dm) 의 구성음은?', choices: ['D-F-A', 'D-F♯-A', 'D-F-A♭', 'D-F-A♯'], answer: 0, explain: 'Dm = D + F (단3) + A (완5).', difficulty: 1 },
    { category: 'chord', q: 'F♯ 감화음 (F♯dim) 의 구성음은?', choices: ['F♯-A-C', 'F♯-A♯-C♯', 'F♯-A-C♯', 'F♯-A♭-C'], answer: 0, explain: '감(dim) = 단3 + 단3 = F♯-A-C. 모두 단3도 간격.', difficulty: 2 },
    { category: 'chord', q: 'C 증화음 (Caug) 의 구성음은?', choices: ['C-E-G', 'C-E-G♯', 'C-E♭-G♯', 'C-E-G♭'], answer: 1, explain: '증(aug) = 장3 + 장3 = C-E-G♯.', difficulty: 2 },
    { category: 'chord', q: 'C7 (도미넌트 7) 의 구성음은?', choices: ['C-E-G-B', 'C-E-G-B♭', 'C-E♭-G-B', 'C-E-G♯-B♭'], answer: 1, explain: '도미넌트 7 = 메이저 + 단7 = C-E-G-B♭.', difficulty: 2 },
    { category: 'chord', q: 'CM7 (메이저 7) 의 구성음은?', choices: ['C-E-G-B♭', 'C-E-G-B', 'C-E♭-G-B', 'C-E-G♯-B'], answer: 1, explain: '메이저 7 = 메이저 + 장7 = C-E-G-B.', difficulty: 2 },
    { category: 'chord', q: 'Am7 (마이너 7) 의 구성음은?', choices: ['A-C-E-G♯', 'A-C-E-G', 'A-C♯-E-G', 'A-C-E♭-G'], answer: 1, explain: 'Am7 = 마이너 + 단7 = A-C-E-G.', difficulty: 2 },
    { category: 'chord', q: 'Bm7♭5 (반감화음) 의 구성음은?', choices: ['B-D-F-A♭', 'B-D-F-A', 'B-D♯-F♯-A', 'B-D-F♯-A'], answer: 1, explain: '반감 7 (m7♭5) = 단3 + 단3 + 장3 = B-D-F-A.', difficulty: 3 },
    { category: 'chord', q: 'Bdim7 (감 7) 의 구성음은?', choices: ['B-D-F-A♭', 'B-D-F-A', 'B-D-F♯-A', 'B-D♯-F-A'], answer: 0, explain: '감 7 = 단3 × 3 = B-D-F-A♭. 4음 모두 단3도.', difficulty: 3 },
    { category: 'chord', q: 'Csus4 의 구성음은?', choices: ['C-E-G', 'C-F-G', 'C-E♭-G', 'C-D-G'], answer: 1, explain: 'sus4 = 3음을 4음으로 대체 = C-F-G.', difficulty: 2 },
    { category: 'chord', q: 'Csus2 의 구성음은?', choices: ['C-D-G', 'C-E♭-G', 'C-F-G', 'C-E-G'], answer: 0, explain: 'sus2 = 3음을 2음으로 대체 = C-D-G.', difficulty: 2 },
    { category: 'chord', q: 'C6 의 구성음은?', choices: ['C-E-G-A', 'C-E-G-B', 'C-E-G-B♭', 'C-E♭-G-A'], answer: 0, explain: 'C6 = 메이저 + 6 = C-E-G-A. (마이너 6 도 같은 6음)', difficulty: 2 },
    { category: 'chord', q: 'Cadd9 의 구성음은?', choices: ['C-D-E-G', 'C-E-G-D', 'C-E-G-B♭-D', 'C-E-G-A'], answer: 1, explain: 'add9 = 메이저에 9음 추가 (7음 X) = C-E-G-D. 표기 순서는 무관.', difficulty: 2 },
    { category: 'chord', q: 'C9 의 구성음은?', choices: ['C-E-G-D', 'C-E-G-B♭-D', 'C-E-G-A-D', 'C-E-G-B-D'], answer: 1, explain: '9 = 도미넌트 7 + 9음 = C-E-G-B♭-D.', difficulty: 3 },
    { category: 'chord', q: 'CM9 (메이저 9) 의 구성음은?', choices: ['C-E-G-B♭-D', 'C-E-G-B-D', 'C-E-G-D', 'C-E♭-G-B-D'], answer: 1, explain: 'M9 = 메이저 7 + 9 = C-E-G-B-D.', difficulty: 3 },
    { category: 'chord', q: 'C13 의 일반적 구성음 (생략 가능)?', choices: ['C-E-G-B♭-D-F-A', 'C-E-G-B-A', 'C-E-G-A', 'C-E-G-D-A'], answer: 0, explain: 'C13 = 도미넌트 7 + 9 + 11 + 13. 실제 보이싱은 11 생략 흔함.', difficulty: 3 },
    { category: 'chord', q: 'Csus4 의 해결은 일반적으로?', choices: ['Cm 으로', 'C 메이저로 (4→3)', 'F 로', 'G 로'], answer: 1, explain: 'sus4 → 3음 (4→3 하행) 으로 해결. C-F-G → C-E-G.', difficulty: 2 },
    { category: 'chord', q: 'C 메이저 1전위 (1st inversion) 의 베이스 음은?', choices: ['C', 'E', 'G', 'B'], answer: 1, explain: '1전위 = 3음이 베이스. C/E (E-G-C 순).', difficulty: 2 },
    { category: 'chord', q: 'C 메이저 2전위의 베이스 음은?', choices: ['C', 'E', 'G', 'B'], answer: 2, explain: '2전위 = 5음이 베이스. C/G (G-C-E 순).', difficulty: 2 },
    { category: 'chord', q: 'G7 의 슬래시 표기 G7/B 의 베이스 음은?', choices: ['G', 'B', 'D', 'F'], answer: 1, explain: 'G7/B = G7 코드의 1전위 (B 베이스).', difficulty: 2 },
    { category: 'chord', q: 'Cm7 와 E♭6 은?', choices: ['전혀 다른 코드', '같은 음 구성', '동음 이명만 다름', '서로 V-I 관계'], answer: 1, explain: 'Cm7 = C-E♭-G-B♭. E♭6 = E♭-G-B♭-C. 같은 4음 = enharmonic 코드.', difficulty: 3 },
    { category: 'chord', q: '메이저 트라이어드의 기능 분류는?', choices: ['주음(T) / 하속음(S) / 도음(D)', '토닉(T) / 서브도미넌트(S) / 도미넌트(D)', '감음 / 보음 / 정음', '차감음 / 후감음 / 종지음'], answer: 1, explain: 'T-S-D 기능 화성. I=T, IV=S, V=D 가 기본.', difficulty: 2 },
    { category: 'chord', q: 'I (T) 다음에 가장 안정적인 진행은?', choices: ['I → vii°', 'I → V', 'I → ♭II', 'I → VI'], answer: 1, explain: 'I → V (T → D) 가장 강한 정종지의 사전 단계.', difficulty: 1 },
    { category: 'chord', q: 'V → I 의 종지 명칭은?', choices: ['반종지', '정종지(authentic cadence)', '플라갈 종지', '거짓 종지'], answer: 1, explain: '정종지 = D → T = 가장 강한 종결감. (V-I)', difficulty: 1 },
    { category: 'chord', q: 'IV → I 의 종지 명칭은?', choices: ['플라갈 종지(Amen cadence)', '정종지', '반종지', '변격 종지'], answer: 0, explain: 'IV-I = 플라갈 종지 = "아멘" 종지. CCM 찬송가에 흔함.', difficulty: 1 },
    { category: 'chord', q: 'V → vi 의 종지 명칭은?', choices: ['정종지', '플라갈 종지', '거짓 종지(deceptive)', '반종지'], answer: 2, explain: 'V → vi = 거짓 종지. 토닉 대신 vi 로 회피.', difficulty: 2 },
    { category: 'chord', q: 'sus2 와 sus4 의 차이는?', choices: ['음 수가 다름', '3음을 무엇으로 대체하는가의 차이', '코드 종류가 완전 다름', '루트가 다름'], answer: 1, explain: '둘 다 3음을 다른 음으로 대체. sus2=2음, sus4=4음.', difficulty: 1 },
    { category: 'chord', q: 'C/E 와 Em7 은?', choices: ['전혀 무관', 'C/E ⊃ Em7 (4음 중 3음 일치)', '같은 코드', 'Em7 = C/E + B'], answer: 3, explain: 'C/E = E-G-C. Em7 = E-G-B-D. C/E + B + (D는 9). 답: Em7 = E-G-B-D, C/E + B = E-G-C-B (다른 보이싱). 정확히는 C/E 의 위에 B 추가가 Em(M7).', difficulty: 3 }
];

const key: Question[] = [
    { category: 'key', q: 'G 메이저의 조표는?', choices: ['♯ 0개', '♯ 1개 (F♯)', '♯ 2개 (F♯, C♯)', '♭ 1개'], answer: 1, explain: 'G 메이저는 ♯ 1개 (F♯). 5도권에서 C 다음.', difficulty: 1 },
    { category: 'key', q: 'D 메이저의 조표는?', choices: ['♯ 1개', '♯ 2개 (F♯, C♯)', '♯ 3개', '♭ 1개'], answer: 1, explain: 'D 메이저 = F♯, C♯ 2개.', difficulty: 1 },
    { category: 'key', q: 'F 메이저의 조표는?', choices: ['♯ 1개', '♭ 1개 (B♭)', '♭ 2개', '♯ 0개'], answer: 1, explain: 'F 메이저 = B♭ 1개.', difficulty: 1 },
    { category: 'key', q: 'B♭ 메이저의 조표는?', choices: ['♭ 1개', '♭ 2개 (B♭, E♭)', '♭ 3개', '♯ 2개'], answer: 1, explain: 'B♭ 메이저 = B♭, E♭. 5도권 ♭ 방향 2번째.', difficulty: 1 },
    { category: 'key', q: 'A 마이너의 관계 메이저 (relative major) 는?', choices: ['A 메이저', 'C 메이저', 'D 메이저', 'F 메이저'], answer: 1, explain: '단3도 위 = 관계 메이저. Am ↔ C major (조표 없음).', difficulty: 1 },
    { category: 'key', q: 'D 마이너의 관계 메이저는?', choices: ['F 메이저', 'D 메이저', 'B♭ 메이저', 'A 메이저'], answer: 0, explain: 'Dm ↔ F major (♭ 1개).', difficulty: 1 },
    { category: 'key', q: 'C 메이저의 평행 마이너 (parallel minor) 는?', choices: ['A 마이너', 'C 마이너', 'F 마이너', 'G 마이너'], answer: 1, explain: '같은 으뜸음, 장조 ↔ 단조 = 평행조. C major ↔ C minor.', difficulty: 1 },
    { category: 'key', q: 'A 메이저의 평행 마이너는?', choices: ['F♯ 마이너', 'A 마이너', 'D 마이너', 'C♯ 마이너'], answer: 1, explain: '평행 마이너 = 같은 으뜸음, 단조. A major ↔ A minor.', difficulty: 1 },
    { category: 'key', q: '♯ 4개의 메이저 키는?', choices: ['D', 'A', 'E', 'B'], answer: 2, explain: 'E 메이저 = F♯, C♯, G♯, D♯ (4개).', difficulty: 2 },
    { category: 'key', q: '♭ 3개의 메이저 키는?', choices: ['F', 'B♭', 'E♭', 'A♭'], answer: 2, explain: 'E♭ 메이저 = B♭, E♭, A♭.', difficulty: 2 },
    { category: 'key', q: 'enharmonic 키 페어 (예: F♯ vs G♭) — 모두 조표는?', choices: ['♯/♭ 6개', '♯/♭ 7개', '♯/♭ 5개', '♯ 6 / ♭ 6'], answer: 0, explain: 'F♯ 메이저 = ♯ 6, G♭ 메이저 = ♭ 6. enharmonic 동치.', difficulty: 3 },
    { category: 'key', q: '5도권 (Circle of fifths) 시계 방향은?', choices: ['♯ 추가 방향', '♭ 추가 방향', '음높이 하행', '관계조 변환'], answer: 0, explain: '시계 방향 = 5도 위 = ♯ 추가. C → G → D → A → ...', difficulty: 1 },
    { category: 'key', q: '5도권 반시계 방향은?', choices: ['♯ 추가', '♭ 추가 (4도 위)', '관계 마이너', '단3도 하행'], answer: 1, explain: '반시계 = 4도 위 = ♭ 추가. C → F → B♭ → E♭ → ...', difficulty: 1 },
    { category: 'key', q: '화성 단음계 (harmonic minor) 의 특징은?', choices: ['7음을 반음 올림', '6음을 반음 올림', '3음을 반음 올림', '2음을 반음 올림'], answer: 0, explain: '자연 단음계의 7음 (도음) 을 반음 올려 도음 → 으뜸음 인력 강화.', difficulty: 2 },
    { category: 'key', q: '선율 단음계 (melodic minor) 의 특징은?', choices: ['상행: 6,7 모두 올림 / 하행: 자연단', '6음만 올림', '7음만 내림', '항상 동일'], answer: 0, explain: '상행 시 6,7 음 올려 멜로디 부드럽게. 하행 시 자연 단조.', difficulty: 3 },
    { category: 'key', q: '나란한조 (parallel) 와 관계조 (relative) 차이는?', choices: ['같은 의미', '나란한조=같은 으뜸음, 관계조=같은 조표', '나란한조=같은 조표', '관계조=평행조'], answer: 1, explain: '나란한조 (평행조): C major ↔ C minor (같은 으뜸음). 관계조: C major ↔ A minor (같은 조표).', difficulty: 2 },
    { category: 'key', q: '6음을 ♭, 7음을 ♭ 한 메이저 = ?', choices: ['도리안', '에올리안', '믹솔리디안', '프리지안'], answer: 1, explain: '에올리안 (자연 단음계) = 메이저의 6,7 ♭. C 에올리안 = C-D-E♭-F-G-A♭-B♭.', difficulty: 3 },
    { category: 'key', q: 'F♯ 마이너의 조표는?', choices: ['♯ 2개', '♯ 3개 (F♯, C♯, G♯)', '♯ 4개', '♭ 3개'], answer: 1, explain: 'F♯m = A major 의 관계조 = ♯ 3개.', difficulty: 2 },
    { category: 'key', q: 'C♯ 메이저 = ♯ 몇 개?', choices: ['5', '6', '7', '4'], answer: 2, explain: 'C♯ 메이저 = ♯ 7개 (모든 음 ♯). enharmonic = D♭ 메이저 (♭ 5).', difficulty: 3 },
    { category: 'key', q: '도미넌트 (V) 의 으뜸음 (root) 은 으뜸 키 기준?', choices: ['1음', '4음', '5음', '7음'], answer: 2, explain: 'V 의 root = 5음. C 메이저에서 V = G.', difficulty: 1 }
];

const progression: Question[] = [
    { category: 'progression', q: 'I-V-vi-IV 진행을 C 메이저로 표기하면?', choices: ['C-G-Am-F', 'C-Em-Am-F', 'C-Am-F-G', 'C-F-G-Am'], answer: 0, explain: '팝 음악 황금 진행 80%. Let It Be / 수많은 K-Pop.', difficulty: 1 },
    { category: 'progression', q: 'ii-V-I 진행을 C 메이저로 표기하면?', choices: ['Dm-G-C', 'Em-G-C', 'C-G-Dm', 'F-G-C'], answer: 0, explain: '재즈/보사노바 기본 진행. 부드러운 해결.', difficulty: 1 },
    { category: 'progression', q: '12-bar blues 의 첫 4 마디는?', choices: ['I I I I', 'I IV I I', 'I I I IV', 'I V I I'], answer: 0, explain: '클래식 블루스 12마디: I-I-I-I / IV-IV-I-I / V-IV-I-V.', difficulty: 2 },
    { category: 'progression', q: '50년대 진행 (Stand By Me) 은?', choices: ['I-IV-V-I', 'I-vi-IV-V', 'I-V-vi-IV', 'I-iii-IV-V'], answer: 1, explain: 'Doowop / 50년대 진행 = I-vi-IV-V.', difficulty: 1 },
    { category: 'progression', q: '카논 진행 (파헬벨 카논 D) 은?', choices: ['I-V-vi-iii-IV-I-IV-V', 'I-IV-V-I × 2', 'I-V-IV-I', 'vi-IV-I-V'], answer: 0, explain: '파헬벨 D 메이저 카논의 8 마디 시퀀스.', difficulty: 2 },
    { category: 'progression', q: '플라갈 종지는?', choices: ['V-I', 'IV-I', 'ii-V-I', 'V-vi'], answer: 1, explain: 'IV-I = 플라갈 = "아멘" 종지. CCM 찬송가에 자주.', difficulty: 1 },
    { category: 'progression', q: '거짓 종지 (deceptive cadence) 는?', choices: ['V-I', 'V-vi', 'IV-I', 'I-IV'], answer: 1, explain: 'V-vi = 토닉 회피, 의외성 부여.', difficulty: 2 },
    { category: 'progression', q: 'K-Pop 4코드 진행 vi-IV-I-V 를 G 메이저에서 표기하면?', choices: ['Em-C-G-D', 'Bm-G-D-Em', 'Am-F-C-G', 'D-G-C-Em'], answer: 0, explain: 'G major: vi=Em, IV=C, I=G, V=D.', difficulty: 2 },
    { category: 'progression', q: 'I-vi-ii-V (재즈 turnaround) 를 C 메이저로?', choices: ['C-Am-Dm-G', 'C-Em-F-G', 'C-G-F-Am', 'C-Am-F-G'], answer: 0, explain: '재즈 턴어라운드 = I-vi-ii-V. 8 마디 끝의 회기 패턴.', difficulty: 2 },
    { category: 'progression', q: 'i-VII-VI-V (안달루시안) 을 A 마이너로?', choices: ['Am-G-F-E', 'Am-Em-F-G', 'Am-F-G-E', 'Am-G-Dm-E'], answer: 0, explain: 'Andalusian: i-VII-VI-V. 플라멩코 / 어두운 록.', difficulty: 2 },
    { category: 'progression', q: '록 음악의 I-♭VII-IV (믹솔리디안 진행) = ?', choices: ['I-vi-IV', 'I-♭VII-IV', 'I-V-IV', 'I-IV-vii°'], answer: 1, explain: 'I-♭VII-IV = 클래식 록 / 하드록의 정석. (예: Sweet Home Alabama)', difficulty: 2 },
    { category: 'progression', q: '재즈의 Rhythm Changes (32 마디) 의 A 섹션 = ?', choices: ['I-vi-ii-V', 'I-V-I-V', 'ii-V-I-vi', 'I-IV-V-I'], answer: 0, explain: 'Rhythm Changes A 섹션 = I-vi-ii-V (조지 거슈윈 I Got Rhythm 화성).', difficulty: 3 },
    { category: 'progression', q: 'CCM 의 I-V/vi-vi-IV (인기 진행) 에서 V/vi 의미는?', choices: ['V 코드의 6도 슬래시', 'vi 의 도미넌트 (이차 도미넌트)', 'V 와 vi 동시', 'vi 의 약화형'], answer: 1, explain: 'V/vi = "vi 로 가는 도미넌트" = 이차 도미넌트. C major 에서 V/vi = E (Am 의 V).', difficulty: 3 },
    { category: 'progression', q: '카논 진행의 마지막 마디 (정종지 직전) 코드는?', choices: ['IV-V', 'I-V', 'ii-V', 'vi-V'], answer: 0, explain: '카논 D: ...IV-V → I 정종지. 8마디 시퀀스 끝.', difficulty: 2 },
    { category: 'progression', q: '도미넌트 (V) 에서 진행 가능한 코드는?', choices: ['I 또는 vi 만', 'I, IV, vi 등 다수', 'I 만', 'V 자체 반복'], answer: 1, explain: 'V → I (정종지), V → vi (거짓), V → IV (드물지만 록), V → ii 등.', difficulty: 2 },
    { category: 'progression', q: 'EDM 의 댄스 진행 i-VI-III-VII (마이너) 를 Am 으로?', choices: ['Am-F-C-G', 'Am-Dm-F-G', 'Am-E-F-G', 'Am-C-F-G'], answer: 0, explain: 'i=Am, VI=F, III=C, VII=G. 인기 EDM 마이너 진행.', difficulty: 2 },
    { category: 'progression', q: '트로트의 단순 I-IV-V 진행을 C 메이저로?', choices: ['C-F-G', 'C-G-F', 'C-Em-G', 'C-Am-G'], answer: 0, explain: '트로트 = 3코드 진행. I-IV-V (T-S-D) 기본.', difficulty: 1 },
    { category: 'progression', q: '4도권 (Circle of 4ths) 진행 C → ? → ? → ?', choices: ['G → D → A', 'F → B♭ → E♭', 'E → A → D', 'D → G → C'], answer: 1, explain: '4도 위로 = ♭ 추가. C → F → B♭ → E♭ → A♭ → ...', difficulty: 2 },
    { category: 'progression', q: '재즈 ii-V-I 의 마이너 키 (i 마이너) 버전은?', choices: ['ii°-V-i', 'iim7♭5-V7-i', 'ii-V-i', 'ii-V7-i'], answer: 1, explain: '마이너 ii-V-i = iim7♭5 (반감) - V7 - im7 또는 i.', difficulty: 3 },
    { category: 'progression', q: '슬픈 발라드의 vi-IV-I-V 와 K-Pop 4 코드의 차이는?', choices: ['시작 코드 (마이너 vs 메이저 느낌)', '템포', '조성', '없음 (같음)'], answer: 0, explain: 'vi-IV-I-V = 마이너 시작 (어두움) / I-V-vi-IV = 메이저 시작 (밝음). 같은 4 코드, 시작 위치 차이.', difficulty: 2 }
];

const rhythm: Question[] = [
    { category: 'rhythm', q: '4/4 박자에서 8분음표 1개의 길이는?', choices: ['1박', '1/2박', '2박', '1/4박'], answer: 1, explain: '4분음표 = 1박. 8분음표 = 1/2박.', difficulty: 1 },
    { category: 'rhythm', q: '6/8 박자의 강박 위치는?', choices: ['1, 4', '1, 3, 5', '1만', '모두'], answer: 0, explain: '6/8 = 큰 2박 (점4분 단위). 강박: 1, 4.', difficulty: 2 },
    { category: 'rhythm', q: '점4분음표의 길이는?', choices: ['4분 + 8분', '4분 + 16분', '4분 × 2', '8분 + 16분'], answer: 0, explain: '점음표 = 본 음표 + 절반 = 4분 + 8분 = 1.5박.', difficulty: 1 },
    { category: 'rhythm', q: '셋잇단음표 (triplet) = 무엇을 셋으로?', choices: ['2 음을 3 으로', '4 음을 3 으로', '3 음을 2 로', '같음'], answer: 0, explain: '셋잇단 = 보통 2 음 길이를 3 음으로 분할. 8분 셋잇단 = 4분 안에 3음.', difficulty: 1 },
    { category: 'rhythm', q: '4/4 의 8분 잇단음표 (8분 셋잇단) 의 한 음 길이는?', choices: ['1/2박', '1/3박', '1/6박', '2/3박'], answer: 1, explain: '4분 1박을 3 등분 = 1/3박.', difficulty: 2 },
    { category: 'rhythm', q: '스윙 (swing) 8분음표의 비율은 일반적으로?', choices: ['1:1 (스트레이트)', '2:1 (셋잇단 느낌)', '3:1', '4:3'], answer: 1, explain: '재즈 스윙 = 8분 1쌍을 셋잇단의 [장단] 형태 (2:1).', difficulty: 2 },
    { category: 'rhythm', q: '잇단음표 5/4 (퀸틀렛) 의 의미는?', choices: ['5 음을 4 박에', '5 박', '5 마디', '5 분의 4'], answer: 0, explain: 'Quintuplet = 5 음을 보통 4 음 자리에. (또는 4 박을 5 음으로 분할)', difficulty: 3 },
    { category: 'rhythm', q: '아우프탁트 (Auftakt / pickup) 의 의미는?', choices: ['약박 시작 (마디 끝부터 시작)', '강박 시작', '셋잇단음표', '쉼표'], answer: 0, explain: 'Auftakt = 마디 끝에서 시작하는 약박 도입. 곡 시작 직전.', difficulty: 2 },
    { category: 'rhythm', q: '폴리리듬 3:2 의 의미는?', choices: ['3 음과 2 음이 같은 시간에', '3 박자 2 마디', '3-2 변박', '3 화음 2 음'], answer: 0, explain: '폴리리듬 3:2 = 같은 시간 안에 한 쪽은 3, 다른 쪽은 2 음 분할.', difficulty: 3 },
    { category: 'rhythm', q: '5/4 박자 = 일반적 강박 분할은?', choices: ['1, 4 (3+2)', '1, 3 (2+3)', '둘 다 가능', '1, 3, 5'], answer: 2, explain: '5/4 = 3+2 (1,4) 또는 2+3 (1,3). 작곡 의도에 따라.', difficulty: 2 }
];

const korean: Question[] = [
    { category: 'korean', q: '한국 전통 음계 평조의 5음 구성은?', choices: ['도-레-미-솔-라', '도-미♭-파-솔-시♭', '도-레-파-솔-라', '미♭-파-솔-시♭-도'], answer: 0, explain: '평조 = 황종-태주-중려-임종-남려 (서양식 도-레-미-솔-라 와 유사). 밝은 느낌.', difficulty: 2 },
    { category: 'korean', q: '계면조의 5음 구성은?', choices: ['도-레-미-솔-라', '도-미♭-파-솔-시♭', '미♭-파-솔-시♭-도', '도-레-파-솔-라'], answer: 1, explain: '계면조 = 슬프고 애절한 느낌. 도-미♭-파-솔-시♭ 식의 단조 계열 5음.', difficulty: 3 },
    { category: 'korean', q: '판소리 진양조의 박자는?', choices: ['12박 (3+3+3+3)', '4박', '6박', '9박'], answer: 0, explain: '진양조 = 가장 느린 장단. 24박 (6/8 으로 4 마디) 또는 12박으로 표기.', difficulty: 3 },
    { category: 'korean', q: '단소의 음역대는 (대략)?', choices: ['1 옥타브', '2 옥타브', '3 옥타브', '4 옥타브'], answer: 1, explain: '단소 = 약 2 옥타브 (저음 황종 ~ 고음 황종 위 1 옥타브). 일종의 통소.', difficulty: 2 },
    { category: 'korean', q: '가야금의 줄 수는 (정악 가야금)?', choices: ['8', '10', '12', '13'], answer: 2, explain: '정악 가야금 = 12현. 산조 가야금 = 12 또는 18현 (개량형 18현, 21현, 25현 다양).', difficulty: 2 }
];

export const ALL_QUESTIONS: Question[] = [
    ...interval, ...chord, ...key, ...progression, ...rhythm, ...korean
];

export const QUESTIONS_BY_CATEGORY: Record<Category, Question[]> = {
    interval, chord, key, progression, rhythm, korean
};

export const CATEGORIES: Category[] = ['interval', 'chord', 'key', 'progression', 'rhythm', 'korean'];
