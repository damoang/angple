/**
 * 라이믹스(XE) → Angple 스키마 매핑
 *
 * 라이믹스 테이블 구조:
 * - xe_member → Angple member
 * - xe_modules → Angple board
 * - xe_documents → Angple posts
 * - xe_comments → Angple comments
 * - xe_files → Angple attachments
 * - xe_point → Angple point
 * - xe_module_categories → Angple board categories
 */

/** 라이믹스 회원 (xe_member) */
export interface RhymixMember {
    member_srl: number;
    user_id: string;
    email_address: string;
    password: string;
    user_name: string;
    nick_name: string;
    find_account_question: number;
    find_account_answer: string;
    homepage: string;
    blog: string;
    birthday: string;
    allow_mailing: string;
    allow_message: string;
    denied: string;
    limit_date: string;
    regdate: string;
    last_login: string;
    change_password_date: string;
    is_admin: string;
    description: string;
    extra_vars: string;
    list_order: number;
}

/** 라이믹스 모듈 (게시판) (xe_modules) */
export interface RhymixModule {
    module_srl: number;
    module: string;
    module_category_srl: number;
    layout_srl: number;
    use_mobile: string;
    mlayout_srl: number;
    menu_srl: number;
    site_srl: number;
    mid: string;
    skin: string;
    mskin: string;
    browser_title: string;
    description: string;
    is_default: string;
    content: string;
    open_rss: string;
    header_text: string;
    footer_text: string;
    regdate: string;
}

/** 라이믹스 문서(게시글) (xe_documents) */
export interface RhymixDocument {
    document_srl: number;
    module_srl: number;
    category_srl: number;
    lang_code: string;
    is_notice: string;
    title: string;
    title_bold: string;
    title_color: string;
    content: string;
    readed_count: number;
    voted_count: number;
    blamed_count: number;
    comment_count: number;
    trackback_count: number;
    uploaded_count: number;
    password: string;
    user_id: string;
    user_name: string;
    nick_name: string;
    member_srl: number;
    email_address: string;
    homepage: string;
    tags: string;
    extra_vars: string;
    regdate: string;
    last_update: string;
    last_updater: string;
    ipaddress: string;
    list_order: number;
    update_order: number;
    allow_trackback: string;
    notify_message: string;
    status: string;
    comment_status: string;
}

/** 라이믹스 댓글 (xe_comments) */
export interface RhymixComment {
    comment_srl: number;
    module_srl: number;
    document_srl: number;
    parent_srl: number;
    is_secret: string;
    content: string;
    voted_count: number;
    blamed_count: number;
    notify_message: string;
    password: string;
    user_id: string;
    user_name: string;
    nick_name: string;
    member_srl: number;
    email_address: string;
    homepage: string;
    uploaded_count: number;
    regdate: string;
    last_update: string;
    ipaddress: string;
    list_order: number;
    status: number;
}

/** 라이믹스 첨부파일 (xe_files) */
export interface RhymixFile {
    file_srl: number;
    upload_target_srl: number;
    upload_target_type: string;
    module_srl: number;
    member_srl: number;
    source_filename: string;
    uploaded_filename: string;
    file_size: number;
    download_count: number;
    direct_download: string;
    cover_image: string;
    regdate: string;
    isvalid: string;
}

// ─── 변환 함수 ───

/**
 * 라이믹스 regdate (YYYYMMDDHHmmss) → ISO 8601 변환
 */
function rhymixDateToISO(regdate: string): string {
    if (!regdate || regdate.length < 14) return regdate;
    return `${regdate.slice(0, 4)}-${regdate.slice(4, 6)}-${regdate.slice(6, 8)}T${regdate.slice(8, 10)}:${regdate.slice(10, 12)}:${regdate.slice(12, 14)}`;
}

/**
 * 라이믹스 회원 → Angple 회원
 */
export function mapRhymixMemberToAngple(m: RhymixMember) {
    return {
        mb_id: m.user_id,
        mb_password: m.password, // 라이믹스도 bcrypt 사용 (XE3부터)
        mb_name: m.user_name,
        mb_nick: m.nick_name,
        mb_email: m.email_address,
        mb_homepage: m.homepage || '',
        mb_level: m.is_admin === 'Y' ? 10 : 2,
        mb_point: 0, // 별도 point 테이블에서 가져옴
        mb_ip: '',
        mb_datetime: rhymixDateToISO(m.regdate),
        mb_leave_date: null,
        mb_intercept_date: m.denied === 'Y' ? rhymixDateToISO(m.limit_date) : null,
        mb_memo: m.description || null
    };
}

/**
 * 라이믹스 모듈(게시판) → Angple 게시판
 */
export function mapRhymixModuleToAngple(m: RhymixModule) {
    return {
        bo_table: m.mid,
        bo_subject: m.browser_title,
        bo_skin: m.skin || 'default',
        gr_id: 'default', // 라이믹스는 그룹 개념이 다름 — 기본 그룹 사용
        bo_list_level: 1,
        bo_read_level: 1,
        bo_write_level: 2,
        bo_comment_level: 2,
        bo_page_rows: 15,
        bo_upload_count: 0,
        bo_order: 0,
        bo_count_write: 0,
        bo_count_comment: 0,
        description: m.description || ''
    };
}

/**
 * 라이믹스 문서 → Angple 게시글
 */
export function mapRhymixDocumentToAngple(d: RhymixDocument, boTable: string) {
    // extra_vars JSON 파싱
    let extras: Record<string, string> = {};
    if (d.extra_vars) {
        try {
            const parsed = JSON.parse(d.extra_vars);
            if (typeof parsed === 'object') {
                extras = parsed;
            }
        } catch {
            // JSON 파싱 실패 — 무시
        }
    }

    // 태그 파싱
    const tags = d.tags ? d.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];

    return {
        wr_id: d.document_srl,
        bo_table: boTable,
        wr_subject: d.title,
        wr_content: d.content,
        wr_name: d.nick_name || d.user_name,
        mb_id: d.user_id || `member_${d.member_srl}`,
        wr_datetime: rhymixDateToISO(d.regdate),
        wr_hit: d.readed_count || 0,
        wr_good: d.voted_count || 0,
        wr_nogood: d.blamed_count || 0,
        wr_comment: d.comment_count || 0,
        wr_link1: null,
        wr_link2: null,
        wr_ip: d.ipaddress || '',
        ca_name: null, // 카테고리는 category_srl에서 별도 매핑 필요
        is_secret: d.status === 'SECRET',
        is_notice: d.is_notice === 'Y',
        tags,
        // extra_vars를 extra_1~extra_10에 순서대로 매핑
        extra_1: Object.values(extras)[0] || null,
        extra_2: Object.values(extras)[1] || null,
        extra_3: Object.values(extras)[2] || null,
        extra_4: Object.values(extras)[3] || null,
        extra_5: Object.values(extras)[4] || null,
        extra_6: null,
        extra_7: null,
        extra_8: null,
        extra_9: null,
        extra_10: null
    };
}

/**
 * 라이믹스 댓글 → Angple 댓글
 */
export function mapRhymixCommentToAngple(c: RhymixComment, boTable: string) {
    return {
        wr_id: c.comment_srl,
        bo_table: boTable,
        wr_parent: c.document_srl,
        parent_comment_srl: c.parent_srl || null,
        wr_content: c.content,
        wr_name: c.nick_name || c.user_name,
        mb_id: c.user_id || `member_${c.member_srl}`,
        wr_datetime: rhymixDateToISO(c.regdate),
        wr_ip: c.ipaddress || '',
        wr_good: c.voted_count || 0,
        wr_nogood: c.blamed_count || 0,
        is_secret: c.is_secret === 'Y'
    };
}

/**
 * 라이믹스 첨부파일 → Angple 첨부파일
 */
export function mapRhymixFileToAngple(f: RhymixFile) {
    return {
        file_srl: f.file_srl,
        target_srl: f.upload_target_srl,
        target_type: f.upload_target_type,
        original_name: f.source_filename,
        stored_name: f.uploaded_filename,
        file_size: f.file_size || 0,
        download_count: f.download_count || 0,
        created_at: rhymixDateToISO(f.regdate),
        is_valid: f.isvalid === 'Y'
    };
}
