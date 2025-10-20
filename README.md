# PageDrift

A multi-user, server-side rendered eBook reader platform with authentication, permissions, and full-text search. Think Plex/Jellyfin for books—a shared library that everyone can access and read from any device.

## ✨ Features

- **Multi-User Platform**: Shared library with role-based access control
- **Authentication System**: JWT-based authentication with secure password hashing
- **Role-Based Permissions**: Admin, user, and guest roles with configurable upload/delete rights
- **Server-Side Rendering**: Fast initial page loads with SvelteKit SSR
- **Multi-Format Support**: EPUB, MOBI, and PDF files (max 50MB)
- **Full-Text Search**: Powered by Meilisearch for blazing-fast searches
- **Reading Progress Sync**: Track your progress across devices
- **Beautiful Reading Interface**: Customizable typography and themes
- **Admin Dashboard**: Manage users and permissions
- **Docker-Ready**: Easy deployment with docker-compose

## 🏗️ Architecture

### Stack

- **Frontend**: Svelte 5 + SvelteKit 2 (SSR)
- **Backend**: Node.js (adapter-node)
- **Database**: SQLite with Prisma ORM
- **Search**: Meilisearch
- **Authentication**: JWT with bcrypt
- **Storage**: Local filesystem with Docker volumes

### Data Model

```
User
  ├── hasMany → UserBookProgress
  └── hasMany → Book (uploaded books)

Book
  ├── hasMany → Chapter
  └── hasMany → UserBookProgress

UserBookProgress (tracks reading progress per user per book)
```

## 🚀 Quick Start with Docker

**For first-time Docker deployment, see [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for a complete guide.**

Quick setup:

```bash
# 1. Copy environment file
cp .env.docker .env

# 2. Generate secure secrets
openssl rand -base64 32  # Use for JWT_SECRET
openssl rand -base64 32  # Use for MEILISEARCH keys

# 3. Edit .env and update the secrets and ORIGIN

# 4. Start services
docker-compose up -d

# 5. Register first user at http://localhost:3000/register
```

## 🚀 Deployment to Dokploy

### Prerequisites

- Dokploy instance running
- GitHub repository with this code
- Or use docker-compose directly

### Option 1: Deploy from GitHub

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/pagedrift.git
   git push -u origin master
   ```

2. **Import in Dokploy**
   - Go to your Dokploy dashboard
   - Click "New Application"
   - Select "Import from GitHub"
   - Choose this repository

3. **Set Environment Variables** in Dokploy UI:
   ```
   JWT_SECRET=your-super-secret-jwt-key-change-this
   MEILISEARCH_MASTER_KEY=your-meilisearch-key-change-this
   DATABASE_URL=file:/app/data/db/sqlite.db
   MEILISEARCH_HOST=http://meilisearch:7700
   MEILISEARCH_KEY=your-meilisearch-key-change-this
   BOOKS_STORAGE_PATH=/app/data/books
   NODE_ENV=production
   ORIGIN=https://your-domain.com
   ```

4. **Configure Volumes** in Dokploy:
   - Mount `./data` → `/app/data` (for database and books)

5. **Deploy**
   - Click "Deploy"
   - First user to register becomes admin!

### Option 2: Deploy from docker-compose

1. **Create `.env` file** (see `.env.example`):
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Deploy to Dokploy**:
   - Go to Dokploy dashboard
   - Click "New Application"
   - Select "Docker Compose"
   - Upload your `docker-compose.yml`
   - Set environment variables
   - Deploy

### Post-Deployment

1. **Register First User** (becomes admin):
   - Navigate to `https://your-domain.com/register`
   - Create your account
   - You're now the admin!

2. **Invite Other Users**:
   - Share the registration link
   - New users register themselves
   - Manage their permissions in `/admin`

3. **Set User Permissions**:
   - Go to `/admin` (admin only)
   - Configure who can upload/delete books

## 🔧 Local Development

### Prerequisites

- Node.js 22+
- npm or pnpm

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your local values
   ```

3. **Generate Prisma client**:
   ```bash
   npm run prisma:generate
   ```

4. **Run database migrations**:
   ```bash
   npm run prisma:migrate
   ```

5. **Start Meilisearch** (in separate terminal):
   ```bash
   docker run -p 7700:7700 \
     -e MEILI_MASTER_KEY="your-meilisearch-key" \
     getmeili/meilisearch:v1.6
   ```

6. **Start development server**:
   ```bash
   npm run dev
   ```

7. **Open** `http://localhost:5173`

### Development with Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## 📖 Usage Guide

### For Admins

1. **User Management** (`/admin`):
   - View all users
   - Change user roles (admin/user/guest)
   - Grant upload permissions
   - Grant delete permissions

2. **Upload Books**:
   - Drag & drop EPUB, MOBI, or PDF files
   - Books are automatically parsed and indexed
   - Shared with all users

### For Users

1. **Browse Library** (`/`):
   - See all books uploaded by any user
   - Click to read

2. **Read Books** (`/reader/{bookId}`):
   - Navigate chapters
   - Customize reading experience
   - Progress automatically saved

3. **Search** (if implemented in UI):
   - Search by title/author
   - Full-text search within books

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: httpOnly cookies with 7-day expiration
- **Session Management**: Database-backed sessions
- **Permission System**: Fine-grained access control
- **First-User Admin**: First registrant becomes admin automatically

## 🔐 Permission System

### Roles

- **Admin**: Full access to everything + user management
- **User**: Can read all books, optional upload/delete
- **Guest**: Read-only access

### Permissions (configurable per user)

- **canUpload**: Can upload new books
- **canDelete**: Can delete books from library

## 🎨 Customization Options

The reader offers extensive customization:

- **Font Size**: SM, MD, LG, XL
- **Font Family**: Serif, Sans-serif, Monospace
- **Line Height**: Normal, Relaxed, Loose
- **Theme**: Light, Dark, System

## 📊 Database Management

### Prisma Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Apply migrations (production)
npm run prisma:deploy

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

### Backup Database

```bash
# SQLite database location
./data/db/sqlite.db

# Backup
cp ./data/db/sqlite.db ./data/db/sqlite.db.backup
```

## 🔍 Search (Meilisearch)

### Indexes

- **books**: Metadata search (title, author)
- **chapters**: Full-text search in book content

### API Endpoint

```http
GET /api/search?q=query&type=metadata|fulltext&limit=20
```

## 🗂️ File Storage

Books are stored on the filesystem:

```
/app/data/
  ├── db/
  │   └── sqlite.db          # SQLite database
  ├── books/
  │   ├── {bookId}/
  │   │   └── original.{ext} # Original uploaded file
  │   └── ...
  └── meili_data/            # Meilisearch index data
```

## 🔄 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Books

- `GET /api/books` - List all books
- `POST /api/books/upload` - Upload book (requires permission)
- `GET /api/books/[id]` - Get book with chapters
- `DELETE /api/books/[id]` - Delete book (requires permission)
- `PUT /api/books/[id]` - Update metadata (admin only)

### Progress

- `GET /api/books/[id]/progress` - Get reading progress
- `PUT /api/books/[id]/progress` - Update progress

### Admin

- `GET /api/admin/users` - List all users (admin only)
- `PUT /api/admin/users/[id]/permissions` - Update permissions (admin only)

### Search

- `GET /api/search` - Search books and content

## 🚧 Known Limitations

- Maximum file size: 50MB
- SQLite database (suitable for small-to-medium deployments)
- No DRM support (intentional)
- Server-side processing may be slow for very large PDFs

## 🛠️ Troubleshooting

### Meilisearch Connection Issues

```bash
# Check Meilisearch logs
docker logs <meilisearch-container>

# Verify connection
curl http://localhost:7700/health
```

### Database Issues

```bash
# Reset database (⚠️ deletes all data)
rm ./data/db/sqlite.db
npm run prisma:migrate

# View database
npm run prisma:studio
```

### Permission Errors

```bash
# Ensure data directory is writable
chmod -R 755 ./data
```

## 📝 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | SQLite database path | `file:./data/db/sqlite.db` | Yes |
| `JWT_SECRET` | Secret key for JWT signing | - | Yes |
| `MEILISEARCH_HOST` | Meilisearch server URL | `http://localhost:7700` | Yes |
| `MEILISEARCH_KEY` | Meilisearch API key | - | Yes |
| `BOOKS_STORAGE_PATH` | Path to store uploaded books | `./data/books` | Yes |
| `NODE_ENV` | Environment (development/production) | `development` | No |
| `ORIGIN` | App public URL | `http://localhost:3000` | Yes (prod) |

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - Feel free to use this project for any purpose.

## 🙏 Acknowledgments

Built with:
- Svelte 5 & SvelteKit 2
- Prisma
- Meilisearch
- Tailwind CSS
- EPUB.js, PDF.js, markdown-it

---

**Built for sharing the joy of reading 📚**
