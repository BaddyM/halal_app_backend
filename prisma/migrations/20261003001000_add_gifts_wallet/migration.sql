ALTER TABLE `PaymentOrder` ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1;

CREATE TABLE `GiftCatalogItem` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `image` TEXT NULL,
  `price` INTEGER NOT NULL,
  `cashValue` INTEGER NOT NULL DEFAULT 0,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'UGX',
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `GiftCatalogItem_enabled_sortOrder_idx` (`enabled`, `sortOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GiftInventory` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `giftId` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `GiftInventory_userId_giftId_key` (`userId`, `giftId`), INDEX `GiftInventory_userId_idx` (`userId`),
  CONSTRAINT `GiftInventory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `GiftInventory_giftId_fkey` FOREIGN KEY (`giftId`) REFERENCES `GiftCatalogItem` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GiftSent` (
  `id` VARCHAR(191) NOT NULL,
  `giftId` VARCHAR(191) NOT NULL,
  `senderId` VARCHAR(191) NOT NULL,
  `recipientId` VARCHAR(191) NOT NULL,
  `message` VARCHAR(500) NULL,
  `cashValue` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), INDEX `GiftSent_recipientId_createdAt_idx` (`recipientId`, `createdAt`), INDEX `GiftSent_senderId_createdAt_idx` (`senderId`, `createdAt`),
  CONSTRAINT `GiftSent_giftId_fkey` FOREIGN KEY (`giftId`) REFERENCES `GiftCatalogItem` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `GiftSent_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `GiftSent_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WalletAccount` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `balance` INTEGER NOT NULL DEFAULT 0,
  `pendingBalance` INTEGER NOT NULL DEFAULT 0,
  `lifetime` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `WalletAccount_userId_key` (`userId`),
  CONSTRAINT `WalletAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WalletTransaction` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(24) NOT NULL,
  `amount` INTEGER NOT NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'UGX',
  `reference` VARCHAR(191) NULL,
  `description` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `WalletTransaction_reference_key` (`reference`), INDEX `WalletTransaction_userId_createdAt_idx` (`userId`, `createdAt`),
  CONSTRAINT `WalletTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WithdrawalRequest` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `pendingUserId` VARCHAR(191) NULL,
  `amount` INTEGER NOT NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'UGX',
  `method` VARCHAR(24) NOT NULL,
  `details` JSON NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `reference` VARCHAR(191) NULL,
  `reason` VARCHAR(1000) NULL,
  `reviewedBy` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `WithdrawalRequest_pendingUserId_key` (`pendingUserId`), INDEX `WithdrawalRequest_status_createdAt_idx` (`status`, `createdAt`), INDEX `WithdrawalRequest_userId_createdAt_idx` (`userId`, `createdAt`),
  CONSTRAINT `WithdrawalRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;