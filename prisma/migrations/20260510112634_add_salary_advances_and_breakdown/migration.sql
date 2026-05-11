-- AlterTable
ALTER TABLE `Salary` ADD COLUMN `advanceDeducted` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `allowances` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `deductions` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `netPay` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `paidAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `SalaryAdvance` (
    `id` VARCHAR(191) NOT NULL,
    `staffId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `reason` LONGTEXT NULL,
    `status` ENUM('PENDING', 'REPAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `repaidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SalaryAdvance_staffId_idx`(`staffId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SalaryAdvance` ADD CONSTRAINT `SalaryAdvance_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `Staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
