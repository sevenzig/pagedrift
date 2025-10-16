# EBook Reader - Local Development Setup

## Quick Start (Windows PowerShell)

1. **Navigate to project directory:**
   ```powershell
   cd C:\Users\scootypuffjr\Projects\ebook-reader\EBookVoyage\EBookVoyage
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Start development server:**
   ```powershell
   npm run dev
   ```

4. **Open in browser:**
   - Local: http://localhost:5000/
   - Network: http://192.168.30.2:5000/ (accessible from other devices)

## Project Overview

This is a **Markdown eBook Reader** built with:
- **SvelteKit 2** (latest)
- **Vite 7** for bundling
- **Tailwind CSS v4** for styling
- **TypeScript** for type safety

### Features
- 📚 Upload and read EPUB, MOBI, and PDF files
- 🎨 Customizable reading experience (font size, family, theme)
- 📱 Responsive design
- 💾 Local storage for books and settings
- 🔍 Chapter navigation
- 📖 Markdown rendering with syntax highlighting

### Supported Formats
- **EPUB**: Full parsing with table of contents
- **PDF**: Text extraction with page-based chapters
- **MOBI**: Basic text extraction with paragraph-based chapters

### File Structure
```
src/
├── lib/
│   ├── components/          # UI components
│   │   ├── Library.svelte   # Main library view
│   │   ├── Reader.svelte    # Reading interface
│   │   ├── UploadZone.svelte # File upload
│   │   └── ui/              # Reusable UI components
│   ├── parsers/             # Book format parsers
│   ├── stores/              # Svelte stores for state
│   ├── types.ts             # TypeScript definitions
│   └── utils/               # Utility functions
└── routes/                  # SvelteKit routes
    ├── +page.svelte         # Home page (Library)
    └── reader/[bookId]/     # Reader page
```

## Development Commands

```powershell
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Type checking with watch mode
npm run check:watch
```

## Browser Compatibility

- Modern browsers with ES2020+ support
- IndexedDB support (for local storage)
- File API support (for uploads)

## Notes

- Books are stored locally using IndexedDB (localforage)
- No server required - fully client-side application
- PDF.js worker is loaded from CDN for PDF processing
- Maximum file size: 50MB
- All processing happens in the browser (no server uploads)

## Troubleshooting

If you encounter issues:

1. **Port already in use**: The dev server will automatically try port 5001, 5002, etc.
2. **Dependencies issues**: Delete `node_modules` and `package-lock.json`, then run `npm install`
3. **TypeScript errors**: Run `npm run check` to see detailed type errors
4. **Build issues**: Ensure you're using Node.js 18+ and npm 9+

## Production Deployment

The app can be deployed to any static hosting service:
- Vercel (recommended)
- Netlify
- GitHub Pages
- Any CDN with SPA support

Build command: `npm run build`
Output directory: `build/`
