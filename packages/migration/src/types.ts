/**
 * 마이그레이션 공통 타입 정의
 */

/** 지원하는 마이그레이션 소스 */
export type MigrationSource = 'gnuboard' | 'rhymix';

/** DB 연결 설정 */
export interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    /** 그누보드 테이블 접두사 (기본: g5_) */
    tablePrefix?: string;
}

/** 마이그레이션 진행 상태 */
export interface MigrationProgress {
    phase: MigrationPhase;
    current: number;
    total: number;
    message: string;
    /** 0~100 퍼센트 */
    percent: number;
    errors: MigrationError[];
}

/** 마이그레이션 단계 */
export type MigrationPhase =
    | 'connecting'
    | 'analyzing'
    | 'members'
    | 'boards'
    | 'board_groups'
    | 'posts'
    | 'comments'
    | 'points'
    | 'attachments'
    | 'verifying'
    | 'done'
    | 'error';

/** 마이그레이션 에러 */
export interface MigrationError {
    phase: MigrationPhase;
    table?: string;
    row?: number;
    message: string;
    detail?: string;
}

/** 마이그레이션 사전 분석 결과 */
export interface MigrationAnalysis {
    source: MigrationSource;
    version?: string;
    tables: TableAnalysis[];
    totalRows: number;
    estimatedTime: string;
    warnings: string[];
}

/** 테이블 분석 */
export interface TableAnalysis {
    sourceTable: string;
    targetTable: string;
    rowCount: number;
    hasData: boolean;
}

/** 마이그레이션 옵션 */
export interface MigrationOptions {
    /** 소스 DB 연결 설정 */
    sourceDb: DatabaseConfig;
    /** 대상 DB 연결 설정 (Angple) */
    targetDb: DatabaseConfig;
    /** 테이블 접두사 (그누보드: g5_, 라이믹스: xe_) */
    tablePrefix: string;
    /** 게시판 필터 (비워두면 전체) */
    boardFilter?: string[];
    /** 첨부파일 마이그레이션 여부 */
    migrateAttachments: boolean;
    /** 첨부파일 소스 경로 (그누보드: g5_data/file/) */
    attachmentSourcePath?: string;
    /** 첨부파일 대상 경로 */
    attachmentTargetPath?: string;
    /** 비밀번호 호환 모드 (PHP password_hash 그대로 유지) */
    keepPhpPasswords: boolean;
    /** dry-run 모드 (실제 쓰기 없이 시뮬레이션) */
    dryRun: boolean;
    /** 진행 콜백 */
    onProgress?: (progress: MigrationProgress) => void;
}

/** 마이그레이션 최종 결과 */
export interface MigrationResult {
    success: boolean;
    source: MigrationSource;
    startedAt: Date;
    completedAt: Date;
    duration: number;
    stats: MigrationStats;
    errors: MigrationError[];
}

/** 마이그레이션 통계 */
export interface MigrationStats {
    members: { total: number; migrated: number; skipped: number };
    boards: { total: number; migrated: number; skipped: number };
    boardGroups: { total: number; migrated: number; skipped: number };
    posts: { total: number; migrated: number; skipped: number };
    comments: { total: number; migrated: number; skipped: number };
    points: { total: number; migrated: number; skipped: number };
    attachments: { total: number; migrated: number; skipped: number };
}

/** 빈 통계 객체 생성 */
export function createEmptyStats(): MigrationStats {
    const zero = { total: 0, migrated: 0, skipped: 0 };
    return {
        members: { ...zero },
        boards: { ...zero },
        boardGroups: { ...zero },
        posts: { ...zero },
        comments: { ...zero },
        points: { ...zero },
        attachments: { ...zero }
    };
}
