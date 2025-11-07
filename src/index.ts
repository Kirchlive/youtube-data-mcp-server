#!/usr/bin/env node

import 'dotenv/config';
import { VideoManagement } from './functions/videos.js';
import { PlaylistManagement } from './functions/playlists.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Environment variable validation
if (!process.env.YOUTUBE_API_KEY) {
  console.error('Error: YOUTUBE_API_KEY environment variable is not set.');
  process.exit(1);
}

// Default subtitle language setting
const defaultTranscriptLang = process.env.YOUTUBE_TRANSCRIPT_LANG || 'ko';

interface VideoDetailsParams {
    videoId: string;
}

interface VideoDetailsListParams {
    videoIds: string[];
}

interface TranscriptParams {
    videoId: string;
    lang?: string;
    chunk?: number;
}

interface TranscriptsParams {
    videoIds: string[];
    lang?: string;
    chunk?: number;
}

interface SearchParams {
    query: string;
    maxResults?: number;
}

interface RelatedVideosParams {
    videoId: string;
    maxResults?: number;
}

interface ChannelParams {
    channelId: string;
    maxResults?: number;
}

interface TrendingParams {
    regionCode?: string;
    categoryId?: string;
    maxResults?: number;
}

interface CompareVideosParams {
    videoIds: string[];
}

interface SearchTranscriptParams {
    videoId: string;
    query: string;
    lang?: string;
    chunk?: number;
}

interface VideoEngagementRatiosParams {
    videoIds: string[];
}

interface ChannelStatisticsParams {
    channelIds: string[];
}

async function main() {
    const videoManager = new VideoManagement();
    const playlistManager = new PlaylistManagement();

    // Create MCP server
    const server = new McpServer({
        name: "YouTube",
        version: "1.0.0"
    });

    // Video details retrieval tool
    server.tool("getVideoDetails",
        "Get detailed information about multiple YouTube videos. Returns comprehensive data including video metadata, statistics, and content details. Use this when you need complete information about specific videos.",
        { videoIds: z.array(z.string()) },
        async ({ videoIds }: VideoDetailsListParams) => {
            try {
                const videoPromises = videoIds.map(videoId => 
                    videoManager.getVideo({
                        videoId,
                        parts: ["snippet", "statistics", "contentDetails"]
                    })
                );
                const videoDetailsList = await Promise.all(videoPromises);
                
                // Create a map of videoId to details
                const result = videoIds.reduce((acc, videoId, index) => {
                    acc[videoId] = videoDetailsList[index];
                    return acc;
                }, {} as Record<string, any>);
                
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{ 
                        type: "text", 
                        text: JSON.stringify({
                            error: error.message,
                            details: error.response?.data
                        }, null, 2) 
                    }]
                };
            }
        }
    );

    // Video search tool
    server.tool("searchVideos",
        "Searches for videos based on a query string. Returns a list of videos matching the search criteria, including titles, descriptions, and metadata. Use this when you need to find videos related to specific topics or keywords.",
        { 
            query: z.string(),
            maxResults: z.number().optional()
        },
        async ({ query, maxResults }: SearchParams) => {
            try {
                const searchResults = await videoManager.searchVideos({
                    query,
                    maxResults
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(searchResults, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{ 
                        type: "text", 
                        text: JSON.stringify({
                            error: error.message,
                            details: error.response?.data
                        }, null, 2) 
                    }]
                };
            }
        }
    );

    // Video transcript retrieval tool
    server.tool("getTranscripts",
        "Retrieves transcripts for multiple videos. Returns the text content of videos' captions, useful for accessibility and content analysis. Use this when you need the spoken content of multiple videos. Use chunk parameter to paginate long transcripts (0=full, 1=first 1000 lines, 2=next 1000, etc.).",
        {
            videoIds: z.array(z.string()),
            lang: z.string().optional(),
            chunk: z.number().optional()
        },
        async ({ videoIds, lang, chunk }: TranscriptsParams) => {
            try {
                const transcriptPromises = videoIds.map(videoId =>
                    videoManager.getTranscript(videoId, lang, chunk)
                );
                const transcripts = await Promise.all(transcriptPromises);

                // Create a map of videoId to transcript
                const result = videoIds.reduce((acc, videoId, index) => {
                    acc[videoId] = transcripts[index];
                    return acc;
                }, {} as Record<string, any>);

                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    );

    // Search transcript tool
    server.tool("searchTranscript",
        "Search within a video's transcript for specific terms or phrases. Returns matching segments with timestamps and highlighted text. Useful for finding specific mentions, quotes, or topics within videos. Use chunk parameter to paginate results (0=full, 1=first 1000 matches, 2=next 1000, etc.).",
        {
            videoId: z.string(),
            query: z.string(),
            lang: z.string().optional(),
            chunk: z.number().optional()
        },
        async ({ videoId, query, lang, chunk }: SearchTranscriptParams) => {
            try {
                const result = await videoManager.searchTranscript(videoId, query, lang, chunk);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    // Timestamped captions tool
    server.tool("getTimestampedCaptions",
        "Get video captions with human-readable timestamps (MM:SS format). Returns transcript segments with formatted time markers for easy reference and citation. Use chunk parameter to paginate long transcripts (0=full, 1=first 1000 lines, 2=next 1000, etc.).",
        {
            videoId: z.string(),
            lang: z.string().optional(),
            chunk: z.number().optional()
        },
        async ({ videoId, lang, chunk }: TranscriptParams) => {
            try {
                const result = await videoManager.getTimestampedCaptions(videoId, lang, chunk);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    // Related videos retrieval tool
    server.tool("getRelatedVideos",
        "Retrieves related videos for a specific video. Returns a list of videos that are similar or related to the specified video, based on YouTube's recommendation algorithm. Use this when you want to discover content similar to a particular video.",
        {
            videoId: z.string(),
            maxResults: z.number().optional()
        },
        async ({ videoId, maxResults }: RelatedVideosParams) => {
            try {
                const relatedVideos = await videoManager.getRelatedVideos(videoId, maxResults);
                return {
                    content: [{ type: "text", text: JSON.stringify(relatedVideos, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error.message,
                            details: error.response?.data
                        }, null, 2)
                    }]
                };
            }
        }
    );

    // Channel information retrieval tool
    server.tool("getChannel",
        "Get comprehensive information about a YouTube channel including description, branding, content details, and statistics. Returns full channel data beyond just statistics.",
        {
            channelId: z.string(),
            parts: z.array(z.string()).optional()
        },
        async ({ channelId, parts }: { channelId: string; parts?: string[] }) => {
            try {
                const result = await videoManager.getChannel({ channelId, parts });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    // Channel statistics retrieval tool
    server.tool("getChannelStatistics",
        "Retrieves statistics for multiple channels. Returns detailed metrics including subscriber count, view count, and video count for each channel. Use this when you need to analyze the performance and reach of multiple YouTube channels.",
        { channelIds: z.array(z.string()) },
        async ({ channelIds }: ChannelStatisticsParams) => {
            try {
                const statisticsPromises = channelIds.map(channelId => 
                    videoManager.getChannelStatistics(channelId)
                );
                const statisticsResults = await Promise.all(statisticsPromises);
                
                // Create a map of channelId to statistics
                const result = channelIds.reduce((acc, channelId, index) => {
                    acc[channelId] = statisticsResults[index];
                    return acc;
                }, {} as Record<string, any>);
                
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{ 
                        type: "text", 
                        text: JSON.stringify({
                            error: error.message,
                            details: error.response?.data
                        }, null, 2) 
                    }]
                };
            }
        }
    );

    // Channel top videos retrieval tool
    server.tool("getChannelTopVideos",
        "Retrieves the top videos from a specific channel. Returns a list of the most viewed or popular videos from the channel, based on view count. Use this when you want to identify the most successful content from a channel.",
        { 
            channelId: z.string(),
            maxResults: z.number().optional()
        },
        async ({ channelId, maxResults }: ChannelParams) => {
            try {
                const topVideos = await videoManager.getChannelTopVideos({ channelId, maxResults });
                return {
                    content: [{ type: "text", text: JSON.stringify(topVideos, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{ 
                        type: "text", 
                        text: JSON.stringify({
                            error: error.message,
                            details: error.response?.data
                        }, null, 2) 
                    }]
                };
            }
        }
    );

    // Video engagement ratio calculation tool
    server.tool("getVideoEngagementRatio",
        "Calculates the engagement ratio for multiple videos. Returns metrics such as view count, like count, comment count, and the calculated engagement ratio for each video. Use this when you want to measure the audience interaction with videos.",
        { videoIds: z.array(z.string()) },
        async ({ videoIds }: VideoEngagementRatiosParams) => {
            try {
                const engagementPromises = videoIds.map(videoId => 
                    videoManager.getVideoEngagementRatio(videoId)
                );
                const engagementResults = await Promise.all(engagementPromises);
                
                // Create a map of videoId to engagement data
                const result = videoIds.reduce((acc, videoId, index) => {
                    acc[videoId] = engagementResults[index];
                    return acc;
                }, {} as Record<string, any>);
                
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{ 
                        type: "text", 
                        text: JSON.stringify({
                            error: error.message,
                            details: error.response?.data
                        }, null, 2) 
                    }]
                };
            }
        }
    );

    // Trending videos retrieval tool
    server.tool("getTrendingVideos",
        "Retrieves trending videos based on region and category. Returns a list of videos that are currently popular in the specified region and category. Use this when you want to discover what's trending in specific areas or categories. Available category IDs: 1 (Film & Animation), 2 (Autos & Vehicles), 10 (Music), 15 (Pets & Animals), 17 (Sports), 18 (Short Movies), 19 (Travel & Events), 20 (Gaming), 21 (Videoblogging), 22 (People & Blogs), 23 (Comedy), 24 (Entertainment), 25 (News & Politics), 26 (Howto & Style), 27 (Education), 28 (Science & Technology), 29 (Nonprofits & Activism), 30 (Movies), 31 (Anime/Animation), 32 (Action/Adventure), 33 (Classics), 34 (Comedy), 35 (Documentary), 36 (Drama), 37 (Family), 38 (Foreign), 39 (Horror), 40 (Sci-Fi/Fantasy), 41 (Thriller), 42 (Shorts), 43 (Shows), 44 (Trailers).",
        { 
            regionCode: z.string().optional(),
            categoryId: z.string().optional(),
            maxResults: z.number().optional()
        },
        async ({ regionCode, categoryId, maxResults }: TrendingParams) => {
            try {
                const trendingVideos = await videoManager.getTrendingVideos({ regionCode, categoryId, maxResults });
                return {
                    content: [{ type: "text", text: JSON.stringify(trendingVideos, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{ 
                        type: "text", 
                        text: JSON.stringify({
                            error: error.message,
                            details: error.response?.data
                        }, null, 2) 
                    }]
                };
            }
        }
    );

    // Video comparison tool
    server.tool("compareVideos",
        "Compares multiple videos based on their statistics. Returns a comparison of view counts, like counts, comment counts, and other metrics for the specified videos. Use this when you want to analyze the performance of multiple videos side by side.",
        { videoIds: z.array(z.string()) },
        async ({ videoIds }: CompareVideosParams) => {
            try {
                const comparison = await videoManager.compareVideos({ videoIds });
                return {
                    content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error.message,
                            details: error.response?.data
                        }, null, 2)
                    }]
                };
            }
        }
    );

    // Playlist tools
    server.tool("getPlaylist",
        "Get detailed information about a YouTube playlist including metadata, video count, and description.",
        {
            playlistId: z.string(),
            parts: z.array(z.string()).optional()
        },
        async ({ playlistId, parts }) => {
            try {
                const result = await playlistManager.getPlaylist({ playlistId, parts });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    server.tool("getPlaylistItems",
        "Get optimized playlist items with detailed video information. Returns ~400 tokens per video (vs ~2,700 with raw API). Includes engagement metrics, formatted duration, category names, and optional description/tags truncation. Use listItemStart for pagination (e.g., listItemStart=26 for second page of 25 items).",
        {
            playlistId: z.string(),
            listItemStart: z.number().optional(),
            maxResults: z.number().optional(),
            includeDescriptionTags: z.boolean().optional(),
            descriptionLength: z.number().optional(),
            tagsLength: z.number().optional()
        },
        async ({ playlistId, listItemStart, maxResults, includeDescriptionTags, descriptionLength, tagsLength }) => {
            try {
                const result = await playlistManager.getPlaylistItems(playlistId, {
                    listItemStart,
                    maxResults,
                    includeDescriptionTags,
                    descriptionLength,
                    tagsLength
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    server.tool("searchPlaylists",
        "Search for playlists on YouTube by query. Returns matching playlists with their metadata.",
        {
            query: z.string(),
            maxResults: z.number().optional()
        },
        async ({ query, maxResults }) => {
            try {
                const result = await playlistManager.searchPlaylists({ query, maxResults });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    server.tool("getPlaylistVideoTranscripts",
        "Get transcripts for all videos in a playlist. Useful for batch transcript extraction with language support. Use chunk parameter to paginate each video's transcript (0=full, 1=first 1000 lines, 2=next 1000, etc.).",
        {
            playlistId: z.string(),
            lang: z.string().optional(),
            maxVideos: z.number().optional(),
            chunk: z.number().optional()
        },
        async ({ playlistId, lang, maxVideos, chunk }) => {
            try {
                const result = await playlistManager.getPlaylistVideoTranscripts({
                    playlistId,
                    lang,
                    maxVideos,
                    chunk
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    server.tool("listChannelPlaylists",
        "List all playlists from a specific YouTube channel. Returns playlist metadata for channel organization.",
        {
            channelId: z.string(),
            maxResults: z.number().optional()
        },
        async ({ channelId, maxResults }) => {
            try {
                const result = await playlistManager.listChannelPlaylists(channelId, maxResults);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    // Channel content search tool
    server.tool("searchChannelContent",
        "Search for videos within a specific YouTube channel. Combines channel filtering with search functionality.",
        {
            channelId: z.string(),
            query: z.string(),
            maxResults: z.number().optional()
        },
        async ({ channelId, query, maxResults }) => {
            try {
                const result = await videoManager.searchChannelContent({
                    channelId,
                    query,
                    maxResults
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    // Start sending and receiving messages via stdin/stdout
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('YouTube MCP server has started.');
}

main().catch((err) => {
    console.error('Error occurred during server execution:', err);
    process.exit(1);
}); 