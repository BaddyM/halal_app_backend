ALTER TABLE `User`
    ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `loginLockedUntil` DATETIME(3) NULL;
