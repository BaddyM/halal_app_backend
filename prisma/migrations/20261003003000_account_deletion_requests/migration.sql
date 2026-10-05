CREATE TABLE `AccountDeletionRequest` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(2000) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `reviewedBy` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AccountDeletionRequest_userId_key` (`userId`),
  INDEX `AccountDeletionRequest_status_createdAt_idx` (`status`, `createdAt`),
  CONSTRAINT `AccountDeletionRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
