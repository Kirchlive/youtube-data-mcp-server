import { google, youtube_v3 } from 'googleapis';
import { getSubtitles } from 'youtube-caption-extractor';

export interface PlaylistOptions {
  playlistId: string;
  parts?: string[];
}

export interface PlaylistItemsOptions {
  playlistId: string;
  maxResults?: number;
}

export interface SearchPlaylistsOptions {
  query: string;
  maxResults?: number;
}

export interface PlaylistTranscriptsOptions {
  playlistId: string;
  lang?: string;
  maxVideos?: number;
}

export class PlaylistManagement {
  private youtube: youtube_v3.Youtube | null = null;
  private initialized = false;
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly ABSOLUTE_MAX_RESULTS = 500;

  constructor() {
    // Lazy initialization
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
   * Get all videos in a playlist with pagination
   */
  async getPlaylistItems({ playlistId, maxResults = 50 }: PlaylistItemsOptions) {
    await this.initialize();

    try {
      const results: youtube_v3.Schema$PlaylistItem[] = [];
      let nextPageToken: string | undefined = undefined;
      const targetResults = Math.min(maxResults, this.ABSOLUTE_MAX_RESULTS);

      while (results.length < targetResults) {
        const response: youtube_v3.Schema$PlaylistItemListResponse = (await this.ensureInitialized().playlistItems.list({
          part: ['snippet', 'contentDetails'],
          playlistId: playlistId,
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
        `Failed to retrieve playlist items for ${playlistId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
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
   */
  async getPlaylistVideoTranscripts({
    playlistId,
    lang,
    maxVideos = 50
  }: PlaylistTranscriptsOptions) {
    await this.initialize();

    try {
      // Get playlist videos
      const playlistItems = await this.getPlaylistItems({
        playlistId,
        maxResults: maxVideos
      });

      // Extract video IDs
      const videoIds = playlistItems
        .map(item => item.snippet?.resourceId?.videoId)
        .filter((id): id is string => id !== undefined);

      // Get transcripts in parallel (with rate limiting)
      const targetLang = lang || process.env.YOUTUBE_TRANSCRIPT_LANG || 'en';
      const transcripts = await Promise.all(
        videoIds.map(async (videoId) => {
          try {
            const transcript = await getSubtitles({
              videoID: videoId,
              lang: targetLang
            });
            return {
              videoId,
              success: true,
              transcript
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
        transcripts
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
