-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('admin', 'cashier', 'office', 'sales_rep', 'production') NOT NULL;
