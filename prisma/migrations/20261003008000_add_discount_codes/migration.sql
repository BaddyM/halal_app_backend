ALTER TABLE `PaymentOrder`
  ADD COLUMN `subtotalAmountCents` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `discountAmountCents` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `discountCodeId` VARCHAR(191) NULL;

CREATE TABLE `DiscountCode` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(48) NOT NULL,
  `type` VARCHAR(16) NOT NULL DEFAULT 'percent',
  `value` INTEGER NOT NULL,
  `appliesTo` VARCHAR(48) NOT NULL DEFAULT 'all',
  `usageLimit` INTEGER NULL,
  `usedCount` INTEGER NOT NULL DEFAULT 0,
  `reservedCount` INTEGER NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `DiscountCode_code_key`(`code`),
  INDEX `DiscountCode_active_expiresAt_idx`(`active`, `expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DiscountReservation` (
  `id` VARCHAR(191) NOT NULL,
  `codeId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'reserved',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `DiscountReservation_orderId_key`(`orderId`),
  INDEX `DiscountReservation_codeId_status_idx`(`codeId`, `status`),
  INDEX `DiscountReservation_userId_createdAt_idx`(`userId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `DiscountReservation_codeId_fkey` FOREIGN KEY (`codeId`) REFERENCES `DiscountCode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DiscountReservation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DiscountReservation_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `PaymentOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;