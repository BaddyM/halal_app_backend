CREATE TABLE `JourneyStep` (
	`id` VARCHAR(191) NOT NULL,
	`userId` VARCHAR(191) NOT NULL,
	`stepKey` VARCHAR(48) NOT NULL,
	`title` VARCHAR(120) NOT NULL,
	`description` VARCHAR(500) NOT NULL,
	`completed` BOOLEAN NOT NULL DEFAULT false,
	`completedAt` DATETIME(3) NULL,
	`position` INTEGER NOT NULL DEFAULT 0,
	`createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` DATETIME(3) NOT NULL,
	UNIQUE INDEX `JourneyStep_userId_stepKey_key`(`userId`, `stepKey`),
	INDEX `JourneyStep_userId_position_idx`(`userId`, `position`),
	PRIMARY KEY (`id`),
	CONSTRAINT `JourneyStep_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;