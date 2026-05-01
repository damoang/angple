import type { Cells } from './grid';
import { STEPS, PITCHES } from './grid';

const KEY = 'muzia.tool.piano-roll.v1';

export interface PianoRollState {
    bpm: number;
    cells: Cells;
}

interface SerializedState {
    bpm: number;
    cells: number[];
}

function packCells(cells: Cells): number[] {
    const flat: number[] = [];
    for (let r = 0; r < PITCHES; r++) {
        let bits = 0;
        for (let s = 0; s < STEPS; s++) {
            if (cells[r][s]) bits |= 1 << s;
        }
        flat.push(bits);
    }
    return flat;
}

function unpackCells(packed: number[]): Cells {
    const cells: Cells = Array.from({ length: PITCHES }, () => Array<boolean>(STEPS).fill(false));
    for (let r = 0; r < Math.min(packed.length, PITCHES); r++) {
        for (let s = 0; s < STEPS; s++) {
            cells[r][s] = (packed[r] & (1 << s)) !== 0;
        }
    }
    return cells;
}

export function saveLocal(state: PianoRollState): void {
    if (typeof localStorage === 'undefined') return;
    const data: SerializedState = { bpm: state.bpm, cells: packCells(state.cells) };
    localStorage.setItem(KEY, JSON.stringify(data));
}

export function loadLocal(): PianoRollState | null {
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw) as SerializedState;
        return { bpm: data.bpm, cells: unpackCells(data.cells) };
    } catch {
        return null;
    }
}

export function toShareHash(state: PianoRollState): string {
    const data: SerializedState = { bpm: state.bpm, cells: packCells(state.cells) };
    return btoa(JSON.stringify(data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromShareHash(hash: string): PianoRollState | null {
    try {
        const padded = hash.replace(/-/g, '+').replace(/_/g, '/');
        const data = JSON.parse(atob(padded)) as SerializedState;
        return { bpm: data.bpm, cells: unpackCells(data.cells) };
    } catch {
        return null;
    }
}
