export const STEPS = 32;
export const PITCHES = 24;
export const LOWEST_MIDI = 36;

export type Cells = boolean[][];

export interface Track {
    id: string;
    name: string;
    instrument: 'piano' | 'bass' | 'strings' | 'drums';
    cells: Cells;
    mute: boolean;
    solo: boolean;
    volume: number;
}

export function emptyCells(): Cells {
    return Array.from({ length: PITCHES }, () => Array<boolean>(STEPS).fill(false));
}

export function newTrack(name: string, instrument: Track['instrument']): Track {
    return {
        id: Math.random().toString(36).slice(2, 9),
        name,
        instrument,
        cells: emptyCells(),
        mute: false,
        solo: false,
        volume: -8
    };
}

export function rowToMidi(row: number, lowest = LOWEST_MIDI): number {
    return lowest + (PITCHES - 1 - row);
}

export function midiToNoteName(midi: number): string {
    const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
