export interface Scale {
    name: string;
    nameEn: string;
    intervals: number[]; // semitones from root
    desc: string;
    descEn: string;
    family: 'major' | 'minor' | 'mode' | 'pentatonic' | 'blues' | 'korean' | 'world';
}

export const SCALES: Scale[] = [
    { name: '메이저 (장조)', nameEn: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11], desc: '서양 음악의 기본 — 도레미파솔라시', descEn: 'Western base scale — do re mi fa sol la ti', family: 'major' },
    { name: '자연 단음계', nameEn: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10], desc: '에올리안 모드와 동일 — 슬프고 차분한 느낌', descEn: 'Same as Aeolian mode — sad and calm', family: 'minor' },
    { name: '화성 단음계', nameEn: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11], desc: '7음을 반음 올림 — 도음 인력 강함', descEn: '7th raised — strong leading tone', family: 'minor' },
    { name: '선율 단음계 (상행)', nameEn: 'Melodic Minor (asc)', intervals: [0, 2, 3, 5, 7, 9, 11], desc: '상행 시 6,7 모두 반음 올림', descEn: 'Both 6 and 7 raised when ascending', family: 'minor' },
    { name: '도리안', nameEn: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], desc: '재즈 / 록 / 켈틱 — 마이너이면서 밝은 느낌', descEn: 'Jazz / Rock / Celtic — minor with brightness', family: 'mode' },
    { name: '프리지안', nameEn: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], desc: '플라멩코 / 스페인 — 어둡고 이국적', descEn: 'Flamenco / Spanish — dark and exotic', family: 'mode' },
    { name: '리디안', nameEn: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], desc: '꿈같은 느낌 — 4음 ♯', descEn: 'Dreamy feel — sharp 4th', family: 'mode' },
    { name: '믹솔리디안', nameEn: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], desc: '록 / 블루스 — 메이저이면서 7음 ♭', descEn: 'Rock / Blues — major with flat 7th', family: 'mode' },
    { name: '로크리안', nameEn: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], desc: '가장 불안정한 모드 — 거의 사용 안 함', descEn: 'Most unstable mode — rarely used', family: 'mode' },
    { name: '메이저 펜타토닉', nameEn: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9], desc: 'K-Pop / 컨트리 / 동요 — 가장 안정적인 5음', descEn: 'K-Pop / Country / Folk — safest 5 notes', family: 'pentatonic' },
    { name: '마이너 펜타토닉', nameEn: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10], desc: '록 / 블루스 / 즉흥 연주의 기본', descEn: 'Foundation of Rock / Blues / improvisation', family: 'pentatonic' },
    { name: '블루스 스케일', nameEn: 'Blues Scale', intervals: [0, 3, 5, 6, 7, 10], desc: '블루스 노트 (♭5) 추가된 마이너 펜타', descEn: 'Minor pentatonic + blue note (♭5)', family: 'blues' },
    { name: '평조 (한국)', nameEn: 'Pyeongjo (Korean)', intervals: [0, 2, 4, 7, 9], desc: '한국 전통 5음 — 밝고 평온', descEn: 'Korean traditional 5-note — bright and calm', family: 'korean' },
    { name: '계면조 (한국)', nameEn: 'Gyemyeonjo (Korean)', intervals: [0, 3, 5, 7, 10], desc: '한국 전통 5음 — 슬픔과 한', descEn: 'Korean traditional 5-note — sorrow and han', family: 'korean' },
    { name: '히로조시 (일본)', nameEn: 'Hirajoshi (Japan)', intervals: [0, 2, 3, 7, 8], desc: '일본 전통 음계 — 신비로운 느낌', descEn: 'Japanese traditional — mysterious feel', family: 'world' },
    { name: '집시 / 헝가리안', nameEn: 'Gypsy / Hungarian', intervals: [0, 2, 3, 6, 7, 8, 11], desc: '동유럽 집시 음악', descEn: 'Eastern European Gypsy', family: 'world' }
];

export const ROOTS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function noteAt(rootIdx: number, semitones: number): string {
    return ROOTS[(rootIdx + semitones) % 12];
}

export function midiAt(rootMidi: number, semitones: number): number {
    return rootMidi + semitones;
}
