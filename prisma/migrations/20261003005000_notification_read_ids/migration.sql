CREATE TABLE `NotificationRead` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `notificationId` VARCHAR(191) NOT NULL,
  `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `NotificationRead_userId_notificationId_key` (`userId`, `notificationId`),
  INDEX `NotificationRead_userId_readAt_idx` (`userId`, `readAt`),
  CONSTRAINT `NotificationRead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
