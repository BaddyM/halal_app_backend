ALTER TABLE `PhotoAccessRequest` ADD COLUMN `expiresAt` DATETIME(3) NULL;

CREATE TABLE `PhotoAccessAudit` (
  `id` VARCHAR(191) NOT NULL,
  `requesterId` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `photoId` VARCHAR(191) NULL,
  `action` VARCHAR(24) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PhotoAccessAudit_ownerId_createdAt_idx` (`ownerId`, `createdAt`),
  INDEX `PhotoAccessAudit_requesterId_createdAt_idx` (`requesterId`, `createdAt`),
  INDEX `PhotoAccessAudit_photoId_createdAt_idx` (`photoId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
