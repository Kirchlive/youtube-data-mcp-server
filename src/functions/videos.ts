import { google, youtube_v3 } from 'googleapis';
import { getSubtitles } from 'youtube-caption-extractor';

export interface VideoOptions {
  videoId: string;
  parts?: string[];
}

export interface SearchOptions {
  query: string;
  maxResults?: number;
}

export interface ChannelOptions {
  channelId: string;
  maxResults?: number;
}

export interface TrendingOptions {
  regionCode?: string;
  categoryId?: string;
  maxResults?: number;
}

export interface CompareVideosOptions {
  videoIds: string[];
}

export interface SearchTranscriptOptions {
  videoId: string;
  query: string;
  lang?: string;
}

export interface ChannelDetailsOptions {
  channelId: string;
  parts?: string[];
}

export interface SearchChannelContentOptions {
  channelId: string;
  query: string;
  maxResults?: number;
}

export class VideoManagement {
  private youtube: youtube_v3.Youtube | null = null;
  private initialized = false;
  private readonly MAX_RESULTS_PER_PAGE = 50;
  private readonly ABSOLUTE_MAX_RESULTS = 500;

  constructor() {
    // Lazy initialization - no immediate setup
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
      throw new Error('YouTube client not initialized. Call initialize() first.');
    }
    return this.youtube;
  }

  async getVideo({ videoId, parts = ['snippet'] }: VideoOptions) {
    await this.initialize();

    try {
      const response = await this.ensureInitialized().videos.list({
        part: parts,
        id: [videoId]
      });

      if (!response.data.items?.length) {
        throw new Error('Video not found.');
      }

      return response.data.items[0];
    } catch (error) {
      throw new Error(
        `Failed to retrieve video information: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async searchVideos({ query, maxResults = 10 }: SearchOptions) {
    await this.initialize();

    try {
      const results: youtube_v3.Schema$SearchResult[] = [];
      let nextPageToken: string | undefined = undefined;
      const targetResults = Math.min(maxResults, this.ABSOLUTE_MAX_RESULTS);

      while (results.length < targetResults) {
        const response: youtube_v3.Schema$SearchListResponse = (await this.ensureInitialized().search.list({
          part: ['snippet'],
          q: query,
          maxResults: Math.min(this.MAX_RESULTS_PER_PAGE, targetResults - results.length),
          type: ['video'],
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
        `Failed to search videos: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getTranscript(videoId: string, lang?: string) {
    try {
      // Use provided language, environment variable, or default to 'en'
      const targetLang = lang || process.env.YOUTUBE_TRANSCRIPT_LANG || 'en';

      const transcript = await getSubtitles({
        videoID: videoId,
        lang: targetLang
      });

      return transcript;
    } catch (error) {
      // Provide more detailed error message
      const targetLang = lang || process.env.YOUTUBE_TRANSCRIPT_LANG || 'en';
      throw new Error(
        `Failed to retrieve transcript for video ${videoId} (language: ${targetLang}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getRelatedVideos(videoId: string, maxResults: number = 10) {
    await this.initialize();

    try {
      const response = await this.ensureInitialized().search.list({
        part: ['snippet'],
        type: ['video'],
        maxResults,
        relatedToVideoId: videoId
      } as youtube_v3.Params$Resource$Search$List);

      return response.data.items || [];
    } catch (error) {
      throw new Error(
        `Failed to retrieve related videos: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get comprehensive channel information
   * @param channelId - YouTube channel ID
   * @param parts - API parts to retrieve (default: snippet, statistics, contentDetails)
   * @returns Complete channel data
   */
  async getChannel({ channelId, parts = ['snippet', 'statistics', 'contentDetails'] }: ChannelDetailsOptions) {
    await this.initialize();

    try {
      const response = await this.ensureInitialized().channels.list({
        part: parts,
        id: [channelId]
      });

      if (!response.data.items?.length) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      return response.data.items[0];
    } catch (error) {
      throw new Error(
        `Failed to retrieve channel information for ${channelId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async getChannelStatistics(channelId: string) {
    await this.initialize();

    try {
      const response = await this.ensureInitialized().channels.list({
        part: ['snippet', 'statistics'],
        id: [channelId]
      });

      if (!response.data.items?.length) {
        throw new Error('Channel not found.');
      }

      const channel = response.data.items[0];
      return {
        title: channel.snippet?.title,
        subscriberCount: channel.statistics?.subscriberCount,
        viewCount: channel.statistics?.viewCount,
        videoCount: channel.statistics?.videoCount
      };
    } catch (error) {
      throw new Error(
        `Failed to retrieve channel statistics: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getChannelTopVideos({ channelId, maxResults = 10 }: ChannelOptions) {
    await this.initialize();

    try {
      const searchResults: youtube_v3.Schema$SearchResult[] = [];
      let nextPageToken: string | undefined = undefined;
      const targetResults = Math.min(maxResults, this.ABSOLUTE_MAX_RESULTS);

      while (searchResults.length < targetResults) {
        const searchResponse: youtube_v3.Schema$SearchListResponse = (await this.ensureInitialized().search.list({
          part: ['id'],
          channelId: channelId,
          maxResults: Math.min(this.MAX_RESULTS_PER_PAGE, targetResults - searchResults.length),
          order: 'viewCount',
          type: ['video'],
          pageToken: nextPageToken
        })).data;

        if (!searchResponse.items?.length) {
          break;
        }

        searchResults.push(...searchResponse.items);
        nextPageToken = searchResponse.nextPageToken || undefined;

        if (!nextPageToken) {
          break;
        }
      }

      if (!searchResults.length) {
        throw new Error('No videos found.');
      }

      const videoIds = searchResults
        .map(item => item.id?.videoId)
        .filter((id): id is string => id !== undefined);

      // Retrieve video details in batches of 50
      const videoDetails: youtube_v3.Schema$Video[] = [];
      for (let i = 0; i < videoIds.length; i += this.MAX_RESULTS_PER_PAGE) {
        const batch = videoIds.slice(i, i + this.MAX_RESULTS_PER_PAGE);
        const videosResponse = await this.ensureInitialized().videos.list({
          part: ['snippet', 'statistics'],
          id: batch
        });

        if (videosResponse.data.items) {
          videoDetails.push(...videosResponse.data.items);
        }
      }

      return videoDetails.slice(0, targetResults).map(video => ({
        id: video.id,
        title: video.snippet?.title,
        publishedAt: video.snippet?.publishedAt,
        viewCount: video.statistics?.viewCount,
        likeCount: video.statistics?.likeCount,
        commentCount: video.statistics?.commentCount
      }));
    } catch (error) {
      throw new Error(
        `Failed to retrieve channel's top videos: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getVideoEngagementRatio(videoId: string) {
    await this.initialize();

    try {
      const response = await this.ensureInitialized().videos.list({
        part: ['statistics'],
        id: [videoId]
      });

      if (!response.data.items?.length) {
        throw new Error('Video not found.');
      }

      const stats = response.data.items[0].statistics;
      const viewCount = parseInt(stats?.viewCount || '0');
      const likeCount = parseInt(stats?.likeCount || '0');
      const commentCount = parseInt(stats?.commentCount || '0');

      const engagementRatio = viewCount > 0
        ? ((likeCount + commentCount) / viewCount * 100).toFixed(2)
        : '0';

      return {
        viewCount,
        likeCount,
        commentCount,
        engagementRatio: `${engagementRatio}%`
      };
    } catch (error) {
      throw new Error(
        `Failed to calculate video engagement ratio: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getTrendingVideos({ regionCode = 'US', categoryId, maxResults = 10 }: TrendingOptions) {
    await this.initialize();

    try {
      const params: youtube_v3.Params$Resource$Videos$List = {
        part: ['snippet', 'statistics'],
        chart: 'mostPopular',
        regionCode: regionCode,
        maxResults: maxResults
      };

      if (categoryId) {
        params.videoCategoryId = categoryId;
      }

      const response = await this.ensureInitialized().videos.list(params);

      return response.data.items?.map(video => ({
        id: video.id,
        title: video.snippet?.title,
        channelTitle: video.snippet?.channelTitle,
        publishedAt: video.snippet?.publishedAt,
        viewCount: video.statistics?.viewCount,
        likeCount: video.statistics?.likeCount
      })) || [];
    } catch (error) {
      throw new Error(
        `Failed to retrieve trending videos: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async compareVideos({ videoIds }: CompareVideosOptions) {
    await this.initialize();

    try {
      const response = await this.ensureInitialized().videos.list({
        part: ['snippet', 'statistics'],
        id: videoIds
      });

      if (!response.data.items?.length) {
        throw new Error('No videos found.');
      }

      return response.data.items.map(video => ({
        id: video.id,
        title: video.snippet?.title,
        viewCount: video.statistics?.viewCount,
        likeCount: video.statistics?.likeCount,
        commentCount: video.statistics?.commentCount,
        publishedAt: video.snippet?.publishedAt
      }));
    } catch (error) {
      throw new Error(
        `Failed to compare videos: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Search within a video transcript for specific terms
   * @param videoId - YouTube video ID
   * @param query - Search term (case-insensitive)
   * @param lang - Language code (optional)
   * @returns Matching transcript segments with timestamps
   */
  async searchTranscript(videoId: string, query: string, lang?: string) {
    try {
      const transcript = await this.getTranscript(videoId, lang);

      const queryLower = query.toLowerCase();
      const matches = transcript.filter(item =>
        item.text.toLowerCase().includes(queryLower)
      );

      return {
        videoId,
        query,
        language: lang || process.env.YOUTUBE_TRANSCRIPT_LANG || 'en',
        matchCount: matches.length,
        matches: matches.map(item => ({
          start: item.start,
          duration: item.dur,
          text: item.text,
          // Add context highlighting
          highlightedText: item.text.replace(
            new RegExp(query, 'gi'),
            (match) => `**${match}**`
          )
        }))
      };
    } catch (error) {
      throw new Error(
        `Failed to search transcript for video ${videoId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get transcript with human-readable timestamps
   * @param videoId - YouTube video ID
   * @param lang - Language code (optional)
   * @returns Transcript with formatted timestamps
   */
  async getTimestampedCaptions(videoId: string, lang?: string) {
    try {
      const transcript = await this.getTranscript(videoId, lang);

      return transcript.map(item => {
        const startSeconds = parseFloat(item.start);
        const minutes = Math.floor(startSeconds / 60);
        const seconds = Math.floor(startSeconds % 60);
        const milliseconds = Math.floor((startSeconds % 1) * 1000);

        return {
          timestamp: `${minutes}:${String(seconds).padStart(2, '0')}`,
          timestampMs: `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`,
          text: item.text,
          startSeconds: startSeconds,
          durationSeconds: parseFloat(item.dur)
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to get timestamped captions for video ${videoId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Search within a specific channel's content
   * @param channelId - YouTube channel ID
   * @param query - Search query
   * @param maxResults - Maximum results to return
   * @returns Search results from the channel
   */
  async searchChannelContent({
    channelId,
    query,
    maxResults = 10
  }: SearchChannelContentOptions) {
    await this.initialize();

    try {
      const results: youtube_v3.Schema$SearchResult[] = [];
      let nextPageToken: string | undefined = undefined;
      const targetResults = Math.min(maxResults, this.ABSOLUTE_MAX_RESULTS);

      while (results.length < targetResults) {
        const response: youtube_v3.Schema$SearchListResponse = (await this.ensureInitialized().search.list({
          part: ['snippet'],
          channelId: channelId,
          q: query,
          type: ['video'],
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
        `Failed to search content in channel ${channelId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
} 