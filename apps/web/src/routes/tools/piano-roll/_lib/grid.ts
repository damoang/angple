export const STEPS = 16;
export const PITCHES = 24;
export const LOWEST_MIDI = 48;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function rowToMidi(row: number): number {
    return LOWEST_MIDI + (PITCHES - 1 - row);
}

export function midiToNoteName(midi: number): string {
    const name = NOTE_NAMES[midi % 12];
    const oct = Math.floor(midi / 12) - 1;
    return `${name}${oct}`;
}

export function rowIsBlackKey(row: number): boolean {
    const midi = rowToMidi(row);
    return [1, 3, 6, 8, 10].includes(midi % 12);
}

export function stepIsBeatStart(step: number): boolean {
    return step % 4 === 0;
}

export type Cells = boolean[][];

export function emptyCells(): Cells {
    return Array.from({ length: PITCHES }, () => Array<boolean>(STEPS).fill(false));
}

export function cloneCells(c: Cells): Cells {
    return c.map((row) => row.slice());
}

export function activeNotesAtStep(cells: Cells, step: number): number[] {
    const out: number[] = [];
    for (let row = 0; row < PITCHES; row++) {
        if (cells[row][step]) out.push(rowToMidi(row));
    }
    return out;
}
