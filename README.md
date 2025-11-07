[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/icraft2170-youtube-data-mcp-server-badge.png)](https://mseep.ai/app/icraft2170-youtube-data-mcp-server)

# YouTube MCP Server v3.0
[![smithery badge](https://smithery.ai/badge/@icraft2170/youtube-data-mcp-server)](https://smithery.ai/server/@icraft2170/youtube-data-mcp-server)

An enhanced Model Context Protocol (MCP) server implementation with comprehensive YouTube Data API integration. Featuring optimized playlist management with 85% token reduction, transcript chunking, and robust error handling. Perfect for AI applications requiring deep YouTube content analysis.

## ⭐ What's New in v3.0

### 🚀 Optimized Playlist Items (BREAKING CHANGE)
* **85% Token Reduction**: ~400 tokens per video (vs ~2,700 with raw API)
* **Smart Pagination**: Use `listItemStart` for efficient navigation (e.g., start at video #26)
* **Engagement Metrics**: Calculated engagement ratios (likes + comments per 100 views)
* **Formatted Data**: Human-readable durations (1:23:45), category names (not IDs)
* **Flexible Truncation**: Optional description/tags with customizable lengths
* **Best Quality Thumbnails**: Automatic maxres/high resolution fallback

### 📦 Transcript Chunking System
* Paginate long transcripts with numeric chunks (1 = lines 1-1000, 2 = lines 1001-2000)
* Applies to: `getTranscripts`, `searchTranscript`, `getTimestampedCaptions`, `getPlaylistVideoTranscripts`
* Solves token limit issues for long videos (20+ minutes)
* Includes metadata: `{ chunk, start, end, total, hasMore }`

### 🔧 API Error Fixes
* Fixed `getRelatedVideos` deprecated parameter issue
* Now uses category-based recommendations

## ⭐ What's New in v2.0

### 🎵 Complete Playlist Management (NEW)
* Get playlist metadata and video listings
* Search for playlists across YouTube
* Batch extract transcripts from entire playlists
* List all playlists from any channel

### 🔍 Advanced Transcript Features (NEW)
* Search within video transcripts for specific terms
* Get human-readable timestamps (MM:SS format)
* Highlight matching text in search results

### 🏗️ Architecture Improvements (NEW)
* Lazy initialization for better performance
* Type-safe error handling throughout
* Comprehensive channel information retrieval
* Search within specific channel content

### 📊 Enhanced Existing Features
* Bulk operations with array inputs
* Advanced pagination (up to 500 results)
* Parallel processing with Promise.all
* Robust error messages with context

## Key Features

### Video Management (6 Tools)
* Retrieve detailed video information for multiple videos
* Advanced search with pagination support
* Find related videos
* Calculate engagement ratios
* Compare video statistics side-by-side
* View trending videos by region and category

### Transcript/Caption Management (4 Tools)
* Bulk transcript retrieval with language support
* Search within transcripts for specific terms
* Human-readable timestamps for easy citation
* Auto-generated caption support

### Channel Operations (4 Tools)
* Full channel information and statistics
* Top-performing videos from channels
* Search within specific channel content
* Analyze channel metrics

### Playlist Operations (5 Tools - NEW!)
* Get playlist details and metadata
* List all videos in playlists
* Search for playlists by query
* Batch transcript extraction from playlists
* List all playlists from channels

## Available Tools (18 Total)

### Video Tools (6)
| Tool | Description | Parameters |
|------|-------------|------------|
| `getVideoDetails` | Bulk video information retrieval | `videoIds` (array) |
| `searchVideos` | Advanced search with pagination | `query`, `maxResults?` |
| `getRelatedVideos` | Find similar content | `videoId`, `maxResults?` |
| `compareVideos` | Side-by-side video comparison | `videoIds` (array) |
| `getVideoEngagementRatio` | Calculate engagement metrics | `videoIds` (array) |
| `getTrendingVideos` | Regional trending content | `regionCode?`, `categoryId?`, `maxResults?` |

### Transcript Tools (4)
| Tool | Description | Parameters |
|------|-------------|------------|
| `getTranscripts` | Bulk transcript retrieval | `videoIds` (array), `lang?`, `chunk?` |
| `searchTranscript` | Search within transcripts | `videoId`, `query`, `lang?`, `chunk?` |
| `getTimestampedCaptions` | Human-readable timestamps | `videoId`, `lang?`, `chunk?` |

### Channel Tools (4)
| Tool | Description | Parameters |
|------|-------------|------------|
| `getChannel` | **NEW** Full channel information | `channelId`, `parts?` |
| `getChannelStatistics` | Channel metrics (bulk) | `channelIds` (array) |
| `getChannelTopVideos` | Most popular videos | `channelId`, `maxResults?` |
| `searchChannelContent` | **NEW** Search within channel | `channelId`, `query`, `maxResults?` |

### Playlist Tools (5)
| Tool | Description | Parameters |
|------|-------------|------------|
| `getPlaylist` | Playlist metadata | `playlistId`, `parts?` |
| `getPlaylistItems` | **v3.0 OPTIMIZED** Videos in playlist (~400 tokens/video) | `playlistId`, `listItemStart?`, `maxResults?`, `includeDescriptionTags?`, `descriptionLength?`, `tagsLength?` |
| `searchPlaylists` | Find playlists | `query`, `maxResults?` |
| `getPlaylistVideoTranscripts` | Batch playlist transcripts | `playlistId`, `lang?`, `maxVideos?`, `chunk?` |
| `listChannelPlaylists` | Channel's playlists | `channelId`, `maxResults?` |

## Installation

### Automatic Installation via Smithery

Automatically install YouTube MCP Server for Claude Desktop via [Smithery](https://smithery.ai/server/@icraft2170/youtube-data-mcp-server):

```bash
npx -y @smithery/cli install @icraft2170/youtube-data-mcp-server --client claude
```

### Manual Installation
```bash
# Install from npm
npm install youtube-data-mcp-server

# Or clone repository
git clone https://github.com/icraft2170/youtube-data-mcp-server.git
cd youtube-data-mcp-server
npm install
```

## Environment Configuration
Set the following environment variables:
* `YOUTUBE_API_KEY`: YouTube Data API key (required)
* `YOUTUBE_TRANSCRIPT_LANG`: Default caption language (optional, default: 'ko')

## MCP Client Configuration
Add the following to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "youtube": {
      "command": "npx",
      "args": ["-y", "youtube-data-mcp-server"],
      "env": {
        "YOUTUBE_API_KEY": "YOUR_API_KEY_HERE",
        "YOUTUBE_TRANSCRIPT_LANG": "ko"
      }
    }
  }
}
```

## YouTube API Setup
1. Access Google Cloud Console
2. Create a new project or select an existing one
3. Enable YouTube Data API v3
4. Create API credentials (API key)
5. Use the generated API key in your environment configuration

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build
```

## Network Configuration

The server exposes the following ports for communication:
- HTTP: 3000
- gRPC: 3001

## System Requirements
- Node.js 18.0.0 or higher

## Security Considerations
- Always keep your API key secure and never commit it to version control systems
- Manage your API key through environment variables or configuration files
- Set usage limits for your API key to prevent unauthorized use

## Changelog

### v3.0.0 (2025-11-07)
**Major Release - Token Optimization & Transcript Chunking**

⚠️ **BREAKING CHANGES:**
- `getPlaylistItems` API completely redesigned:
  - Old: `getPlaylistItems({ playlistId, maxResults })`
  - New: `getPlaylistItems(playlistId, { listItemStart?, maxResults?, includeDescriptionTags?, descriptionLength?, tagsLength? })`
  - Returns optimized format: `{ totalListVideos, items: OptimizedPlaylistItem[] }`
  - Each item includes: engagement metrics, formatted duration, category names, truncated descriptions/tags

**New Features:**
- 🚀 **85% Token Reduction** for playlist items (~400 vs ~2,700 tokens per video)
- 📦 **Transcript Chunking System** for paginating long transcripts (all transcript tools)
- 📊 **Engagement Ratio Calculation** (likes + comments per 100 views)
- 🏷️ **Category Name Mapping** (44 YouTube categories, human-readable names)
- ⏱️ **Duration Formatting** (ISO 8601 → "1:23:45" or "23:45")
- 🖼️ **Best Quality Thumbnails** (maxres with high fallback)

**Improvements:**
- ✅ Fixed `getRelatedVideos` API deprecation error (relatedToVideoId removed)
- ✅ Smart pagination with `listItemStart` parameter
- ✅ Flexible description/tags truncation
- ✅ Comprehensive chunk metadata (`{ chunk, start, end, total, hasMore }`)
- ✅ Validated parameter ranges with helpful error messages

**API Changes:**
- `getPlaylistItems`: Complete redesign (see breaking changes above)
- All transcript tools: Added optional `chunk` parameter
- `getRelatedVideos`: Now uses category-based search instead of deprecated relatedToVideoId

### v2.0.0 (2025-11-07)
**Major Release - Feature Complete**

**New Features:**
- 🎵 Complete Playlist Management (5 new tools)
- 🔍 Advanced transcript search capabilities
- ⏱️ Human-readable timestamp formatting
- 📺 Full channel information retrieval
- 🔎 Channel content search

**Improvements:**
- ✅ Type-safe error handling across all methods
- ✅ Lazy initialization for better performance
- ✅ Enhanced error messages with context
- ✅ Upgraded to youtube-caption-extractor (better auto-generated caption support)

**Tools Added:** 9 → 18 (+100% growth)

### v1.0.15
- Initial public release
- Basic video, transcript, and channel tools

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License. See the LICENSE file for details. 
