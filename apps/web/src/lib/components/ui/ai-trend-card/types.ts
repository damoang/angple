/**
 * AI 트렌드 카드 타입 정의
 */

export interface TrendStats {
    total_recommends: number;
    total_comments: number;
    total_views?: number;
    trend_score?: number;
}

export interface TrendData {
    title?: string;
    sections_text?: string;
    keywords: string[];
    summary: string;
    headline_array?: string[];
    stats: TrendStats;
    score: number;
    period: string;
    period_text?: string;
    period_hours?: string;
    trend_direction?: 'up' | 'stable' | 'down';
    confidence?: number;
    sentiment?: 'positive' | 'neutral' | 'negative' | 'tech' | 'politics';
    predicted_growth?: number;
    timestamp_relative?: string;
    top_section?: string;
    ambient_whisper?: string;
    analysis_commentary?: string;
}

export type Period = '1hour' | '3hours' | '6hours' | '12hours' | '24hours' | '48hours';

export interface AiTrendCardProps {
    data?: TrendData | null;
    period?: Period;
    loading?: boolean;
    error?: string | null;
    class?: string;
}
