-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_book_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "currentChapterId" TEXT,
    "progress" REAL NOT NULL DEFAULT 0,
    "scrollPosition" REAL NOT NULL DEFAULT 0,
    "lastRead" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_book_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_book_progress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_book_progress_currentChapterId_fkey" FOREIGN KEY ("currentChapterId") REFERENCES "chapters" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_user_book_progress" ("bookId", "currentChapterId", "id", "lastRead", "progress", "updatedAt", "userId") SELECT "bookId", "currentChapterId", "id", "lastRead", "progress", "updatedAt", "userId" FROM "user_book_progress";
DROP TABLE "user_book_progress";
ALTER TABLE "new_user_book_progress" RENAME TO "user_book_progress";
CREATE INDEX "user_book_progress_userId_idx" ON "user_book_progress"("userId");
CREATE INDEX "user_book_progress_bookId_idx" ON "user_book_progress"("bookId");
CREATE UNIQUE INDEX "user_book_progress_userId_bookId_key" ON "user_book_progress"("userId", "bookId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
