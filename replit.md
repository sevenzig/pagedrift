# Markdown eBook Reader

## Overview
A lightweight, modern eBook reader built with Svelte 5 and SvelteKit 2 that converts EPUB, MOBI, and PDF files into markdown format for clean, distraction-free reading with consistent styling across all book formats.

## Purpose
Provides developers and technical readers with a unified reading experience across different eBook formats, featuring a clean, text-focused interface without proprietary formatting.

## Current State
**MVP Complete** - The application is fully functional with core features implemented:
- ✅ File upload (EPUB, MOBI, PDF)
- ✅ Format parsing and markdown conversion
- ✅ Reading interface with typography controls
- ✅ Library management
- ✅ Theme support (light/dark/system)
- ✅ Local storage persistence
- ✅ Chapter navigation

## Recent Changes
*October 15, 2025*
- Initial project setup with SvelteKit 2 and Svelte 5
- Implemented EPUB, PDF, and basic MOBI parsers
- Created reader interface with settings panel
- Added library view with book management
- Configured Tailwind CSS with dark mode support
- Set up IndexedDB storage using localforage

## Tech Stack

### Frontend Framework
- **Svelte 5** with SvelteKit 2 (using runes for state management)
- **Tailwind CSS** for styling
- **shadcn-svelte inspired** UI components

### Key Libraries
- **epubjs** - EPUB parsing
- **pdfjs-dist** - PDF text extraction
- **turndown** - HTML to Markdown conversion
- **markdown-it** - Markdown rendering
- **localforage** - IndexedDB storage wrapper

### Development Environment
- **Node.js 20** runtime
- **Vite** for build tooling
- **TypeScript** for type safety

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/              # UI components (Button, Card)
│   │   ├── Library.svelte   # Library grid view
│   │   ├── Reader.svelte    # Reading interface
│   │   └── UploadZone.svelte # File upload component
│   ├── parsers/
│   │   ├── epub-parser.ts   # EPUB processing
│   │   ├── pdf-parser.ts    # PDF text extraction
│   │   └── mobi-parser.ts   # Basic MOBI support
│   ├── stores/
│   │   ├── books.svelte.ts     # Book library state (Svelte 5 runes)
│   │   ├── reader.svelte.ts    # Reading position state
│   │   └── settings.svelte.ts  # User preferences
│   ├── utils/
│   │   ├── storage.ts          # IndexedDB persistence
│   │   ├── file-validation.ts  # File type/size validation
│   │   └── cn.ts               # Tailwind utility function
│   └── types.ts             # TypeScript interfaces
├── routes/
│   ├── +page.svelte            # Library view
│   ├── +layout.svelte          # Root layout
│   └── reader/[bookId]/
│       └── +page.svelte        # Reader view
└── app.css                     # Tailwind + theme variables
```

## Core Features

### File Upload & Import
- Drag-and-drop interface
- File picker button
- Supports `.epub`, `.mobi`, `.pdf` (max 50MB)
- Client-side validation
- Visual upload feedback

### Format Parsing
**EPUB:**
- Extracts text content and chapter hierarchy
- Preserves heading levels (H1-H6)
- Converts HTML to markdown
- Extracts metadata (title, author)

**PDF:**
- Text layer extraction
- Paragraph break preservation
- Automatic chapter chunking (10 pages per chapter)
- Quality depends on source PDF structure

**MOBI:**
- Basic text extraction
- Automatic chapter division
- Control character filtering
- Note: Limited compared to EPUB (MVP baseline)

### Reading Interface
- Clean, centered reading column (optimal line length)
- Responsive typography
- Chapter navigation (previous/next)
- Table of contents sidebar
- Progress indicator
- Mobile-responsive design

### Typography Settings
- Font size: Small, Medium, Large, Extra-Large
- Font family: Serif, Sans-serif, Monospace
- Line height: Normal, Relaxed, Loose

### Library Management
- Book grid view with metadata
- Search and filter capabilities
- Delete books functionality
- Recently read tracking
- LocalStorage persistence via IndexedDB

### Theme Support
- Light mode
- Dark mode
- System preference detection
- Real-time theme switching

## Data Models

### Book Interface
```typescript
interface Book {
  id: string;
  title: string;
  author?: string;
  format: 'epub' | 'mobi' | 'pdf';
  uploadDate: Date;
  lastRead?: Date;
  progress: number;
  coverImage?: string;
  markdown: string;
  chapters: Chapter[];
}
```

### Chapter Interface
```typescript
interface Chapter {
  id: string;
  title: string;
  content: string;
  level: number;
  order: number;
}
```

## How to Use

### Upload a Book
1. From the library view, use the upload zone
2. Drag & drop or click to select an EPUB, MOBI, or PDF file
3. Wait for processing (typically < 5 seconds for standard books)
4. Book appears in your library

### Read a Book
1. Click "Read" on any book in the library
2. Use Previous/Next buttons to navigate chapters
3. Click chapter titles in the table of contents to jump
4. Adjust settings in the right sidebar (desktop)

### Customize Reading Experience
- **Font Size**: Click SM, MD, LG, or XL in settings panel
- **Font Family**: Choose Serif, Sans, or Mono
- **Theme**: Select Light, Dark, or System preference

### Manage Library
- View all books in grid layout
- Delete books with the Delete button
- Books persist in browser storage

## Known Limitations

- Client-side processing only (no backend)
- Browser memory limits for large files (50MB max)
- PDF quality depends on source document structure
- MOBI format has basic support (MVP level)
- No DRM support (intentional)
- Images not extracted in MVP (text only)
- No cloud sync (local storage only)

## Future Enhancements (Post-MVP)

**Phase 2:**
- Enhanced MOBI parser with KF8 format support
- Cover image extraction and display
- Multi-column PDF layout handling
- Export processed markdown files
- Print functionality

**Phase 3:**
- Bookmarking system
- Reading statistics
- Full-text search within books
- Notes and highlights
- Keyboard shortcuts
- Multiple reading themes

## Development

### Running Locally
```bash
npm install
npm run dev
```

The app runs on port 5000 and is accessible at the webview URL.

### Building for Production
```bash
npm run build
npm run preview
```

### Tech Notes
- Uses Svelte 5 runes (`$state`, `$derived`, `$effect`) for reactivity
- Tailwind configured with CSS custom properties for theming
- IndexedDB via localforage for persistent storage
- PDF.js worker loaded from CDN
- Type assertions used for epub.js compatibility

## Browser Compatibility
- Modern browsers with ES2020+ support
- IndexedDB support required
- File API support required

## Security & Privacy
- All processing happens client-side
- No data sent to external servers
- No tracking or analytics
- No user accounts required
- Local storage only
- Clear data deletion options

---

*Built with ❤️ using Svelte 5 and SvelteKit 2*
