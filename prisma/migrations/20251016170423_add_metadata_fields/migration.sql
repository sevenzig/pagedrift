-- AlterTable
ALTER TABLE "books" ADD COLUMN "description" TEXT;
ALTER TABLE "books" ADD COLUMN "fileSize" INTEGER;
ALTER TABLE "books" ADD COLUMN "isbn" TEXT;
ALTER TABLE "books" ADD COLUMN "language" TEXT;
ALTER TABLE "books" ADD COLUMN "normalizedAuthor" TEXT;
ALTER TABLE "books" ADD COLUMN "normalizedTitle" TEXT;
ALTER TABLE "books" ADD COLUMN "pageCount" INTEGER;
ALTER TABLE "books" ADD COLUMN "publicationYear" INTEGER;
ALTER TABLE "books" ADD COLUMN "publisher" TEXT;
ALTER TABLE "books" ADD COLUMN "subjects" TEXT;

-- CreateIndex
CREATE INDEX "books_normalizedAuthor_idx" ON "books"("normalizedAuthor");

-- CreateIndex
CREATE INDEX "books_publicationYear_idx" ON "books"("publicationYear");

-- CreateIndex
CREATE INDEX "books_isbn_idx" ON "books"("isbn");
