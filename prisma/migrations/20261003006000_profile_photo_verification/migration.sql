CREATE TABLE `ProfilePhotoVerification` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `status` ENUM('notSubmitted', 'pending', 'verified', 'rejected', 'resubmissionRequired') NOT NULL DEFAULT 'pending',
  `submission` JSON NOT NULL,
  `reason` TEXT NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ProfilePhotoVerification_userId_key` (`userId`),
  INDEX `ProfilePhotoVerification_status_createdAt_idx` (`status`, `createdAt`),
  CONSTRAINT `ProfilePhotoVerification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
