export type ContentType = 'image' | 'video' | 'audio' | 'url' | 'webpage' | 'powerbi' | 'powerbi_frame' | 'dashboard' | 'html_snippet' | 'weather' | 'rss' | 'qr'

export interface ContentItem {
    id: string
    name: string
    type: ContentType
    source_url: string | null
    file_path: string | null
    thumbnail_url: string | null
    duration_seconds: number
    metadata: Record<string, unknown>
}

export interface PlaylistItem {
    id: string
    order_index: number
    duration_override: number | null
    transition_type: string | null
    content_item: ContentItem
    zone_index: number
    
    // Advanced Scheduling
    valid_from?: string | null
    valid_until?: string | null
    day_part_start?: string | null
    day_part_end?: string | null
    days_of_week?: number[] | null
    
    // Interactivity
    show_qr_code?: boolean
    qr_code_url?: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interactive_action?: Record<string, any> | null
}

export interface Project {
    id: string
    name: string
    settings: {
        loop?: boolean
        transition_type?: string
        default_duration?: number
    }
    layout_type: 'fullscreen' | 'split_horizontal' | 'split_vertical' | 'l_shape' | 'grid_2x2' | 'main_ticker'
    layout_settings: Record<string, any>
}

export interface Screen {
    id: string
    display_key: string
    name: string
    status: string
    active_project_id: string | null
    location_id: string | null
    current_state?: Record<string, unknown>
}

export interface PushOverlay {
    type: 'alert' | 'override' | 'sound'
    message?: string
    duration?: number
    content_item?: ContentItem
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
