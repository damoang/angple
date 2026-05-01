type ToneModule = typeof import('tone');

let _tone: ToneModule | null = null;

export async function getTone(): Promise<ToneModule> {
    if (!_tone) {
        _tone = await import('tone');
    }
    return _tone;
}

export async function ensureAudioReady(): Promise<void> {
    const Tone = await getTone();
    if (Tone.getContext().state !== 'running') {
        await Tone.start();
    }
}

let synth: import('tone').PolySynth | null = null;

export async function getSynth() {
    if (!synth) {
        const Tone = await getTone();
        synth = new Tone.PolySynth(Tone.Synth, {
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.4 }
        }).toDestination();
        synth.volume.value = -8;
    }
    return synth;
}

export function midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

export async function previewNote(midi: number, durationSec = 0.25) {
    await ensureAudioReady();
    const s = await getSynth();
    s.triggerAttackRelease(midiToFreq(midi), durationSec);
}

export function disposeSynth() {
    if (synth) {
        synth.dispose();
        synth = null;
    }
}
