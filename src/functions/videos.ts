import { google, youtube_v3 } from 'googleapis';
import { getSubtitles } from 'youtube-caption-extractor';
import {
  getCategoryName,
  getTopicName,
  getNCSRating,
  GetVideoDetailsOptions,
  OptimizedVideoDetails,
  ChannelMetrics
} from '../types/youtube.js';

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

  /**
   * Get optimized video details with channel metrics and transcript
   * @param videoIds - Array of video IDs
   * @param options - Configuration options
   * @returns Array of optimized video details
   */
  async getVideoDetails(
    videoIds: string[],
    options?: GetVideoDetailsOptions
  ): Promise<OptimizedVideoDetails[]> {
    await this.initialize();

    // Process options with defaults
    const {
      includeChannelInfo = true,
      includeTagDescTrans = true,
      transcriptOnly = false,
      transcriptChunk = 1000,
      chunkStart = 1,
      descriptionLength = 250,
      tagsLength = 100,
      channelDescLength = 150,
      lang
    } = options || {};

    try {
      // Step 1: Fetch video details (batch - max 50 per request)
      const videoResponses: youtube_v3.Schema$Video[] = [];

      for (let i = 0; i < videoIds.length; i += 50) {
        const batchIds = videoIds.slice(i, i + 50);
        const response = await this.ensureInitialized().videos.list({
          part: ['snippet', 'contentDetails', 'statistics'],
          id: batchIds
        });

        if (response.data.items) {
          videoResponses.push(...response.data.items);
        }
      }

      if (videoResponses.length === 0) {
        throw new Error('No videos found');
      }

      // Step 2: Get unique channel IDs if needed
      const channelIds = includeChannelInfo
        ? [...new Set(videoResponses.map(v => v.snippet?.channelId).filter((id): id is string => !!id))]
        : [];

      // Step 3: Fetch channel details with topicDetails
      const channelDataMap = new Map<string, youtube_v3.Schema$Channel>();

      if (channelIds.length > 0) {
        for (let i = 0; i < channelIds.length; i += 50) {
          const batchIds = channelIds.slice(i, i + 50);
          const channelResponse = await this.ensureInitialized().channels.list({
            part: ['snippet', 'statistics', 'brandingSettings', 'topicDetails'],
            id: batchIds
          });

          if (channelResponse.data.items) {
            channelResponse.data.items.forEach(channel => {
              if (channel.id) {
                channelDataMap.set(channel.id, channel);
              }
            });
          }
        }
      }

      // Step 4: Fetch transcripts if requested
      const transcriptMap = new Map<string, { fullText: string, formattedSegments: Array<Record<string, string>> }>();

      if (includeTagDescTrans) {
        await Promise.all(
          videoIds.map(async (videoId) => {
            try {
              const targetLang = lang || process.env.YOUTUBE_TRANSCRIPT_LANG || 'en';
              const subtitles = await getSubtitles({
                videoID: videoId,
                lang: targetLang
              });

              // Convert subtitle array to full text (for word counting)
              const fullText = subtitles.map(item => item.text).join(' ');

              // Create formatted segments: [{"0:00": "text"}, {"0:05": "text"}, ...]
              const formattedSegments = subtitles.map(item => {
                const startSeconds = parseFloat(item.start);
                const minutes = Math.floor(startSeconds / 60);
                const seconds = Math.floor(startSeconds % 60);
                const timestamp = `${minutes}:${String(seconds).padStart(2, '0')}`;

                return { [timestamp]: item.text };
              });

              transcriptMap.set(videoId, { fullText, formattedSegments });
            } catch (error) {
              // Transcript might not be available - skip silently
              transcriptMap.set(videoId, { fullText: '', formattedSegments: [] });
            }
          })
        );
      }

      // Step 5: Process and optimize each video
      const optimizedVideos: OptimizedVideoDetails[] = videoResponses.map(video => {
        const snippet = video.snippet;
        const statistics = video.statistics;
        const contentDetails = video.contentDetails;
        const videoId = video.id!;

        // Parse statistics
        const videoViewCount = parseInt(statistics?.viewCount || '0', 10);
        const likeCount = parseInt(statistics?.likeCount || '0', 10);
        const commentCount = parseInt(statistics?.commentCount || '0', 10);

        // Calculate engagement ratio
        const engagementRatio = videoViewCount > 0
          ? (((likeCount + commentCount) / (videoViewCount / 100))).toFixed(2)
          : '0.00';

        // Format duration
        const duration = this.formatDuration(contentDetails?.duration || 'PT0S');

        // Get best quality thumbnail
        const thumbnail = snippet?.thumbnails?.maxres?.url ||
                         snippet?.thumbnails?.high?.url ||
                         snippet?.thumbnails?.default?.url ||
                         '';

        // Truncate description if needed (only if not transcriptOnly)
        let videoDescription: string | undefined = undefined;
        if (includeTagDescTrans && !transcriptOnly && snippet?.description) {
          videoDescription = snippet.description.length > descriptionLength
            ? snippet.description.substring(0, descriptionLength) + '...'
            : snippet.description;
        }

        // Truncate tags if needed (only if not transcriptOnly)
        let tags: string[] | undefined = undefined;
        if (includeTagDescTrans && !transcriptOnly && snippet?.tags && snippet.tags.length > 0) {
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

        // Process transcript with word-based chunking
        let transcription: OptimizedVideoDetails['transcription'] = undefined;
        if (includeTagDescTrans && transcriptMap.has(videoId)) {
          const transcriptData = transcriptMap.get(videoId)!;

          if (transcriptData && transcriptData.fullText) {
            const chunked = this.chunkTranscriptByWords(transcriptData.fullText, transcriptChunk, chunkStart);
            transcription = {
              text: transcriptData.formattedSegments,
              chunkInfo: chunked.chunkInfo
            };
          }
        }

        // Build optimized video details
        const optimizedVideo: OptimizedVideoDetails = {
          videoTitle: snippet?.title || 'Unknown Title',
          videoId,
          duration,
          videoPublished: snippet?.publishedAt || '',
          categoryId: getCategoryName(snippet?.categoryId || undefined),
          videoViewCount,
          likeCount,
          commentCount,
          engagementRatio,
          thumbnail
        };

        // Add optional video fields
        if (tags && tags.length > 0) optimizedVideo.tags = tags;
        if (videoDescription) optimizedVideo.videoDescription = videoDescription;
        if (transcription) optimizedVideo.transcription = transcription;
        if (snippet?.defaultAudioLanguage) optimizedVideo.videoLanguage = snippet.defaultAudioLanguage;

        // Add channel metrics if requested
        if (includeChannelInfo && snippet?.channelId) {
          const channelData = channelDataMap.get(snippet.channelId);

          if (channelData) {
            const channelStats = channelData.statistics;
            const channelSnippet = channelData.snippet;
            const brandingSettings = channelData.brandingSettings;
            const topicDetails = channelData.topicDetails;

            // Parse channel statistics
            const subscriberCount = parseInt(channelStats?.subscriberCount || '0', 10);
            const channelViewCount = parseInt(channelStats?.viewCount || '0', 10);
            const channelVideoCount = parseInt(channelStats?.videoCount || '0', 10);

            // Calculate channel metrics
            const avgVideoViews = channelVideoCount > 0
              ? Math.round(channelViewCount / channelVideoCount)
              : 0;

            // Calculate channel age in weeks
            const channelPublished = channelSnippet?.publishedAt || '';
            const channelAgeMs = channelPublished
              ? Date.now() - new Date(channelPublished).getTime()
              : 0;
            const channelAgeWeeks = Math.max(1, Math.floor(channelAgeMs / (7 * 24 * 60 * 60 * 1000)));

            const ccVideosPerWeek = channelVideoCount / channelAgeWeeks;

            // Calculate VSR (Views/Subs Ratio)
            const vsrViewsSubsRatio = subscriberCount > 0
              ? (avgVideoViews / subscriberCount) * 100
              : 0;

            // Calculate NCS Total (Normalized Channel Score)
            const vsr_normalized = Math.min(100, (vsrViewsSubsRatio / 14) * 100);
            const content_consistency = Math.min(100, ccVideosPerWeek * 4 * 10);
            const ncsTotal = Math.round((vsr_normalized * 0.6) + (content_consistency * 0.4));
            const ncsRating = getNCSRating(ncsTotal);

            // Process topic IDs to names
            let topicNames: string[] | undefined = undefined;
            if (topicDetails?.topicIds && topicDetails.topicIds.length > 0) {
              topicNames = topicDetails.topicIds.map(id => getTopicName(id));
            }

            // Truncate channel description
            let channelDescription: string | undefined = undefined;
            if (channelSnippet?.description) {
              channelDescription = channelSnippet.description.length > channelDescLength
                ? channelSnippet.description.substring(0, channelDescLength) + '...'
                : channelSnippet.description;
            }

            const channelMetrics: ChannelMetrics = {
              channelName: channelSnippet?.title || 'Unknown Channel',
              subscriberCount,
              channelViewCount,
              channelVideoCount,
              channelPublished,
              avgVideoViews,
              ccVideosPerWeek: parseFloat(ccVideosPerWeek.toFixed(2)),
              vsrViewsSubsRatio: parseFloat(vsrViewsSubsRatio.toFixed(2)),
              ncsTotal,
              ncsRating
            };

            // Add optional channel fields
            if (channelDescription) channelMetrics.channelDescription = channelDescription;
            if (brandingSettings?.channel?.keywords) {
              // Parse keywords: split by space but handle quoted phrases
              const keywordString = brandingSettings.channel.keywords;
              const keywords = keywordString.match(/"[^"]+"|[^\s]+/g)?.map(k => k.replace(/^"|"$/g, '')) || [];
              channelMetrics.keywords = keywords.slice(0, 10);
            }
            if (topicNames && topicNames.length > 0) channelMetrics.topicIds = topicNames;
            if (channelSnippet?.defaultLanguage) channelMetrics.channelLanguage = channelSnippet.defaultLanguage;

            optimizedVideo.channelMetrics = channelMetrics;
          }
        }

        return optimizedVideo;
      });

      return optimizedVideos;
    } catch (error) {
      throw new Error(
        `Failed to retrieve optimized video details: ${error instanceof Error ? error.message : String(error)}`
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

  /**
   * Apply chunking to transcript array (line-based - legacy)
   * @param transcript - Full transcript array
   * @param chunk - Chunk number (0 or undefined = full, 1 = first 1000, 2 = next 1000, etc.)
   * @returns Chunked transcript with metadata
   */
  private chunkTranscript<T>(transcript: T[], chunk?: number): { items: T[], chunkInfo: { chunk: number, start: number, end: number, total: number, hasMore: boolean } } {
    const CHUNK_SIZE = 1000;

    // chunk 0 or undefined means return full transcript
    if (!chunk || chunk === 0) {
      return {
        items: transcript,
        chunkInfo: {
          chunk: 0,
          start: 0,
          end: transcript.length,
          total: transcript.length,
          hasMore: false
        }
      };
    }

    // Calculate chunk boundaries
    const startIndex = (chunk - 1) * CHUNK_SIZE;
    const endIndex = Math.min(startIndex + CHUNK_SIZE, transcript.length);

    // Validate chunk number
    if (startIndex >= transcript.length) {
      throw new Error(
        `Invalid chunk ${chunk}: transcript only has ${transcript.length} lines (${Math.ceil(transcript.length / CHUNK_SIZE)} chunks available)`
      );
    }

    return {
      items: transcript.slice(startIndex, endIndex),
      chunkInfo: {
        chunk,
        start: startIndex,
        end: endIndex,
        total: transcript.length,
        hasMore: endIndex < transcript.length
      }
    };
  }

  /**
   * Chunk transcript text by word count
   * @param transcriptText - Full transcript as string
   * @param chunkSize - Number of words per chunk (default: 1000)
   * @param startWord - Starting word position (default: 1)
   * @returns Chunked text with metadata
   */
  private chunkTranscriptByWords(
    transcriptText: string,
    chunkSize: number = 1000,
    startWord: number = 1
  ): {
    text: string;
    wordCount: number;
    chunkInfo?: {
      chunkStart: number;
      chunkEnd: number;
      totalWords: number;
      hasMore: boolean;
    };
  } {
    // Split into words (preserve spaces for readability)
    const words = transcriptText.split(/\s+/).filter(w => w.length > 0);
    const totalWords = words.length;

    // If chunkSize === 0, return full transcript
    if (chunkSize === 0 || totalWords === 0) {
      return {
        text: transcriptText,
        wordCount: totalWords
      };
    }

    // Validate startWord
    if (startWord < 1) {
      throw new Error('chunkStart must be at least 1');
    }

    if (startWord > totalWords) {
      throw new Error(
        `chunkStart (${startWord}) exceeds total words in transcript (${totalWords})`
      );
    }

    // Calculate boundaries (convert to 0-indexed)
    const startIndex = startWord - 1;
    const endIndex = Math.min(startIndex + chunkSize, totalWords);

    // Extract chunk
    const chunkWords = words.slice(startIndex, endIndex);
    const chunkText = chunkWords.join(' ');

    return {
      text: chunkText,
      wordCount: chunkWords.length,
      chunkInfo: {
        chunkStart: startWord,
        chunkEnd: startWord + chunkWords.length - 1,
        totalWords,
        hasMore: endIndex < totalWords
      }
    };
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

  async getTranscript(videoId: string, lang?: string, chunk?: number) {
    try {
      // Use provided language, environment variable, or default to 'en'
      const targetLang = lang || process.env.YOUTUBE_TRANSCRIPT_LANG || 'en';

      const transcript = await getSubtitles({
        videoID: videoId,
        lang: targetLang
      });

      // Apply chunking if requested
      if (chunk !== undefined) {
        const chunked = this.chunkTranscript(transcript, chunk);
        return {
          transcript: chunked.items,
          ...chunked.chunkInfo
        };
      }

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
      // Get video details to extract category and channel
      const videoResponse = await this.ensureInitialized().videos.list({
        part: ['snippet'],
        id: [videoId]
      });

      if (!videoResponse.data.items?.length) {
        throw new Error('Video not found');
      }

      const video = videoResponse.data.items[0];
      const categoryId = video.snippet?.categoryId;
      const channelId = video.snippet?.channelId;

      if (!categoryId) {
        throw new Error('Video category not available');
      }

      // Search for videos in the same category
      const searchResponse = await this.ensureInitialized().search.list({
        part: ['snippet'],
        type: ['video'],
        videoCategoryId: categoryId,
        maxResults: maxResults + 5, // Get a few extra to filter out the original video
        order: 'relevance'
      });

      // Filter out the original video and limit results
      const relatedVideos = (searchResponse.data.items || [])
        .filter(item => item.id?.videoId !== videoId)
        .slice(0, maxResults);

      return relatedVideos;
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
   * @param chunk - Chunk number for pagination (0=full, 1=first 1000, 2=next 1000, etc.)
   * @returns Matching transcript segments with timestamps
   */
  async searchTranscript(videoId: string, query: string, lang?: string, chunk?: number) {
    try {
      // Get full transcript (without chunking yet)
      const transcriptData = await this.getTranscript(videoId, lang);

      // Handle both chunked and unchunked response formats
      const transcript = Array.isArray(transcriptData) ? transcriptData : transcriptData.transcript;

      const queryLower = query.toLowerCase();
      const matches = transcript.filter(item =>
        item.text.toLowerCase().includes(queryLower)
      );

      // Apply chunking to matches if requested
      let finalMatches = matches;
      let chunkInfo = undefined;

      if (chunk !== undefined) {
        const chunked = this.chunkTranscript(matches, chunk);
        finalMatches = chunked.items;
        chunkInfo = chunked.chunkInfo;
      }

      return {
        videoId,
        query,
        language: lang || process.env.YOUTUBE_TRANSCRIPT_LANG || 'en',
        matchCount: matches.length,
        matches: finalMatches.map(item => ({
          start: item.start,
          duration: item.dur,
          text: item.text,
          // Add context highlighting
          highlightedText: item.text.replace(
            new RegExp(query, 'gi'),
            (match) => `**${match}**`
          )
        })),
        ...(chunkInfo && { chunkInfo })
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
   * @param chunk - Chunk number for pagination (0=full, 1=first 1000, 2=next 1000, etc.)
   * @returns Transcript with formatted timestamps
   */
  async getTimestampedCaptions(videoId: string, lang?: string, chunk?: number) {
    try {
      // Get transcript with or without chunking
      const transcriptData = await this.getTranscript(videoId, lang, chunk);

      // Handle both chunked and unchunked response formats
      const transcript = Array.isArray(transcriptData) ? transcriptData : transcriptData.transcript;
      const chunkInfo = Array.isArray(transcriptData) ? undefined : {
        chunk: transcriptData.chunk,
        start: transcriptData.start,
        end: transcriptData.end,
        total: transcriptData.total,
        hasMore: transcriptData.hasMore
      };

      const formattedCaptions = transcript.map(item => {
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

      return chunkInfo ? {
        captions: formattedCaptions,
        chunkInfo
      } : formattedCaptions;
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