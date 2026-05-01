import type { Track } from './track';

let _tone: typeof import('tone') | null = null;
async function getTone() {
    if (!_tone) _tone = await import('tone');
    return _tone;
}

export interface ToneInstrument {
    triggerAttackRelease: (note: string | number, dur: string | number, time?: number) => void;
    volume: { value: number };
    dispose: () => void;
}

export async function createInstrument(kind: Track['instrument']): Promise<ToneInstrument> {
    const Tone = await getTone();
    let inst: any;
    switch (kind) {
        case 'piano':
            inst = new Tone.PolySynth(Tone.Synth, {
                envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.4 }
            }).toDestination();
            break;
        case 'bass':
            inst = new Tone.MonoSynth({
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2 },
                filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.5, baseFrequency: 200, octaves: 2 }
            }).toDestination();
            break;
        case 'strings':
            inst = new Tone.PolySynth(Tone.AMSynth, {
                envelope: { attack: 0.4, decay: 0.2, sustain: 0.6, release: 0.6 }
            }).toDestination();
            break;
        case 'drums':
            inst = new Tone.MembraneSynth({
                pitchDecay: 0.05,
                octaves: 4,
                envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.5 }
            }).toDestination();
            break;
    }
    return inst as ToneInstrument;
}

export const INSTRUMENT_LABEL: Record<Track['instrument'], string> = {
    piano: '🎹 Piano',
    bass: '🎸 Bass',
    strings: '🎻 Strings',
    drums: '🥁 Drums'
};
