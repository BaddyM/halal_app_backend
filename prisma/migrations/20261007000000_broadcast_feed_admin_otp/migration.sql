CREATE TABLE `BroadcastRecipient` (
  `id` VARCHAR(191) NOT NULL,
  `broadcastId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BroadcastRecipient_broadcastId_userId_key` (`broadcastId`, `userId`),
  INDEX `BroadcastRecipient_userId_createdAt_idx` (`userId`, `createdAt`),
  CONSTRAINT `BroadcastRecipient_broadcastId_fkey` FOREIGN KEY (`broadcastId`) REFERENCES `Broadcast` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BroadcastRecipient_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AdminLoginChallenge` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `codeHash` VARCHAR(191) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AdminLoginChallenge_userId_expiresAt_idx` (`userId`, `expiresAt`),
  INDEX `AdminLoginChallenge_expiresAt_usedAt_idx` (`expiresAt`, `usedAt`),
  CONSTRAINT `AdminLoginChallenge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
