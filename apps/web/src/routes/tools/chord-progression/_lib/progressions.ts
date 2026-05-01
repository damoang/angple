export type Genre = 'pop' | 'kpop' | 'ccm' | 'jazz' | 'blues' | 'edm' | 'hiphop' | 'folk' | 'trot' | 'rock';

export interface Progression {
    name: string;
    genre: Genre;
    roman: string[];
    desc: string;
}

export const GENRE_LABEL: Record<Genre, string> = {
    pop: '팝',
    kpop: 'K-Pop',
    ccm: 'CCM (찬양)',
    jazz: '재즈',
    blues: '블루스',
    edm: 'EDM',
    hiphop: '힙합',
    folk: '포크',
    trot: '트로트',
    rock: '록'
};

export const GENRE_ICON: Record<Genre, string> = {
    pop: '🎤', kpop: '🇰🇷', ccm: '✝️', jazz: '🎷', blues: '🎸',
    edm: '🎧', hiphop: '🎙️', folk: '🪕', trot: '🌹', rock: '🤘'
};

export const PROGRESSIONS: Progression[] = [
    // 팝 (5)
    { name: 'I-V-vi-IV (황금 진행)', genre: 'pop', roman: ['I', 'V', 'vi', 'IV'], desc: '팝 음악 80% 기반. Let It Be / 수많은 K-Pop 발라드.' },
    { name: '50년대 진행', genre: 'pop', roman: ['I', 'vi', 'IV', 'V'], desc: 'Doowop / Stand By Me / Earth Angel — 50~60년대 표준.' },
    { name: 'I-IV-V-I', genre: 'pop', roman: ['I', 'IV', 'V', 'I'], desc: '팝 / 록 / 컨트리 의 가장 단순하고 강력한 진행.' },
    { name: 'I-V-IV-V', genre: 'pop', roman: ['I', 'V', 'IV', 'V'], desc: '록앤롤 / 팝의 활기찬 진행. Twist and Shout.' },
    { name: 'I-iii-IV-V', genre: 'pop', roman: ['I', 'iii', 'IV', 'V'], desc: '부드러운 도약. 60년대 팝 / 발라드.' },

    // K-Pop (5)
    { name: 'vi-IV-I-V (K-Pop 4 코드)', genre: 'kpop', roman: ['vi', 'IV', 'I', 'V'], desc: '슬픈 K-발라드 시작. 마이너 느낌의 메이저 진행. 수많은 발라드.' },
    { name: 'IV-V-iii-vi (K-발라드)', genre: 'kpop', roman: ['IV', 'V', 'iii', 'vi'], desc: '한국 발라드의 정석. 후렴 진행으로 감정 고조.' },
    { name: 'I-V-vi-iii-IV-I-IV-V (카논)', genre: 'kpop', roman: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'], desc: '파헬벨 카논 진행. K-발라드 대히트곡들이 차용.' },
    { name: 'vi-V-IV-V (감성 K-Pop)', genre: 'kpop', roman: ['vi', 'V', 'IV', 'V'], desc: '마이너로 시작 → 메이저 도미넌트 회귀. 슬픔+희망.' },
    { name: 'I-V/vi-vi-IV (이차 도미넌트)', genre: 'kpop', roman: ['I', 'V/vi', 'vi', 'IV'], desc: 'V/vi = vi 의 도미넌트. 세련된 K-Pop / CCM 코드 변화.' },

    // CCM / 찬양 (4)
    { name: 'I-IV-I-V (찬송가)', genre: 'ccm', roman: ['I', 'IV', 'I', 'V'], desc: '전통 찬송가의 단순한 T-S-T-D 진행.' },
    { name: 'I-V-vi-IV (현대 CCM)', genre: 'ccm', roman: ['I', 'V', 'vi', 'IV'], desc: '현대 CCM 의 대표 진행. Hillsong / Bethel 등.' },
    { name: 'IV-I (플라갈 종지 / 아멘)', genre: 'ccm', roman: ['IV', 'I'], desc: '찬송가 끝의 "아멘" 종지. 평안한 종결.' },
    { name: 'vi-IV-I-V (감사 진행)', genre: 'ccm', roman: ['vi', 'IV', 'I', 'V'], desc: '감성 찬양곡. K-CCM / 한국 교회음악에 자주.' },

    // 재즈 (5)
    { name: 'ii-V-I (재즈 기본)', genre: 'jazz', roman: ['ii', 'V', 'I'], desc: '재즈 / 보사노바의 핵심. 부드러운 해결감.' },
    { name: 'iim7♭5-V7-i (마이너 ii-V-i)', genre: 'jazz', roman: ['ii', 'V', 'i'], desc: '마이너 키의 ii-V-i. 어두운 재즈 발라드.' },
    { name: 'I-vi-ii-V (재즈 turnaround)', genre: 'jazz', roman: ['I', 'vi', 'ii', 'V'], desc: '8 마디 끝의 회기 패턴. Rhythm Changes A 섹션.' },
    { name: 'I-VI7-ii-V (보사노바)', genre: 'jazz', roman: ['I', 'VI7', 'ii', 'V'], desc: 'VI7 = 이차 도미넌트. 보사노바 / 재즈의 색채 화음.' },
    { name: 'iii-vi-ii-V (재즈 다이어토닉)', genre: 'jazz', roman: ['iii', 'vi', 'ii', 'V'], desc: '4도 하행 시퀀스. 재즈 곡에서 흔한 패턴.' },

    // 블루스 (3)
    { name: '12-bar Blues (단순)', genre: 'blues', roman: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'], desc: '블루스 / 록의 뿌리. 12 마디 표준.' },
    { name: '12-bar Blues (Quick Change)', genre: 'blues', roman: ['I', 'IV', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'], desc: '2 마디에 IV 미리 등장. 더 다이내믹.' },
    { name: 'I-IV-V (블루스 3 코드)', genre: 'blues', roman: ['I', 'IV', 'V'], desc: '블루스의 본질. 3 코드만으로 모든 블루스.' },

    // EDM (3)
    { name: 'i-VI-III-VII (EDM 마이너)', genre: 'edm', roman: ['i', 'VI', 'III', 'VII'], desc: 'EDM 댄스의 표준 마이너 진행. Avicii / Martin Garrix.' },
    { name: 'vi-IV-I-V (Electro Pop)', genre: 'edm', roman: ['vi', 'IV', 'I', 'V'], desc: '일렉트로닉 팝 빌드업. Drop 직전 긴장.' },
    { name: 'i-VII-VI-VII (4 코드 루프)', genre: 'edm', roman: ['i', 'VII', 'VI', 'VII'], desc: '단순 4 코드 루프. 트랜스 / 하우스의 토대.' },

    // 힙합 (3)
    { name: 'i-iv-v (마이너 힙합)', genre: 'hiphop', roman: ['i', 'iv', 'v'], desc: '서부 / 트랩 힙합의 어두운 마이너 3 코드.' },
    { name: 'vi-V-IV (힙합 멜로디)', genre: 'hiphop', roman: ['vi', 'V', 'IV'], desc: '90~2000년대 힙합 / R&B 의 멜랑콜리 진행.' },
    { name: 'i-VI-VII (G-Funk)', genre: 'hiphop', roman: ['i', 'VI', 'VII'], desc: 'Dr. Dre / Snoop Dogg G-funk 의 단조 진행.' },

    // 포크 (2)
    { name: 'I-V-vi-iii-IV (포크)', genre: 'folk', roman: ['I', 'V', 'vi', 'iii', 'IV'], desc: 'Bob Dylan / 한국 포크의 서정적 진행.' },
    { name: 'I-IV-I-V (포크 3 코드)', genre: 'folk', roman: ['I', 'IV', 'I', 'V'], desc: '통기타 포크의 가장 기본 진행.' },

    // 트로트 (2)
    { name: 'I-IV-V (트로트 기본)', genre: 'trot', roman: ['I', 'IV', 'V'], desc: '트로트 = 3 코드 음악. T-S-D 의 정석.' },
    { name: 'I-V-I-IV-V-I (트로트 후렴)', genre: 'trot', roman: ['I', 'V', 'I', 'IV', 'V', 'I'], desc: '트로트 후렴 패턴. 강한 종결감.' },

    // 록 (3)
    { name: 'I-♭VII-IV (믹솔리디안 록)', genre: 'rock', roman: ['I', '♭VII', 'IV'], desc: 'Sweet Home Alabama / Free Bird. 클래식 록의 정석.' },
    { name: '안달루시안 (i-VII-VI-V)', genre: 'rock', roman: ['i', 'VII', 'VI', 'V'], desc: '플라멩코 / 어두운 록. Hit the Road Jack.' },
    { name: 'I-V-vi-IV (얼터 록)', genre: 'rock', roman: ['I', 'V', 'vi', 'IV'], desc: '90s 얼터너티브 록의 핵심 진행. Green Day / Nirvana.' }
];

export const GENRES: Genre[] = ['pop', 'kpop', 'ccm', 'jazz', 'blues', 'edm', 'hiphop', 'folk', 'trot', 'rock'];
