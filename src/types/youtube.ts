export interface VideoInfo {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
    channelId: string;
    channelTitle: string;
    publishedAt: string;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
}

export interface ChannelInfo {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
    customUrl: string;
  };
  statistics: {
    viewCount: string;
    subscriberCount: string;
    videoCount: string;
  };
}

export interface SearchResult {
  id: {
    kind: string;
    videoId: string | null;
    channelId: string | null;
    playlistId: string | null;
  };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
    channelTitle: string;
    publishedAt: string;
  };
}

export interface CommentInfo {
  id: string;
  snippet: {
    topLevelComment: {
      snippet: {
        textDisplay: string;
        authorDisplayName: string;
        authorProfileImageUrl: string;
        likeCount: number;
        publishedAt: string;
      };
    };
    totalReplyCount: number;
  };
}

// YouTube Category ID to Name Mapping
export const CATEGORY_NAMES: Record<string, string> = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '18': 'Short Movies',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '21': 'Videoblogging',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
  '30': 'Movies',
  '31': 'Anime/Animation',
  '32': 'Action/Adventure',
  '33': 'Classics',
  '34': 'Comedy',
  '35': 'Documentary',
  '36': 'Drama',
  '37': 'Family',
  '38': 'Foreign',
  '39': 'Horror',
  '40': 'Sci-Fi/Fantasy',
  '41': 'Thriller',
  '42': 'Shorts',
  '43': 'Shows',
  '44': 'Trailers'
};

/**
 * Get category name from category ID
 * @param categoryId - YouTube category ID
 * @returns Category name or 'Unknown' if not found
 */
export function getCategoryName(categoryId?: string): string {
  if (!categoryId) return 'Unknown';
  return CATEGORY_NAMES[categoryId] || `Unknown (ID: ${categoryId})`;
}

// Options for getPlaylistItems
export interface GetPlaylistItemsOptions {
  listItemStart?: number;           // default: 1
  maxResults?: number;              // default: 50 (1-50)
  includeDescriptionTags?: boolean; // default: true
  descriptionLength?: number;       // default: 250
  tagsLength?: number;              // default: 100
}

// Optimized playlist item for reduced token usage
export interface OptimizedPlaylistItem {
  title: string;
  videoId: string;
  duration: string;
  tags?: string[];              // only when includeDescriptionTags=true
  description?: string;         // only when includeDescriptionTags=true
  viewCount: number;
  likeCount: number;
  commentCount: number;
  engagementRatio: string;
  channelName: string;
  channelId: string;
  categoryId: string;           // category name, not ID
  publishedAt: string;
  defaultLanguage?: string;
  thumbnail: string;            // maxres.url or high.url fallback
}

// Response for getPlaylistItems
export interface GetPlaylistItemsResponse {
  totalListVideos: number;
  items: OptimizedPlaylistItem[];
}

// YouTube Topic ID to Name Mapping (simplified - most common topics)
export const TOPIC_NAMES: Record<string, string> = {
  '/m/04rlf': 'Music',
  '/m/02mscn': 'Christian music',
  '/m/0ggq0m': 'Classical music',
  '/m/01lyv': 'Country',
  '/m/02lkt': 'Electronic music',
  '/m/0glt670': 'Hip hop music',
  '/m/05rwpb': 'Independent music',
  '/m/03_d0': 'Jazz',
  '/m/028sqc': 'Music of Asia',
  '/m/0g293': 'Music of Latin America',
  '/m/064t9': 'Pop music',
  '/m/06cqb': 'Reggae',
  '/m/06j6l': 'Rhythm and blues',
  '/m/06by7': 'Rock music',
  '/m/0gywn': 'Soul music',
  '/m/02kjxx': 'Gaming',
  '/m/025zzc': 'Action game',
  '/m/02ntfj': 'Action-adventure game',
  '/m/0b1vjn': 'Casual game',
  '/m/02hygl': 'Music video game',
  '/m/04q1x3q': 'Puzzle video game',
  '/m/01sjng': 'Racing video game',
  '/m/0403l3g': 'Role-playing video game',
  '/m/021bp2': 'Simulation video game',
  '/m/022dc6': 'Sports game',
  '/m/03hf_rm': 'Strategy video game',
  '/m/06ntj': 'Sports',
  '/m/0jm_': 'American football',
  '/m/018jz': 'Baseball',
  '/m/018w8': 'Basketball',
  '/m/01cgz': 'Boxing',
  '/m/09xp_': 'Cricket',
  '/m/02vx4': 'Football',
  '/m/037hz': 'Golf',
  '/m/03tmr': 'Ice hockey',
  '/m/01h7lh': 'Mixed martial arts',
  '/m/0410tth': 'Motorsport',
  '/m/07bs0': 'Tennis',
  '/m/07_53': 'Volleyball',
  '/m/02jjt': 'Entertainment',
  '/m/09kqc': 'Humor',
  '/m/02vxn': 'Movies',
  '/m/05qjc': 'Performing arts',
  '/m/066wd': 'Professional wrestling',
  '/m/0f2f9': 'TV shows',
  '/m/019_rr': 'Lifestyle',
  '/m/032tl': 'Fashion',
  '/m/027x7n': 'Fitness',
  '/m/02wbm': 'Food',
  '/m/03glg': 'Hobby',
  '/m/068hy': 'Pets',
  '/m/041xxh': 'Physical attractiveness',
  '/m/07c1v': 'Technology',
  '/m/0kt51': 'Tourism',
  '/m/07bxq': 'Vehicles',
  '/m/01k8wb': 'Knowledge'
};

/**
 * Get topic name from topic ID
 * @param topicId - YouTube topic ID
 * @returns Topic name or the ID if not found
 */
export function getTopicName(topicId?: string): string {
  if (!topicId) return 'Unknown';
  return TOPIC_NAMES[topicId] || topicId;
}

// NCS Rating categories
export type NCSRating = 'Excellent' | 'Good' | 'Average' | 'Bad';

/**
 * Get NCS rating from score
 * @param score - NCS Total Score (0-100)
 * @returns Rating category
 */
export function getNCSRating(score: number): NCSRating {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Average';
  return 'Bad';
}

// Channel metrics with calculated ratios
export interface ChannelMetrics {
  channelName: string;
  subscriberCount: number;
  channelViewCount: number;
  channelVideoCount: number;
  channelPublished: string;
  avgVideoViews: number;              // channelViewCount / channelVideoCount
  ccVideosPerWeek: number;            // channelVideoCount / ChannelAgeWeeks
  vsrViewsSubsRatio: number;          // (avgVideoViews / Subs) * 100
  ncsTotal: number;                   // Normalized Channel Score (0-100)
  ncsRating: NCSRating;               // Excellent/Good/Average/Bad
  channelDescription?: string;
  keywords?: string[];
  topicIds?: string[];                // Topic names, not IDs
  channelLanguage?: string;
}

// Options for getVideoDetails
export interface GetVideoDetailsOptions {
  includeChannelInfo?: boolean;       // default: true
  includeTagDescTrans?: boolean;      // default: true
  transcriptOnly?: boolean;           // default: false (only include transcript, no tags/desc)
  transcriptChunk?: number;           // default: 1000 words
  chunkStart?: number;                // default: 1 (start at word 1, then 1001...)
  descriptionLength?: number;         // default: 250
  tagsLength?: number;                // default: 100
  channelDescLength?: number;         // default: 150
  lang?: string;                      // transcript language
}

// Optimized video details with channel metrics
export interface OptimizedVideoDetails {
  // Video Information
  videoTitle: string;
  videoId: string;
  duration: string;
  tags?: string[];
  videoDescription?: string;
  transcription?: {
    text: string;
    wordCount: number;
    segments?: Array<{
      timestamp: string;      // formatted "MM:SS"
      text: string;
      start: number;          // seconds
    }>;
    chunkInfo?: {
      chunkStart: number;
      chunkEnd: number;
      totalWords: number;
      hasMore: boolean;
    };
  };
  videoPublished: string;
  categoryId: string;                 // category name, not ID
  videoViewCount: number;
  likeCount: number;
  commentCount: number;
  engagementRatio: string;
  thumbnail: string;
  videoLanguage?: string;

  // Channel Information (optional)
  channelMetrics?: ChannelMetrics;
} 