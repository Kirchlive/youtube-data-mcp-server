import { google, youtube_v3 } from 'googleapis';
import { getSubtitles } from 'youtube-caption-extractor';
import {
  getCategoryName,
  GetPlaylistItemsOptions,
  GetPlaylistItemsResponse,
  OptimizedPlaylistItem
} from '../types/youtube.js';

export interface PlaylistOptions {
  playlistId: string;
  parts?: string[];
}

export interface SearchPlaylistsOptions {
  query: string;
  maxResults?: number;
}

export interface PlaylistTranscriptsOptions {
  playlistId: string;
  lang?: string;
  maxVideos?: number;
  chunk?: number;
}

export class PlaylistManagement {
  private youtube: youtube_v3.Youtube | null = null;
  private initialized = false;
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly ABSOLUTE_MAX_RESULTS = 500;

  constructor() {
    // Lazy initialization
  }

  /**
   * Apply chunking to transcript array
   * @param items - Array to chunk
   * @param chunk - Chunk number (0 or undefined = full, 1 = first 1000, 2 = next 1000, etc.)
   * @returns Chunked array with metadata
   */
  private chunkArray<T>(items: T[], chunk?: number): { items: T[], chunkInfo: { chunk: number, start: number, end: number, total: number, hasMore: boolean } } {
    const CHUNK_SIZE = 1000;

    // chunk 0 or undefined means return full array
    if (!chunk || chunk === 0) {
      return {
        items,
        chunkInfo: {
          chunk: 0,
          start: 0,
          end: items.length,
          total: items.length,
          hasMore: false
        }
      };
    }

    // Calculate chunk boundaries
    const startIndex = (chunk - 1) * CHUNK_SIZE;
    const endIndex = Math.min(startIndex + CHUNK_SIZE, items.length);

    // Validate chunk number
    if (startIndex >= items.length) {
      throw new Error(
        `Invalid chunk ${chunk}: only ${items.length} items available (${Math.ceil(items.length / CHUNK_SIZE)} chunks available)`
      );
    }

    return {
      items: items.slice(startIndex, endIndex),
      chunkInfo: {
        chunk,
        start: startIndex,
        end: endIndex,
        total: items.length,
        hasMore: endIndex < items.length
      }
    };
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'YOUTUBE_API_KEY environment variable is required but not set'
      );
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey
    });

    this.initialized = true;
  }

  private ensureInitialized(): youtube_v3.Youtube {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized');
    }
    return this.youtube;
  }

  /**
   * Get playlist metadata and details
   */
  async getPlaylist({ playlistId, parts = ['snippet', 'contentDetails'] }: PlaylistOptions) {
    await this.initialize();

    try {
      const response = await this.ensureInitialized().playlists.list({
        part: parts,
        id: [playlistId]
      });

      if (!response.data.items?.length) {
        throw new Error(`Playlist not found: ${playlistId}`);
      }

      return response.data.items[0];
    } catch (error) {
      throw new Error(
        `Failed to retrieve playlist ${playlistId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get optimized playlist items with detailed video information
   * @param playlistId - YouTube playlist ID
   * @param options - Configuration options for filtering and formatting
   * @returns Optimized playlist items with reduced token usage (~400 tokens per video)
   */
  async getPlaylistItems(
    playlistId: string,
    options?: GetPlaylistItemsOptions
  ): Promise<GetPlaylistItemsResponse> {
    await this.initialize();

    // Step 1: Process options with defaults
    const {
      listItemStart = 1,
      maxResults = 50,
      includeDescriptionTags = true,
      descriptionLength = 250,
      tagsLength = 100
    } = options || {};

    // Validate parameters
    if (listItemStart < 1) {
      throw new Error('listItemStart must be at least 1');
    }
    if (maxResults < 1 || maxResults > 50) {
      throw new Error('maxResults must be between 1 and 50');
    }

    try {
      // Step 2: Get playlist metadata for totalListVideos
      const playlistResponse = await this.ensureInitialized().playlists.list({
        part: ['contentDetails'],
        id: [playlistId]
      });

      if (!playlistResponse.data.items?.length) {
        throw new Error(`Playlist not found: ${playlistId}`);
      }

      const totalListVideos = playlistResponse.data.items[0].contentDetails?.itemCount || 0;

      // Validate listItemStart against total videos
      if (listItemStart > totalListVideos) {
        throw new Error(
          `listItemStart (${listItemStart}) exceeds total videos in playlist (${totalListVideos})`
        );
      }

      // Step 3: Get playlist items with pagination support
      const playlistItems: youtube_v3.Schema$PlaylistItem[] = [];
      let nextPageToken: string | undefined = undefined;
      let currentPosition = 0;

      // If listItemStart > 1, we need to skip items
      const itemsToSkip = listItemStart - 1;
      let itemsSkipped = 0;

      while (playlistItems.length < maxResults) {
        const response: youtube_v3.Schema$PlaylistItemListResponse = (
          await this.ensureInitialized().playlistItems.list({
            part: ['snippet', 'contentDetails'],
            playlistId: playlistId,
            maxResults: this.MAX_RESULTS_PER_PAGE,
            pageToken: nextPageToken
          })
        ).data;

        if (!response.items?.length) {
          break;
        }

        // Handle skipping for listItemStart
        for (const item of response.items) {
          if (itemsSkipped < itemsToSkip) {
            itemsSkipped++;
            continue;
          }

          playlistItems.push(item);

          if (playlistItems.length >= maxResults) {
            break;
          }
        }

        nextPageToken = response.nextPageToken || undefined;

        if (!nextPageToken || playlistItems.length >= maxResults) {
          break;
        }
      }

      if (playlistItems.length === 0) {
        return {
          totalListVideos,
          items: []
        };
      }

      // Step 4: Extract video IDs and fetch detailed video information
      const videoIds = playlistItems
        .map(item => item.snippet?.resourceId?.videoId)
        .filter((id): id is string => id !== undefined);

      if (videoIds.length === 0) {
        return {
          totalListVideos,
          items: []
        };
      }

      // Fetch video details in batch (max 50 IDs per request)
      const videoDetailsResponse = await this.ensureInitialized().videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: videoIds
      });

      if (!videoDetailsResponse.data.items?.length) {
        throw new Error('Failed to retrieve video details');
      }

      // Create a map for quick video lookup
      const videoDetailsMap = new Map(
        videoDetailsResponse.data.items.map(video => [video.id!, video])
      );

      // Step 5: Transform and merge data
      const optimizedItems: OptimizedPlaylistItem[] = playlistItems
        .map(playlistItem => {
          const videoId = playlistItem.snippet?.resourceId?.videoId;
          if (!videoId) return null;

          const videoDetails = videoDetailsMap.get(videoId);
          if (!videoDetails) return null;

          const snippet = videoDetails.snippet;
          const statistics = videoDetails.statistics;
          const contentDetails = videoDetails.contentDetails;

          // Parse statistics
          const viewCount = parseInt(statistics?.viewCount || '0', 10);
          const likeCount = parseInt(statistics?.likeCount || '0', 10);
          const commentCount = parseInt(statistics?.commentCount || '0', 10);

          // Calculate engagement ratio: (likes + comments) / (views / 100)
          const engagementRatio = viewCount > 0
            ? (((likeCount + commentCount) / (viewCount / 100))).toFixed(2)
            : '0.00';

          // Format duration (ISO 8601 to readable format)
          const duration = this.formatDuration(contentDetails?.duration || 'PT0S');

          // Get best quality thumbnail
          const thumbnail = snippet?.thumbnails?.maxres?.url ||
                           snippet?.thumbnails?.high?.url ||
                           snippet?.thumbnails?.default?.url ||
                           '';

          // Truncate description if needed
          let description: string | undefined = undefined;
          if (includeDescriptionTags && snippet?.description) {
            description = snippet.description.length > descriptionLength
              ? snippet.description.substring(0, descriptionLength) + '...'
              : snippet.description;
          }

          // Truncate tags if needed
          let tags: string[] | undefined = undefined;
          if (includeDescriptionTags && snippet?.tags && snippet.tags.length > 0) {
            tags = [];
            let totalLength = 0;

            for (const tag of snippet.tags) {
              if (totalLength + tag.length > tagsLength) {
                break;
              }
              tags.push(tag);
              totalLength += tag.length;
            }
          }

          const optimizedItem: OptimizedPlaylistItem = {
            title: snippet?.title || 'Unknown Title',
            videoId,
            duration,
            viewCount,
            likeCount,
            commentCount,
            engagementRatio,
            channelName: snippet?.channelTitle || 'Unknown Channel',
            channelId: snippet?.channelId || '',
            categoryId: getCategoryName(snippet?.categoryId || undefined),
            publishedAt: snippet?.publishedAt || '',
            thumbnail
          };

          // Add optional fields
          if (includeDescriptionTags) {
            if (description) optimizedItem.description = description;
            if (tags && tags.length > 0) optimizedItem.tags = tags;
          }

          if (snippet?.defaultLanguage) {
            optimizedItem.defaultLanguage = snippet.defaultLanguage;
          }

          return optimizedItem;
        })
        .filter((item): item is OptimizedPlaylistItem => item !== null);

      return {
        totalListVideos,
        items: optimizedItems
      };
    } catch (error) {
      throw new Error(
        `Failed to retrieve optimized playlist items for ${playlistId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Format ISO 8601 duration to human-readable format
   * @param isoDuration - ISO 8601 duration string (e.g., "PT1H23M45S")
   * @returns Formatted duration (e.g., "1:23:45" or "23:45")
   */
  private formatDuration(isoDuration: string): string {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:00';

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Search for playlists on YouTube
   */
  async searchPlaylists({ query, maxResults = 10 }: SearchPlaylistsOptions) {
    await this.initialize();

    try {
      const results: youtube_v3.Schema$SearchResult[] = [];
      let nextPageToken: string | undefined = undefined;
      const targetResults = Math.min(maxResults, this.ABSOLUTE_MAX_RESULTS);

      while (results.length < targetResults) {
        const response: youtube_v3.Schema$SearchListResponse = (await this.ensureInitialized().search.list({
          part: ['snippet'],
          q: query,
          type: ['playlist'],
          maxResults: Math.min(this.MAX_RESULTS_PER_PAGE, targetResults - results.length),
          pageToken: nextPageToken
        })).data;

        if (!response.items?.length) {
          break;
        }

        results.push(...response.items);
        nextPageToken = response.nextPageToken || undefined;

        if (!nextPageToken) {
          break;
        }
      }

      return results.slice(0, targetResults);
    } catch (error) {
      throw new Error(
        `Failed to search playlists for query "${query}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get transcripts for all videos in a playlist
   * Note: chunk parameter applies to each individual video's transcript to avoid token limits
   */
  async getPlaylistVideoTranscripts({
    playlistId,
    lang,
    maxVideos = 50,
    chunk
  }: PlaylistTranscriptsOptions) {
    await this.initialize();

    try {
      // Get playlist videos
      const playlistData = await this.getPlaylistItems(playlistId, {
        maxResults: maxVideos,
        includeDescriptionTags: false // We only need video IDs for transcripts
      });

      // Extract video IDs from optimized items
      const videoIds = playlistData.items.map(item => item.videoId);

      // Get transcripts in parallel (with rate limiting)
      const targetLang = lang || process.env.YOUTUBE_TRANSCRIPT_LANG || 'en';
      const transcripts = await Promise.all(
        videoIds.map(async (videoId) => {
          try {
            const fullTranscript = await getSubtitles({
              videoID: videoId,
              lang: targetLang
            });

            // Apply chunking if requested
            let transcript = fullTranscript;
            let chunkInfo = undefined;

            if (chunk !== undefined) {
              const chunked = this.chunkArray(fullTranscript, chunk);
              transcript = chunked.items;
              chunkInfo = chunked.chunkInfo;
            }

            return {
              videoId,
              success: true,
              transcript,
              ...(chunkInfo && { chunkInfo })
            };
          } catch (error) {
            return {
              videoId,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })
      );

      return {
        playlistId,
        language: targetLang,
        totalVideos: videoIds.length,
        successfulTranscripts: transcripts.filter(t => t.success).length,
        transcripts,
        ...(chunk !== undefined && { note: `Each transcript is chunked (chunk ${chunk})` })
      };
    } catch (error) {
      throw new Error(
        `Failed to get transcripts for playlist ${playlistId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * List all playlists from a channel
   */
  async listChannelPlaylists(channelId: string, maxResults: number = 50) {
    await this.initialize();

    try {
      const results: youtube_v3.Schema$Playlist[] = [];
      let nextPageToken: string | undefined = undefined;
      const targetResults = Math.min(maxResults, this.ABSOLUTE_MAX_RESULTS);

      while (results.length < targetResults) {
        const response: youtube_v3.Schema$PlaylistListResponse = (await this.ensureInitialized().playlists.list({
          part: ['snippet', 'contentDetails'],
          channelId: channelId,
          maxResults: Math.min(this.MAX_RESULTS_PER_PAGE, targetResults - results.length),
          pageToken: nextPageToken
        })).data;

        if (!response.items?.length) {
          break;
        }

        results.push(...response.items);
        nextPageToken = response.nextPageToken || undefined;

        if (!nextPageToken) {
          break;
        }
      }

      return results.slice(0, targetResults);
    } catch (error) {
      throw new Error(
        `Failed to list playlists for channel ${channelId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
