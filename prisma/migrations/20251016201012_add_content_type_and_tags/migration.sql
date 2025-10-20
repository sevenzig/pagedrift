-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "book_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "book_tags_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "book_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_books" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "format" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'Book',
    "status" TEXT NOT NULL DEFAULT 'published',
    "uploadedById" TEXT NOT NULL,
    "uploadDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT NOT NULL,
    "coverImage" TEXT,
    "markdown" TEXT NOT NULL,
    "isbn" TEXT,
    "publisher" TEXT,
    "publicationYear" INTEGER,
    "language" TEXT,
    "description" TEXT,
    "subjects" TEXT,
    "pageCount" INTEGER,
    "fileSize" INTEGER,
    "normalizedAuthor" TEXT,
    "normalizedTitle" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "books_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_books" ("author", "coverImage", "description", "filePath", "fileSize", "format", "id", "isbn", "language", "markdown", "normalizedAuthor", "normalizedTitle", "pageCount", "publicationYear", "publisher", "subjects", "title", "updatedAt", "uploadDate", "uploadedById") SELECT "author", "coverImage", "description", "filePath", "fileSize", "format", "id", "isbn", "language", "markdown", "normalizedAuthor", "normalizedTitle", "pageCount", "publicationYear", "publisher", "subjects", "title", "updatedAt", "uploadDate", "uploadedById" FROM "books";
DROP TABLE "books";
ALTER TABLE "new_books" RENAME TO "books";
CREATE INDEX "books_uploadedById_idx" ON "books"("uploadedById");
CREATE INDEX "books_normalizedAuthor_idx" ON "books"("normalizedAuthor");
CREATE INDEX "books_publicationYear_idx" ON "books"("publicationYear");
CREATE INDEX "books_isbn_idx" ON "books"("isbn");
CREATE INDEX "books_contentType_idx" ON "books"("contentType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "book_tags_bookId_idx" ON "book_tags"("bookId");

-- CreateIndex
CREATE INDEX "book_tags_tagId_idx" ON "book_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "book_tags_bookId_tagId_key" ON "book_tags"("bookId", "tagId");
