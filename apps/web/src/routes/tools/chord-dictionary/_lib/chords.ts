export interface ChordType {
    suffix: string;          // 코드 표기 ('', 'm', '7', 'maj7', 'sus4' 등)
    nameKo: string;
    nameEn: string;
    intervals: number[];     // semitones from root
    family: 'triad' | 'seventh' | 'extended' | 'sus' | 'altered';
    desc: string;
    descEn: string;
}

export const CHORD_TYPES: ChordType[] = [
    // Triads (4)
    { suffix: '', nameKo: '메이저', nameEn: 'Major', intervals: [0, 4, 7], family: 'triad', desc: '근음 + 장3 + 완5', descEn: 'Root + M3 + P5' },
    { suffix: 'm', nameKo: '마이너', nameEn: 'Minor', intervals: [0, 3, 7], family: 'triad', desc: '근음 + 단3 + 완5', descEn: 'Root + m3 + P5' },
    { suffix: 'dim', nameKo: '감화음', nameEn: 'Diminished', intervals: [0, 3, 6], family: 'triad', desc: '근음 + 단3 + 감5', descEn: 'Root + m3 + d5' },
    { suffix: 'aug', nameKo: '증화음', nameEn: 'Augmented', intervals: [0, 4, 8], family: 'triad', desc: '근음 + 장3 + 증5', descEn: 'Root + M3 + A5' },

    // 7th (5)
    { suffix: 'maj7', nameKo: '메이저 7', nameEn: 'Major 7th', intervals: [0, 4, 7, 11], family: 'seventh', desc: '메이저 + 장7', descEn: 'Major + M7' },
    { suffix: '7', nameKo: '도미넌트 7', nameEn: 'Dominant 7th', intervals: [0, 4, 7, 10], family: 'seventh', desc: '메이저 + 단7', descEn: 'Major + m7' },
    { suffix: 'm7', nameKo: '마이너 7', nameEn: 'Minor 7th', intervals: [0, 3, 7, 10], family: 'seventh', desc: '마이너 + 단7', descEn: 'Minor + m7' },
    { suffix: 'mMaj7', nameKo: '마이너 메이저 7', nameEn: 'Minor Major 7th', intervals: [0, 3, 7, 11], family: 'seventh', desc: '마이너 + 장7', descEn: 'Minor + M7' },
    { suffix: 'm7♭5', nameKo: '반감 7 (m7♭5)', nameEn: 'Half-diminished', intervals: [0, 3, 6, 10], family: 'seventh', desc: '감 + 단7 (반감)', descEn: 'Dim + m7 (half-dim)' },

    // Extended (9/11/13) (5)
    { suffix: 'add9', nameKo: 'add9', nameEn: 'add9', intervals: [0, 4, 7, 14], family: 'extended', desc: '메이저 + 9 (7 없이)', descEn: 'Major + 9 (no 7th)' },
    { suffix: '9', nameKo: '도미넌트 9', nameEn: 'Dominant 9th', intervals: [0, 4, 7, 10, 14], family: 'extended', desc: '도미넌트 7 + 9', descEn: 'Dom 7 + 9' },
    { suffix: 'maj9', nameKo: '메이저 9', nameEn: 'Major 9th', intervals: [0, 4, 7, 11, 14], family: 'extended', desc: '메이저 7 + 9', descEn: 'Maj 7 + 9' },
    { suffix: 'm9', nameKo: '마이너 9', nameEn: 'Minor 9th', intervals: [0, 3, 7, 10, 14], family: 'extended', desc: '마이너 7 + 9', descEn: 'Min 7 + 9' },
    { suffix: '11', nameKo: '도미넌트 11', nameEn: 'Dominant 11th', intervals: [0, 7, 10, 14, 17], family: 'extended', desc: '도미넌트 + 11 (3음 생략 흔함)', descEn: 'Dom + 11 (3rd often omitted)' },
    { suffix: '13', nameKo: '도미넌트 13', nameEn: 'Dominant 13th', intervals: [0, 4, 7, 10, 14, 21], family: 'extended', desc: '도미넌트 + 13 (11 생략 흔함)', descEn: 'Dom + 13 (11th often omitted)' },

    // Sus + 6 (4)
    { suffix: 'sus2', nameKo: 'sus2', nameEn: 'sus2', intervals: [0, 2, 7], family: 'sus', desc: '3음 → 2음', descEn: '3rd replaced with 2nd' },
    { suffix: 'sus4', nameKo: 'sus4', nameEn: 'sus4', intervals: [0, 5, 7], family: 'sus', desc: '3음 → 4음', descEn: '3rd replaced with 4th' },
    { suffix: '6', nameKo: '메이저 6', nameEn: 'Major 6th', intervals: [0, 4, 7, 9], family: 'sus', desc: '메이저 + 6', descEn: 'Major + 6' },
    { suffix: 'm6', nameKo: '마이너 6', nameEn: 'Minor 6th', intervals: [0, 3, 7, 9], family: 'sus', desc: '마이너 + 6', descEn: 'Minor + 6' },

    // Altered (8)
    { suffix: '7♭5', nameKo: '도미넌트 7♭5', nameEn: 'Dom 7♭5', intervals: [0, 4, 6, 10], family: 'altered', desc: '도미넌트 + ♭5 (트라이톤)', descEn: 'Dom + ♭5 (tritone)' },
    { suffix: '7♯5', nameKo: '도미넌트 7♯5', nameEn: 'Dom 7♯5', intervals: [0, 4, 8, 10], family: 'altered', desc: '도미넌트 + ♯5 (증)', descEn: 'Dom + ♯5 (aug)' },
    { suffix: '7♭9', nameKo: '도미넌트 7♭9', nameEn: 'Dom 7♭9', intervals: [0, 4, 7, 10, 13], family: 'altered', desc: '도미넌트 + ♭9', descEn: 'Dom + ♭9' },
    { suffix: '7♯9', nameKo: '도미넌트 7♯9 (Hendrix)', nameEn: 'Dom 7♯9 (Hendrix)', intervals: [0, 4, 7, 10, 15], family: 'altered', desc: 'Hendrix 코드 — 록 / 펑크', descEn: 'Hendrix chord — rock / funk' },
    { suffix: 'dim7', nameKo: '감 7', nameEn: 'Diminished 7th', intervals: [0, 3, 6, 9], family: 'altered', desc: '단3 × 3 (모두 동일 간격)', descEn: 'm3 × 3 (all equal)' },
    { suffix: '7sus4', nameKo: '도미넌트 7 sus4', nameEn: 'Dom 7 sus4', intervals: [0, 5, 7, 10], family: 'altered', desc: 'sus4 + 단7', descEn: 'sus4 + m7' },
    { suffix: 'add11', nameKo: 'add11', nameEn: 'add11', intervals: [0, 4, 7, 17], family: 'altered', desc: '메이저 + 11 (9 없이)', descEn: 'Major + 11 (no 9)' },
    { suffix: 'maj7♯11', nameKo: 'maj7♯11 (Lydian)', nameEn: 'Maj7♯11', intervals: [0, 4, 7, 11, 18], family: 'altered', desc: '리디안 코드 — 신비로운 색채', descEn: 'Lydian chord — dreamy color' }
];

export const ROOTS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function noteAt(rootIdx: number, semitones: number): string {
    const oct = Math.floor(semitones / 12);
    const idx = (rootIdx + (semitones % 12) + 12) % 12;
    return ROOTS[idx] + (oct > 0 ? `+${oct}` : '');
}
