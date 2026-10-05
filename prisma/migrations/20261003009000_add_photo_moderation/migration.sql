ALTER TABLE `Photo`
  ADD COLUMN `moderationStatus` VARCHAR(16) NOT NULL DEFAULT 'approved',
  ADD COLUMN `moderationReason` VARCHAR(1000) NULL,
  ADD COLUMN `flags` JSON NULL;