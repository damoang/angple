/**
 * 그누보드5 → Angple 스키마 매핑
 *
 * 그누보드 테이블 구조:
 * - g5_member → Angple member
 * - g5_board → Angple board
 * - g5_group → Angple board_group
 * - g5_write_{bo_table} → Angple posts (wr_1~wr_10 → extra_1~extra_10)
 * - g5_board_file → Angple attachments
 * - g5_point → Angple point
 */

/** 그누보드 회원 (g5_member) */
export interface GnuMember {
    mb_id: string;
    mb_password: string;
    mb_name: string;
    mb_nick: string;
    mb_nick_date: string;
    mb_email: string;
    mb_homepage: string;
    mb_level: number;
    mb_point: number;
    mb_today_login: string;
    mb_login_ip: string;
    mb_datetime: string;
    mb_ip: string;
    mb_leave_date: string;
    mb_intercept_date: string;
    mb_email_certify: string;
    mb_memo: string;
    mb_lost_certify: string;
    mb_1: string;
    mb_2: string;
    mb_3: string;
    mb_4: string;
    mb_5: string;
    mb_6: string;
    mb_7: string;
    mb_8: string;
    mb_9: string;
    mb_10: string;
    mb_profile_image?: string;
}

/** 그누보드 게시판 (g5_board) */
export interface GnuBoard {
    bo_table: string;
    bo_subject: string;
    bo_skin: string;
    bo_mobile_skin: string;
    bo_category_list: string;
    bo_use_category: number;
    bo_read_point: number;
    bo_write_point: number;
    bo_comment_point: number;
    bo_download_point: number;
    bo_gallery_cols: number;
    bo_gallery_width: number;
    bo_gallery_height: number;
    bo_list_level: number;
    bo_read_level: number;
    bo_write_level: number;
    bo_comment_level: number;
    bo_upload_level: number;
    bo_use_sideview: number;
    bo_use_secret: number;
    bo_page_rows: number;
    bo_mobile_page_rows: number;
    bo_upload_count: number;
    bo_upload_size: number;
    bo_reply_order: number;
    bo_use_search: number;
    bo_order: number;
    gr_id: string;
    bo_count_write: number;
    bo_count_comment: number;
    bo_notice: string;
    bo_1: string;
    bo_2: string;
    bo_3: string;
    bo_4: string;
}

/** 그누보드 게시판 그룹 (g5_group) */
export interface GnuBoardGroup {
    gr_id: string;
    gr_subject: string;
    gr_device: string;
    gr_order: number;
    gr_use_access: number;
}

/** 그누보드 게시글 (g5_write_{bo_table}) */
export interface GnuWriteRow {
    wr_id: number;
    wr_num: number;
    wr_reply: string;
    wr_parent: number;
    wr_is_comment: number;
    wr_comment: number;
    wr_comment_reply: string;
    mb_id: string;
    wr_option: string;
    wr_subject: string;
    wr_content: string;
    wr_seo_title: string;
    wr_link1: string;
    wr_link2: string;
    wr_hit: number;
    wr_good: number;
    wr_nogood: number;
    wr_name: string;
    wr_password: string;
    wr_email: string;
    wr_homepage: string;
    wr_datetime: string;
    wr_last: string;
    wr_ip: string;
    wr_file: number;
    wr_1: string;
    wr_2: string;
    wr_3: string;
    wr_4: string;
    wr_5: string;
    wr_6: string;
    wr_7: string;
    wr_8: string;
    wr_9: string;
    wr_10: string;
    ca_name: string;
}

/** 그누보드 첨부파일 (g5_board_file) */
export interface GnuBoardFile {
    bo_table: string;
    wr_id: number;
    bf_no: number;
    bf_source: string;
    bf_file: string;
    bf_download: number;
    bf_content: string;
    bf_fileurl: string;
    bf_thumburl: string;
    bf_storage: string;
    bf_filesize: number;
    bf_width: number;
    bf_height: number;
    bf_type: number;
    bf_datetime: string;
}

/** 그누보드 포인트 (g5_point) */
export interface GnuPoint {
    po_id: number;
    mb_id: string;
    po_datetime: string;
    po_content: string;
    po_point: number;
    po_use_point: number;
    po_expired: number;
    po_mb_point: number;
    po_rel_table: string;
    po_rel_id: string;
    po_rel_action: string;
}

// ─── 변환 함수 ───

/**
 * 그누보드 회원 → Angple 회원 포맷
 */
export function mapGnuMemberToAngple(m: GnuMember) {
    return {
        mb_id: m.mb_id,
        mb_password: m.mb_password, // PHP password_hash() 결과 그대로 유지
        mb_name: m.mb_name,
        mb_nick: m.mb_nick,
        mb_email: m.mb_email,
        mb_homepage: m.mb_homepage,
        mb_level: m.mb_level,
        mb_point: m.mb_point,
        mb_profile_image: m.mb_profile_image || null,
        mb_ip: m.mb_ip,
        mb_login_ip: m.mb_login_ip,
        mb_today_login: m.mb_today_login || null,
        mb_datetime: m.mb_datetime,
        mb_leave_date: m.mb_leave_date || null,
        mb_intercept_date: m.mb_intercept_date || null,
        mb_email_certify: m.mb_email_certify || null,
        mb_memo: m.mb_memo || null,
        // 확장 필드 보존
        mb_1: m.mb_1 || null,
        mb_2: m.mb_2 || null,
        mb_3: m.mb_3 || null,
        mb_4: m.mb_4 || null,
        mb_5: m.mb_5 || null
    };
}

/**
 * 그누보드 게시판 → Angple 게시판 포맷
 */
export function mapGnuBoardToAngple(b: GnuBoard) {
    return {
        bo_table: b.bo_table,
        bo_subject: b.bo_subject,
        bo_skin: b.bo_skin || 'default',
        bo_mobile_skin: b.bo_mobile_skin || 'default',
        bo_category_list: b.bo_category_list || '',
        bo_use_category: !!b.bo_use_category,
        bo_list_level: b.bo_list_level,
        bo_read_level: b.bo_read_level,
        bo_write_level: b.bo_write_level,
        bo_comment_level: b.bo_comment_level,
        bo_upload_level: b.bo_upload_level,
        bo_page_rows: b.bo_page_rows || 15,
        bo_upload_count: b.bo_upload_count || 0,
        bo_upload_size: b.bo_upload_size || 0,
        bo_use_secret: !!b.bo_use_secret,
        bo_use_search: !!b.bo_use_search,
        bo_order: b.bo_order || 0,
        gr_id: b.gr_id,
        bo_count_write: b.bo_count_write || 0,
        bo_count_comment: b.bo_count_comment || 0,
        // 포인트 설정
        bo_read_point: b.bo_read_point || 0,
        bo_write_point: b.bo_write_point || 0,
        bo_comment_point: b.bo_comment_point || 0,
        bo_download_point: b.bo_download_point || 0
    };
}

/**
 * 그누보드 그룹 → Angple 게시판 그룹
 */
export function mapGnuGroupToAngple(g: GnuBoardGroup) {
    return {
        gr_id: g.gr_id,
        gr_subject: g.gr_subject,
        gr_order: g.gr_order || 0,
        gr_device: g.gr_device || 'both'
    };
}

/**
 * 그누보드 게시글 → Angple 게시글 포맷
 *
 * 핵심: wr_1~wr_10 → extra_1~extra_10 1:1 매핑
 */
export function mapGnuWriteToAngplePost(w: GnuWriteRow, boTable: string) {
    // wr_option 파싱 (secret, html1, html2, mail 등)
    const options = w.wr_option ? w.wr_option.split(',').map((o) => o.trim()) : [];
    const isSecret = options.includes('secret');
    const isNotice = false; // 공지 여부는 bo_notice 필드에서 별도 확인

    return {
        wr_id: w.wr_id,
        bo_table: boTable,
        wr_subject: w.wr_subject,
        wr_content: w.wr_content,
        wr_name: w.wr_name,
        mb_id: w.mb_id,
        wr_datetime: w.wr_datetime,
        wr_last: w.wr_last,
        wr_hit: w.wr_hit || 0,
        wr_good: w.wr_good || 0,
        wr_nogood: w.wr_nogood || 0,
        wr_comment: w.wr_comment || 0,
        wr_link1: w.wr_link1 || null,
        wr_link2: w.wr_link2 || null,
        wr_ip: w.wr_ip,
        wr_file: w.wr_file || 0,
        ca_name: w.ca_name || null,
        is_secret: isSecret,
        is_notice: isNotice,
        // wr_1~wr_10 → extra_1~extra_10 (1:1 매핑)
        extra_1: w.wr_1 || null,
        extra_2: w.wr_2 || null,
        extra_3: w.wr_3 || null,
        extra_4: w.wr_4 || null,
        extra_5: w.wr_5 || null,
        extra_6: w.wr_6 || null,
        extra_7: w.wr_7 || null,
        extra_8: w.wr_8 || null,
        extra_9: w.wr_9 || null,
        extra_10: w.wr_10 || null
    };
}

/**
 * 그누보드 댓글 → Angple 댓글 포맷
 *
 * 그누보드에서 댓글은 같은 g5_write_ 테이블에 wr_is_comment=1로 저장됨
 */
export function mapGnuWriteToAngpleComment(w: GnuWriteRow, boTable: string) {
    return {
        wr_id: w.wr_id,
        bo_table: boTable,
        wr_parent: w.wr_parent,
        wr_content: w.wr_content,
        wr_name: w.wr_name,
        mb_id: w.mb_id,
        wr_datetime: w.wr_datetime,
        wr_ip: w.wr_ip,
        wr_good: w.wr_good || 0,
        wr_nogood: w.wr_nogood || 0,
        wr_comment_reply: w.wr_comment_reply || '',
        is_secret: w.wr_option?.includes('secret') || false
    };
}

/**
 * 그누보드 첨부파일 → Angple 첨부파일 포맷
 */
export function mapGnuFileToAngple(f: GnuBoardFile) {
    return {
        bo_table: f.bo_table,
        wr_id: f.wr_id,
        bf_no: f.bf_no,
        original_name: f.bf_source,
        stored_name: f.bf_file,
        file_size: f.bf_filesize || 0,
        download_count: f.bf_download || 0,
        width: f.bf_width || null,
        height: f.bf_height || null,
        content_type: f.bf_type || null,
        created_at: f.bf_datetime
    };
}

/**
 * 그누보드 포인트 → Angple 포인트 포맷
 */
export function mapGnuPointToAngple(p: GnuPoint) {
    return {
        mb_id: p.mb_id,
        point: p.po_point,
        use_point: p.po_use_point || 0,
        content: p.po_content || '',
        datetime: p.po_datetime,
        rel_table: p.po_rel_table || null,
        rel_id: p.po_rel_id || null,
        rel_action: p.po_rel_action || null,
        expired: !!p.po_expired,
        mb_point: p.po_mb_point || 0
    };
}

/**
 * 공지사항 번호 파싱
 *
 * 그누보드 bo_notice는 "1,5,10" 형식의 콤마 구분 게시글 번호
 */
export function parseNoticeIds(boNotice: string): number[] {
    if (!boNotice || !boNotice.trim()) return [];
    return boNotice
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
}
