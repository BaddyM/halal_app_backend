CREATE TABLE `ContactAccessRequest` (
    `id` VARCHAR(191) NOT NULL,
    `requesterId` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'approved', 'declined', 'revoked') NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decidedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ContactAccessRequest_requesterId_recipientId_key` (`requesterId`, `recipientId`),
    INDEX `ContactAccessRequest_recipientId_status_createdAt_idx` (`recipientId`, `status`, `createdAt`),
    INDEX `ContactAccessRequest_requesterId_status_createdAt_idx` (`requesterId`, `status`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ContactAccessRequest_requesterId_fkey`
        FOREIGN KEY (`requesterId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ContactAccessRequest_recipientId_fkey`
        FOREIGN KEY (`recipientId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
