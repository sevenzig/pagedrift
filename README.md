# Markdown eBook Reader

A lightweight, modern eBook reader built with **Svelte 5** and **SvelteKit 2** that converts EPUB, MOBI, and PDF files into markdown format for clean, distraction-free reading.

## ✨ Features

- **Multi-Format Support**: Upload EPUB, MOBI, or PDF files (max 50MB)
- **Markdown Conversion**: All books converted to clean markdown format
- **Beautiful Reading Interface**: Centered reading column with optimal typography
- **Customizable Typography**: 
  - Font sizes (Small, Medium, Large, Extra-Large)
  - Font families (Serif, Sans-serif, Monospace)
  - Line height adjustments
- **Chapter Navigation**: Table of contents with chapter jumping
- **Theme Support**: Light, Dark, and System preference detection
- **Offline Storage**: Books stored locally in IndexedDB
- **Library Management**: Organize and manage your book collection
- **Privacy-First**: All processing happens client-side, no data sent to servers

## 🚀 Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5000`

### Build for Production

```bash
npm run build
npm run preview
```

## 📖 How to Use

1. **Upload a Book**: Drag and drop an EPUB, MOBI, or PDF file onto the upload zone
2. **Start Reading**: Click "Read" on any book in your library
3. **Navigate**: Use Previous/Next buttons or the table of contents to navigate chapters
4. **Customize**: Adjust font size, family, and theme in the settings panel
5. **Manage**: Delete books from your library when you're done

## 🛠️ Tech Stack

- **Framework**: Svelte 5 with SvelteKit 2
- **Styling**: Tailwind CSS v4
- **Storage**: IndexedDB (via localforage)
- **Parsers**:
  - EPUB: epubjs
  - PDF: pdfjs-dist
  - MOBI: Custom basic parser
- **Markdown**: 
  - Conversion: Turndown
  - Rendering: markdown-it

## 📁 Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/              # Button, Card components
│   │   ├── Library.svelte   # Library grid view
│   │   ├── Reader.svelte    # Reading interface
│   │   └── UploadZone.svelte
│   ├── parsers/
│   │   ├── epub-parser.ts
│   │   ├── pdf-parser.ts
│   │   └── mobi-parser.ts
│   ├── stores/
│   │   ├── books.svelte.ts
│   │   ├── reader.svelte.ts
│   │   └── settings.svelte.ts
│   ├── utils/
│   │   ├── storage.ts
│   │   ├── file-validation.ts
│   │   └── cn.ts
│   └── types.ts
└── routes/
    ├── +page.svelte         # Library view
    └── reader/[bookId]/
        └── +page.svelte     # Reader view
```

## ⚡ Features Overview

### File Upload
- Drag-and-drop interface
- File validation (type and size)
- Visual upload feedback
- Support for EPUB, MOBI, and PDF formats

### Format Parsing

**EPUB**:
- Full text extraction
- Chapter hierarchy preservation
- Metadata extraction (title, author)
- HTML to Markdown conversion

**PDF**:
- Text layer extraction
- Paragraph break preservation
- Automatic chapter chunking

**MOBI**:
- Basic text extraction
- Automatic chapter division
- Clean text processing

### Reading Experience
- Clean, centered layout
- Responsive design (mobile, tablet, desktop)
- Typography customization
- Progress tracking
- Chapter navigation
- Table of contents

## 🎨 Customization

The reader offers extensive customization options:

- **Font Size**: SM, MD, LG, XL
- **Font Family**: Serif, Sans-serif, Monospace
- **Line Height**: Normal, Relaxed, Loose
- **Theme**: Light, Dark, System

## 🔒 Privacy & Security

- **Client-Side Only**: All processing happens in your browser
- **No External Servers**: No data sent to external services
- **Local Storage**: Books stored in browser IndexedDB
- **No Tracking**: No analytics or user tracking
- **No Accounts**: No registration or login required

## 🌐 Browser Compatibility

- Modern browsers with ES2020+ support
- IndexedDB support required
- File API support required
- Recommended: Chrome, Firefox, Safari, Edge (latest versions)

## ⚠️ Known Limitations

- Client-side processing only (no backend)
- Browser memory limits for large files (50MB max)
- PDF quality depends on source document structure
- MOBI format has basic support (MVP level)
- No DRM support (intentional)
- Images not extracted (text only)
- No cloud sync

## 🔮 Future Enhancements

- Enhanced MOBI parser with KF8 format support
- Cover image extraction and display
- Export processed markdown files
- Bookmarking system
- Reading statistics
- Full-text search within books
- Notes and highlights
- Keyboard shortcuts

## 📝 License

MIT License - Feel free to use this project for any purpose.

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

---

**Built with ❤️ using Svelte 5 and SvelteKit 2**
