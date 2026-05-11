-- AlterTable
ALTER TABLE `CreditSale` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `creditLimit` DOUBLE NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `CreditSale_customerId_idx` ON `CreditSale`(`customerId`);

-- AddForeignKey
ALTER TABLE `CreditSale` ADD CONSTRAINT `CreditSale_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
