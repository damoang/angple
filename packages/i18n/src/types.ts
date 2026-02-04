/**
 * Angple i18n Types
 * 국제화 시스템 타입 정의
 */

/** 지원 언어 코드 */
export type SupportedLocale = 'en' | 'ko' | 'ja' | 'zh' | 'es' | 'ar' | 'vi';

/** RTL(Right-to-Left) 언어 코드 */
export type RTLLocale = 'ar' | 'he' | 'fa';

/** 언어 메타데이터 */
export interface LocaleMetadata {
    /** 언어 코드 (ISO 639-1) */
    code: SupportedLocale;
    /** 네이티브 언어명 */
    name: string;
    /** 영어 언어명 */
    englishName: string;
    /** 국기 이모지 */
    flag: string;
    /** RTL 여부 */
    isRTL: boolean;
    /** 지역 코드 (ISO 3166-1) */
    region?: string;
}

/** 번역 키 네임스페이스 */
export interface TranslationNamespaces {
    common: CommonTranslations;
    admin: AdminTranslations;
    install: InstallTranslations;
    auth: AuthTranslations;
    board: BoardTranslations;
    theme: ThemeTranslations;
    plugin: PluginTranslations;
    error: ErrorTranslations;
}

/** 공통 번역 */
export interface CommonTranslations {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    update: string;
    confirm: string;
    close: string;
    loading: string;
    search: string;
    filter: string;
    sort: string;
    activate: string;
    deactivate: string;
    enable: string;
    disable: string;
    yes: string;
    no: string;
    ok: string;
    back: string;
    next: string;
    previous: string;
    submit: string;
    reset: string;
    refresh: string;
    download: string;
    upload: string;
    copy: string;
    paste: string;
    select: string;
    selectAll: string;
    deselectAll: string;
    preview: string;
    settings: string;
    options: string;
    actions: string;
    more: string;
    less: string;
    showMore: string;
    showLess: string;
    expand: string;
    collapse: string;
}

/** 관리자 번역 */
export interface AdminTranslations {
    dashboard: {
        title: string;
        overview: string;
        statistics: string;
        recentActivity: string;
    };
    themes: {
        title: string;
        upload: string;
        marketplace: string;
        active: string;
        installed: string;
        official: string;
        custom: string;
        activate: string;
        deactivate: string;
        delete: string;
        deleteConfirm: string;
        uploadSuccess: string;
        uploadError: string;
        noThemes: string;
    };
    plugins: {
        title: string;
        upload: string;
        marketplace: string;
        active: string;
        installed: string;
        activate: string;
        deactivate: string;
        delete: string;
        deleteConfirm: string;
        uploadSuccess: string;
        uploadError: string;
        noPlugins: string;
        settings: string;
    };
    menus: {
        title: string;
        create: string;
        edit: string;
        delete: string;
        order: string;
    };
    users: {
        title: string;
        list: string;
        create: string;
        edit: string;
        delete: string;
        roles: string;
        permissions: string;
    };
    settings: {
        title: string;
        general: string;
        appearance: string;
        security: string;
        email: string;
        advanced: string;
    };
}

/** 설치 마법사 번역 */
export interface InstallTranslations {
    welcome: string;
    selectLanguage: string;
    languageSelected: string;
    database: {
        title: string;
        description: string;
        host: string;
        port: string;
        name: string;
        username: string;
        password: string;
        testConnection: string;
        connectionSuccess: string;
        connectionFailed: string;
    };
    admin: {
        title: string;
        description: string;
        username: string;
        email: string;
        password: string;
        confirmPassword: string;
    };
    site: {
        title: string;
        description: string;
        siteName: string;
        siteDescription: string;
        siteUrl: string;
    };
    theme: {
        title: string;
        description: string;
        selectTheme: string;
    };
    complete: {
        title: string;
        description: string;
        goToDashboard: string;
        goToSite: string;
    };
    steps: {
        language: string;
        database: string;
        admin: string;
        site: string;
        theme: string;
        complete: string;
    };
}

/** 인증 번역 */
export interface AuthTranslations {
    login: {
        title: string;
        email: string;
        password: string;
        rememberMe: string;
        forgotPassword: string;
        submit: string;
        noAccount: string;
        signUp: string;
    };
    register: {
        title: string;
        email: string;
        username: string;
        password: string;
        confirmPassword: string;
        agreeTerms: string;
        submit: string;
        hasAccount: string;
        signIn: string;
    };
    forgotPassword: {
        title: string;
        description: string;
        email: string;
        submit: string;
        backToLogin: string;
        emailSent: string;
    };
    resetPassword: {
        title: string;
        newPassword: string;
        confirmPassword: string;
        submit: string;
        success: string;
    };
    logout: string;
    errors: {
        invalidCredentials: string;
        emailRequired: string;
        passwordRequired: string;
        passwordMismatch: string;
        emailExists: string;
        usernameExists: string;
        weakPassword: string;
        invalidToken: string;
        sessionExpired: string;
    };
}

/** 게시판 번역 */
export interface BoardTranslations {
    post: {
        title: string;
        content: string;
        author: string;
        date: string;
        views: string;
        likes: string;
        comments: string;
        write: string;
        edit: string;
        delete: string;
        deleteConfirm: string;
        reply: string;
        share: string;
        report: string;
    };
    comment: {
        write: string;
        edit: string;
        delete: string;
        deleteConfirm: string;
        reply: string;
        report: string;
        noComments: string;
    };
    list: {
        title: string;
        empty: string;
        loadMore: string;
        sortByDate: string;
        sortByViews: string;
        sortByLikes: string;
    };
}

/** 테마 번역 */
export interface ThemeTranslations {
    name: string;
    description: string;
    version: string;
    author: string;
    license: string;
    homepage: string;
    settings: string;
    colors: string;
    fonts: string;
    layout: string;
}

/** 플러그인 번역 */
export interface PluginTranslations {
    name: string;
    description: string;
    version: string;
    author: string;
    license: string;
    homepage: string;
    settings: string;
    dependencies: string;
    requiredVersion: string;
}

/** 에러 번역 */
export interface ErrorTranslations {
    general: string;
    notFound: string;
    unauthorized: string;
    forbidden: string;
    serverError: string;
    networkError: string;
    validationError: string;
    timeout: string;
    maintenance: string;
    rateLimited: string;
    fileTooBig: string;
    invalidFileType: string;
    uploadFailed: string;
}

/** i18n 설정 */
export interface I18nConfig {
    /** 기본 언어 */
    defaultLocale: SupportedLocale;
    /** 지원 언어 목록 */
    supportedLocales: SupportedLocale[];
    /** 언어 감지 방식 */
    detection: {
        /** URL 경로에서 감지 */
        fromPath: boolean;
        /** 쿠키에서 감지 */
        fromCookie: boolean;
        /** Accept-Language 헤더에서 감지 */
        fromHeader: boolean;
        /** 브라우저 설정에서 감지 */
        fromNavigator: boolean;
    };
    /** 쿠키 설정 */
    cookie: {
        name: string;
        maxAge: number;
        path: string;
        secure: boolean;
        sameSite: 'strict' | 'lax' | 'none';
    };
    /** 폴백 설정 */
    fallback: {
        /** 번역 키가 없을 때 폴백 언어 */
        locale: SupportedLocale;
        /** 번역 키가 없을 때 키 자체를 표시할지 */
        showKey: boolean;
    };
}
