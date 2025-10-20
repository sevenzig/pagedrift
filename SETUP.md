# Setup Guide - PageDrift

This guide will help you get PageDrift running from scratch.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 22+** installed
- **Docker** (for Meilisearch and production deployment)
- **Git** (optional, for version control)

## Local Development Setup

### Step 1: Install Dependencies

```bash
cd pagedrift/pagedrift
npm install
```

This installs all required packages including:
- SvelteKit and Svelte 5
- Prisma (database ORM)
- Meilisearch client
- Authentication libraries
- PDF/EPUB parsers

### Step 2: Configure Environment

The `.env` file is already created with development defaults. Review and adjust if needed:

```bash
# Review current configuration
cat .env
```

#### Key Environment Variables

The following variables control your application's configuration:

- **DATABASE_URL**: SQLite database location
  - Default: `file:./data/db/sqlite.db`
  - For production, consider PostgreSQL or MySQL

- **JWT_SECRET**: Used for signing authentication tokens
  - **CRITICAL**: Must be changed for production
  - Should be a long, random string

- **MEILISEARCH_HOST**: Search server endpoint
  - Default: `http://localhost:7700`
  - Change if Meilisearch runs on different host/port

- **MEILISEARCH_MASTER_KEY**: Admin key for Meilisearch
  - **CRITICAL**: Must be set for production

- **BOOKS_STORAGE_PATH**: Directory for uploaded book files
  - Default: `./data/books`

#### Generate Secure Secrets

For production deployment, generate cryptographically secure random secrets:

```bash
# Generate JWT_SECRET (256-bit key)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate MEILISEARCH_MASTER_KEY (256-bit key)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use base64 encoding for URL-safe keys
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Update your `.env` file with the generated values:**

```bash
# Open .env in your editor
nano .env  # or: vim .env, code .env, etc.

# Replace these lines with your generated secrets:
JWT_SECRET=your_generated_jwt_secret_here
MEILISEARCH_MASTER_KEY=your_generated_meilisearch_key_here
```

#### Production Configuration Checklist

Before deploying to production, ensure:

- [ ] `JWT_SECRET` is changed from default
- [ ] `MEILISEARCH_MASTER_KEY` is set and secure
- [ ] `DATABASE_URL` points to production database
- [ ] `BOOKS_STORAGE_PATH` has proper permissions
- [ ] All secrets are stored securely (not in version control)
- [ ] `.env` file has restricted permissions: `chmod 600 .env`

#### Alternative: Using OpenSSL

If Node.js is not available, use OpenSSL to generate secrets:

```bash
# Generate 256-bit hex key
openssl rand -hex 32

# Generate 256-bit base64 key
openssl rand -base64 32
```

#### Environment-Specific Configurations

You can create separate environment files:

```bash
# Development
.env.development

# Production
.env.production

# Testing
.env.test
```

Load the appropriate file based on your deployment environment.

### Step 3: Set Up Database

Generate Prisma client and create database:

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations to create database schema
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

This creates:
- `./data/db/sqlite.db` - SQLite database file
- Tables: users, books, chapters, user_book_progress, sessions

### Step 4: Start Meilisearch

In a separate terminal, start Meilisearch:

**For Windows PowerShell:**
```powershell
docker run -d -p 7700:7700 -e MEILI_MASTER_KEY="dev-master-key" --name meilisearch getmeili/meilisearch:v1.6
```

**For Windows Command Prompt:**
```cmd
docker run -d -p 7700:7700 -e MEILI_MASTER_KEY="dev-master-key" --name meilisearch getmeili/meilisearch:v1.6
```

**For Unix/Linux/macOS:**
```bash
docker run -d -p 7700:7700 \
  -e MEILI_MASTER_KEY="dev-master-key" \
  --name meilisearch \
  getmeili/meilisearch:v1.6
```

Or if you have docker-compose:

```bash
docker-compose up -d meilisearch
```

Verify Meilisearch is running:

```bash
curl http://localhost:7700/health
# Should return: {"status":"available"}
```

### Step 5: Start Development Server

```bash
npm run dev
```

The application will start at `http://localhost:5173`

### Step 6: Create First User (Admin)

1. Open `http://localhost:5173` in your browser
2. You'll be redirected to `/login`
3. Click "Register"
4. Create your account

**Important**: The first user to register automatically becomes an admin with full permissions!

### Step 7: Test Upload

1. Go to the library (you should already be there after registering)
2. Click "Upload Book"
3. Drag and drop an EPUB, MOBI, or PDF file
4. Wait for processing
5. Click "Read" to open the book

## Docker Development Setup

If you prefer to run everything in Docker:

### Step 1: Start All Services

```bash
docker-compose up -d
```

This starts:
- **app**: SvelteKit application
- **meilisearch**: Search engine

### Step 2: View Logs

```bash
# View all logs
docker-compose logs -f

# View only app logs
docker-compose logs -f app

# View only Meilisearch logs
docker-compose logs -f meilisearch
```

### Step 3: Access Application

Open `http://localhost:3000` (note: port 3000 in Docker, not 5173)

### Step 4: Stop Services

```bash
docker-compose down
```

## First Time Configuration

### Create Admin Account

1. Navigate to `/register`
2. Enter email and password (minimum 8 characters)
3. Submit
4. You're now logged in as admin!

### Admin Dashboard

As admin, you can:

1. Go to `/admin` (click "Manage Users" in header)
2. View all registered users
3. Change user roles:
   - **Admin**: Full access + user management
   - **User**: Standard user
   - **Guest**: Read-only
4. Grant permissions:
   - **Can Upload**: Allow user to upload books
   - **Can Delete**: Allow user to delete books

### Invite Other Users

1. Share registration link: `https://your-domain.com/register`
2. Users register themselves
3. Manage their permissions in admin dashboard

## Directory Structure

After setup, your directory structure looks like:

```
pagedrift/pagedrift/
├── .env                    # Environment variables
├── docker-compose.yml      # Docker configuration
├── Dockerfile             # App container definition
├── package.json           # Dependencies
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── src/
│   ├── lib/
│   │   ├── components/    # UI components
│   │   ├── server/        # Server-side code
│   │   │   ├── auth/      # Authentication
│   │   │   ├── db/        # Database queries
│   │   │   ├── parsers/   # Book parsers
│   │   │   └── search/    # Meilisearch integration
│   │   └── stores/        # Client state management
│   ├── routes/
│   │   ├── (auth)/        # Protected routes
│   │   ├── (public)/      # Public routes (login/register)
│   │   └── api/           # API endpoints
│   ├── app.css           # Global styles
│   ├── app.d.ts          # TypeScript definitions
│   └── hooks.server.ts   # Server hooks
└── data/                  # Created on first run
    ├── db/               # SQLite database
    ├── books/            # Uploaded book files
    └── meili_data/       # Meilisearch index
```

## Common Setup Issues

### Issue: "Cannot find module '@prisma/client'"

**Solution**:
```bash
npm run prisma:generate
```

### Issue: Meilisearch connection failed

**Solution**:
1. Check Meilisearch is running: `curl http://localhost:7700/health`
2. Check `MEILISEARCH_HOST` in `.env`
3. Restart Meilisearch: `docker restart meilisearch`

### Issue: Database locked

**Solution**:
```bash
# Stop dev server
# Delete database and recreate
rm ./data/db/sqlite.db
npm run prisma:migrate
```

### Issue: Permission denied on ./data

**Solution**:
```bash
chmod -R 755 ./data
```

### Issue: Port already in use

**Solution**:
```bash
# For dev server (5173)
lsof -ti:5173 | xargs kill

# For Docker (3000)
lsof -ti:3000 | xargs kill

# Or change port in vite.config.ts or docker-compose.yml
```

## Next Steps

After setup:

1. **Customize Settings**: Adjust reading preferences in the reader
2. **Upload Books**: Add your EPUB, MOBI, or PDF files
3. **Test Search**: Try searching for books by title or content
4. **Invite Users**: Share the platform with family/friends
5. **Set Up Backups**: See DEPLOYMENT.md for backup strategies

## Development Workflow

### Making Changes

1. Edit source files in `src/`
2. Dev server auto-reloads
3. Check console for errors
4. Test changes in browser

### Database Changes

1. Edit `prisma/schema.prisma`
2. Create migration: `npm run prisma:migrate`
3. Apply to database: `npx prisma generate`

### Adding Features

1. Create new components in `src/lib/components/`
2. Add API routes in `src/routes/api/`
3. Update types in `src/lib/types.ts`

## Testing

### Manual Testing Checklist

- [ ] Register new user
- [ ] Login/logout
- [ ] Upload EPUB file
- [ ] Upload PDF file
- [ ] Upload MOBI file
- [ ] Read book
- [ ] Navigate chapters
- [ ] Change reading settings
- [ ] Search for books (metadata)
- [ ] Search within books (full-text)
- [ ] Delete book (if permitted)
- [ ] Admin: view users
- [ ] Admin: change permissions

### Test Data

Use public domain books for testing:
- **Project Gutenberg**: https://www.gutenberg.org/
- **Standard Ebooks**: https://standardebooks.org/
- **Internet Archive**: https://archive.org/

## Getting Help

- **Documentation**: See README.md
- **Deployment**: See DEPLOYMENT.md
- **API Reference**: Check README.md API section
- **Troubleshooting**: See DEPLOYMENT.md troubleshooting section

## Ready for Production?

Once everything works locally, see DEPLOYMENT.md for:
- Production deployment to Dokploy
- Security hardening
- Backup strategies
- Monitoring setup

---

**Happy developing! 📚✨**

