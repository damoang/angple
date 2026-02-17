import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

export function toKebabCase(str: string): string {
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}

export function findProjectRoot(): string {
    let dir = process.cwd();
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return process.cwd();
}

export function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

export function writeFile(filePath: string, content: string): void {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf-8');
}

export function success(msg: string): void {
    console.log(pc.green('✓') + ' ' + msg);
}

export function info(msg: string): void {
    console.log(pc.blue('ℹ') + ' ' + msg);
}

export function error(msg: string): void {
    console.log(pc.red('✗') + ' ' + msg);
}
