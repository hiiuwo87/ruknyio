-- CreateTable
CREATE TABLE "instagram_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3),
    "igUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "profilePicUrl" TEXT,
    "followersCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_blocks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_grid_links" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "linkUrl" TEXT,
    "linkTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_grid_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_connections_userId_key" ON "instagram_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_grid_links_blockId_mediaId_key" ON "instagram_grid_links"("blockId", "mediaId");

-- AddForeignKey
ALTER TABLE "instagram_connections" ADD CONSTRAINT "instagram_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_blocks" ADD CONSTRAINT "instagram_blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_grid_links" ADD CONSTRAINT "instagram_grid_links_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "instagram_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
