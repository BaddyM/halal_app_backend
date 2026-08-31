-- Add dashboard-configurable like allowances to subscription plans.
ALTER TABLE `Plan`
  ADD COLUMN `likesLimit` INTEGER NULL,
  ADD COLUMN `likesPeriod` VARCHAR(16) NOT NULL DEFAULT 'day';

-- Existing Basic plans retain the product rule of five lifetime likes.
UPDATE `Plan`
SET `likesLimit` = 5,
    `likesPeriod` = 'lifetime'
WHERE `tier` = 'basic' AND `likesLimit` IS NULL;
