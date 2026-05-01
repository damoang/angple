import type { Track } from './track';
import { STEPS, PITCHES, rowToMidi } from './track';

let _midi: typeof import('@tonejs/midi') | null = null;
async function getMidi() {
    if (!_midi) _midi = await import('@tonejs/midi');
    return _midi;
}

export async function exportMidi(tracks: Track[], bpm: number): Promise<Blob> {
    const { Midi } = await getMidi();
    const midi = new Midi();
    midi.header.setTempo(bpm);

    const sixteenth = 60 / bpm / 4;

    for (const tr of tracks) {
        const t = midi.addTrack();
        t.name = tr.name;
        for (let row = 0; row < PITCHES; row++) {
            for (let s = 0; s < STEPS; s++) {
                if (!tr.cells[row][s]) continue;
                const midiPitch = rowToMidi(row);
                t.addNote({
                    midi: midiPitch,
                    time: s * sixteenth,
                    duration: sixteenth * 0.95,
                    velocity: tr.mute ? 0 : 0.85
                });
            }
        }
    }

    const u8 = midi.toArray();
    return new Blob([new Uint8Array(u8)], { type: 'audio/midi' });
}

export async function importMidi(file: File): Promise<{ tracks: Track[]; bpm: number }> {
    const { Midi } = await getMidi();
    const buf = await file.arrayBuffer();
    const midi = new Midi(buf);
    const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 120);

    const sixteenth = 60 / bpm / 4;

    const tracks: Track[] = [];
    for (const t of midi.tracks.slice(0, 4)) {
        const cells: boolean[][] = Array.from({ length: PITCHES }, () => Array<boolean>(STEPS).fill(false));
        for (const note of t.notes) {
            const step = Math.round(note.time / sixteenth);
            if (step < 0 || step >= STEPS) continue;
            const row = PITCHES - 1 - (note.midi - 36);
            if (row < 0 || row >= PITCHES) continue;
            cells[row][step] = true;
        }
        tracks.push({
            id: Math.random().toString(36).slice(2, 9),
            name: t.name || `Track ${tracks.length + 1}`,
            instrument: 'piano',
            cells,
            mute: false,
            solo: false,
            volume: -8
        });
    }
    if (tracks.length === 0) {
        tracks.push({
            id: Math.random().toString(36).slice(2, 9),
            name: 'Track 1',
            instrument: 'piano',
            cells: Array.from({ length: PITCHES }, () => Array<boolean>(STEPS).fill(false)),
            mute: false,
            solo: false,
            volume: -8
        });
    }
    return { tracks, bpm };
}

export function downloadBlob(blob: Blob, filename: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}
