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