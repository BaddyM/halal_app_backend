CREATE TABLE `PaymentOrder` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `itemType` VARCHAR(24) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(16) NOT NULL DEFAULT 'pesapal',
  `merchantReference` VARCHAR(64) NOT NULL,
  `orderTrackingId` VARCHAR(128) NULL,
  `redirectUrl` TEXT NULL,
  `amountCents` INTEGER NOT NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'UGX',
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `providerStatus` VARCHAR(64) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PaymentOrder_merchantReference_key`(`merchantReference`),
  UNIQUE INDEX `PaymentOrder_orderTrackingId_key`(`orderTrackingId`),
  INDEX `PaymentOrder_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PaymentOrder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;