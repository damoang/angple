const ABBREVIATIONS: Record<string, string> = {
    자유게시판: '자유',
    '새로운 소식': '소식'
};

export function shortenBoardName(name: string, maxLen = 2): string {
    return ABBREVIATIONS[name] ?? (name.length > maxLen ? name.slice(0, maxLen) : name);
}
