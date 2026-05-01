type OsmdModule = typeof import('opensheetmusicdisplay');

let _osmd: OsmdModule | null = null;

export async function getOSMD(): Promise<OsmdModule> {
    if (!_osmd) {
        _osmd = await import('opensheetmusicdisplay');
    }
    return _osmd;
}

export async function readMxlOrXml(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const head = new Uint8Array(buf.slice(0, 4));
    const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;

    if (!isZip) {
        return new TextDecoder('utf-8').decode(buf);
    }

    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(buf);

    const containerFile = zip.file('META-INF/container.xml');
    let scorePath: string | null = null;
    if (containerFile) {
        const containerXml = await containerFile.async('string');
        const match = containerXml.match(/<rootfile[^>]+full-path="([^"]+)"/);
        if (match) scorePath = match[1];
    }
    if (!scorePath) {
        const candidate = Object.keys(zip.files).find(
            (n) => n.endsWith('.xml') || n.endsWith('.musicxml')
        );
        if (!candidate) throw new Error('MusicXML 본문을 찾지 못했습니다.');
        scorePath = candidate;
    }
    const file2 = zip.file(scorePath);
    if (!file2) throw new Error(`MXL 압축 안에 ${scorePath} 없음`);
    return file2.async('string');
}
