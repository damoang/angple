/**
 * 팟캐스트 플레이어 상태 관리 Store
 * - 페이지 전환 시에도 재생 상태 유지
 * - 미니 플레이어 / 확장 모드 전환
 */

interface PodcastState {
    isPlaying: boolean;
    isMiniMode: boolean;
    isVisible: boolean;
    currentVideoId: string;
    currentVideoTitle: string;
    channelUrl: string;
}

// 기본 팟캐스트 설정
const DEFAULT_VIDEO_ID = 'n4e7KiiLsog';
const DEFAULT_CHANNEL_URL = 'https://www.youtube.com/@DAMOANG_%EB%8B%A4%EB%AA%A8%EC%95%99';

// 상태 초기화
let state = $state<PodcastState>({
    isPlaying: false,
    isMiniMode: false,
    isVisible: true,
    currentVideoId: DEFAULT_VIDEO_ID,
    currentVideoTitle: '다모앙 팟캐스트',
    channelUrl: DEFAULT_CHANNEL_URL
});

// Getter 함수들
export function getPodcastState() {
    return state;
}

export function getIsPlaying() {
    return state.isPlaying;
}

export function getIsMiniMode() {
    return state.isMiniMode;
}

export function getIsVisible() {
    return state.isVisible;
}

export function getCurrentVideoId() {
    return state.currentVideoId;
}

// Setter 함수들
export function setIsPlaying(playing: boolean) {
    state.isPlaying = playing;
}

export function setMiniMode(mini: boolean) {
    state.isMiniMode = mini;
}

export function setVisible(visible: boolean) {
    state.isVisible = visible;
}

export function setCurrentVideo(videoId: string, title?: string) {
    state.currentVideoId = videoId;
    if (title) {
        state.currentVideoTitle = title;
    }
}

// 미니 플레이어 토글
export function toggleMiniMode() {
    state.isMiniMode = !state.isMiniMode;
}

// 플레이어 닫기
export function closePodcast() {
    state.isVisible = false;
    state.isPlaying = false;
}

// 플레이어 열기
export function openPodcast() {
    state.isVisible = true;
}

// 상태 리셋
export function resetPodcast() {
    state = {
        isPlaying: false,
        isMiniMode: false,
        isVisible: true,
        currentVideoId: DEFAULT_VIDEO_ID,
        currentVideoTitle: '다모앙 팟캐스트',
        channelUrl: DEFAULT_CHANNEL_URL
    };
}
