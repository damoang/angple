/** MusicXML 변환 유틸 — DOMParser 기반 mutate, 그 후 XMLSerializer */

const NOTE_BASE: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
};
const PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function parseXml(xml: string): Document {
    return new DOMParser().parseFromString(xml, 'application/xml');
}

export function serialize(doc: Document): string {
    return new XMLSerializer().serializeToString(doc);
}

interface PitchInfo {
    step: string;
    octave: number;
    alter: number;
}

function pitchToMidi(p: PitchInfo): number {
    return (p.octave + 1) * 12 + NOTE_BASE[p.step] + p.alter;
}

function midiToPitch(midi: number): PitchInfo {
    const oct = Math.floor(midi / 12) - 1;
    const note = PITCHES[((midi % 12) + 12) % 12];
    const sharp = note.includes('#');
    const step = sharp ? note[0] : note;
    return { step, octave: oct, alter: sharp ? 1 : 0 };
}

export function transposeAll(doc: Document, semitones: number): void {
    if (!semitones) return;
    const notes = Array.from(doc.querySelectorAll('note'));
    for (const note of notes) {
        const pitch = note.querySelector('pitch');
        if (!pitch) continue;
        const stepEl = pitch.querySelector('step');
        const octEl = pitch.querySelector('octave');
        const alterEl = pitch.querySelector('alter');
        if (!stepEl || !octEl) continue;

        const step = stepEl.textContent || 'C';
        const oct = parseInt(octEl.textContent || '4', 10);
        const alter = parseInt(alterEl?.textContent || '0', 10);
        const midi = pitchToMidi({ step, octave: oct, alter });
        const next = midiToPitch(midi + semitones);

        stepEl.textContent = next.step;
        octEl.textContent = String(next.octave);
        if (next.alter !== 0) {
            if (alterEl) {
                alterEl.textContent = String(next.alter);
            } else {
                const alterNew = doc.createElement('alter');
                alterNew.textContent = String(next.alter);
                stepEl.after(alterNew);
            }
        } else if (alterEl) {
            alterEl.remove();
        }
    }
}

const KEY_FIFTHS: Record<string, number> = {
    'C-major': 0,
    'G-major': 1,
    'D-major': 2,
    'A-major': 3,
    'E-major': 4,
    'B-major': 5,
    'F#-major': 6,
    'C#-major': 7,
    'F-major': -1,
    'Bb-major': -2,
    'Eb-major': -3,
    'Ab-major': -4,
    'Db-major': -5,
    'Gb-major': -6,
    'Cb-major': -7,
    'A-minor': 0,
    'E-minor': 1,
    'B-minor': 2,
    'F#-minor': 3,
    'C#-minor': 4,
    'D-minor': -1,
    'G-minor': -2,
    'C-minor': -3,
    'F-minor': -4,
    'Bb-minor': -5,
    'Eb-minor': -6
};

export function changeKeyAll(doc: Document, keyLabel: string): void {
    const fifths = KEY_FIFTHS[keyLabel];
    if (fifths === undefined) return;
    const mode = keyLabel.includes('minor') ? 'minor' : 'major';
    const keys = Array.from(doc.querySelectorAll('attributes > key'));
    for (const key of keys) {
        let f = key.querySelector('fifths');
        if (!f) {
            f = doc.createElement('fifths');
            key.prepend(f);
        }
        f.textContent = String(fifths);
        let m = key.querySelector('mode');
        if (!m) {
            m = doc.createElement('mode');
            key.appendChild(m);
        }
        m.textContent = mode;
    }
}

export function downloadXml(doc: Document, filename = 'edited.musicxml'): void {
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + serialize(doc);
    const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

export const KEY_OPTIONS = Object.keys(KEY_FIFTHS);
