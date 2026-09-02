-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    `isPhoneVerified` BOOLEAN NOT NULL DEFAULT false,
    `phoneVerificationStatus` ENUM('notSubmitted', 'pending', 'verified', 'rejected', 'resubmissionRequired') NOT NULL DEFAULT 'notSubmitted',
    `phoneVerificationReason` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    `status` ENUM('active', 'pending', 'suspended', 'banned') NOT NULL DEFAULT 'active',
    `googleId` VARCHAR(191) NULL,
    `appleId` VARCHAR(191) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `plan` ENUM('basic', 'premium', 'vip') NOT NULL DEFAULT 'basic',
    `planExpiresAt` DATETIME(3) NULL,
    `prayerTimesEnabled` BOOLEAN NOT NULL DEFAULT true,
    `halalVerificationSubmitted` BOOLEAN NOT NULL DEFAULT false,
    `readReceiptsEnabled` BOOLEAN NOT NULL DEFAULT true,
    `showOnlineStatus` BOOLEAN NOT NULL DEFAULT true,
    `showLastSeen` BOOLEAN NOT NULL DEFAULT false,
    `showDistance` BOOLEAN NOT NULL DEFAULT true,
    `incognitoMode` BOOLEAN NOT NULL DEFAULT false,
    `profileVisibility` VARCHAR(191) NOT NULL DEFAULT 'everyone',
    `likesUsedToday` INTEGER NOT NULL DEFAULT 0,
    `activeChatsCount` INTEGER NOT NULL DEFAULT 0,
    `lastLikeReset` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notificationsReadAt` DATETIME(3) NULL,
    `conversationRemindersEnabled` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_googleId_key`(`googleId`),
    UNIQUE INDEX `User_appleId_key`(`appleId`),
    INDEX `User_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Profile` (
    `userId` VARCHAR(191) NOT NULL,
    `gender` ENUM('male', 'female') NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `profession` VARCHAR(191) NULL,
    `bio` TEXT NULL,
    `primaryImageUrl` VARCHAR(191) NULL,
    `prayerFrequency` ENUM('fiveTimes', 'mostPrayers', 'jumuahOnly', 'workingOnIt', 'sometimes', 'rarely', 'preferNotToSay') NULL,
    `sect` ENUM('sunni', 'shia', 'sufi', 'other', 'preferNotToSay') NULL,
    `hijabPreference` ENUM('hijab', 'niqab', 'notApplicable', 'preferNotToSay') NULL,
    `ethnicity` VARCHAR(191) NULL,
    `maritalTimeline` ENUM('asap', 'withinYear', 'oneToTwoYears', 'openTimeline') NULL,
    `childrenPref` ENUM('noWantThem', 'noOpenToIt', 'haveWantMore', 'haveNoMore', 'preferNotToSay') NULL,
    `locationPref` ENUM('sameCity', 'sameCountry', 'anywhere', 'countryOrAbroad') NULL,
    `values` JSON NULL,
    `interests` JSON NULL,
    `socialLinks` JSON NULL,
    `waliName` VARCHAR(191) NULL,
    `waliEmail` VARCHAR(191) NULL,
    `waliPhone` VARCHAR(191) NULL,
    `waliRelation` VARCHAR(191) NULL,
    `hasBeard` BOOLEAN NULL,
    `prefersBeard` BOOLEAN NULL,
    `prefersHijab` BOOLEAN NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `isComplete` BOOLEAN NOT NULL DEFAULT false,
    `completeness` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Profile_gender_country_city_idx`(`gender`, `country`, `city`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OnboardingAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `answer` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OnboardingAnswer_userId_idx`(`userId`),
    UNIQUE INDEX `OnboardingAnswer_userId_questionId_key`(`userId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IdentityVerification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('notSubmitted', 'pending', 'verified', 'rejected', 'resubmissionRequired') NOT NULL DEFAULT 'notSubmitted',
    `reason` TEXT NULL,
    `submission` JSON NOT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `IdentityVerification_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationAudit` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `previousStatus` ENUM('notSubmitted', 'pending', 'verified', 'rejected', 'resubmissionRequired') NOT NULL,
    `newStatus` ENUM('notSubmitted', 'pending', 'verified', 'rejected', 'resubmissionRequired') NOT NULL,
    `reason` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VerificationAudit_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Photo` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `isPrivate` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Photo_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhotoAccessRequest` (
    `id` VARCHAR(191) NOT NULL,
    `requesterId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PhotoAccessRequest_ownerId_idx`(`ownerId`),
    INDEX `PhotoAccessRequest_requesterId_idx`(`requesterId`),
    UNIQUE INDEX `PhotoAccessRequest_requesterId_ownerId_key`(`requesterId`, `ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Like` (
    `id` VARCHAR(191) NOT NULL,
    `fromUserId` VARCHAR(191) NOT NULL,
    `toUserId` VARCHAR(191) NOT NULL,
    `type` ENUM('like', 'superLike', 'pass') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Like_toUserId_idx`(`toUserId`),
    UNIQUE INDEX `Like_fromUserId_toUserId_key`(`fromUserId`, `toUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Match` (
    `id` VARCHAR(191) NOT NULL,
    `userAId` VARCHAR(191) NOT NULL,
    `userBId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Match_userAId_idx`(`userAId`),
    INDEX `Match_userBId_idx`(`userBId`),
    UNIQUE INDEX `Match_userAId_userBId_key`(`userAId`, `userBId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `userAId` VARCHAR(191) NOT NULL,
    `userBId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastMessageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastReminderAt` DATETIME(3) NULL,
    `waliInvolved` BOOLEAN NOT NULL DEFAULT false,
    `waliInvolvedAt` DATETIME(3) NULL,

    INDEX `Conversation_userAId_idx`(`userAId`),
    INDEX `Conversation_userBId_idx`(`userBId`),
    INDEX `Conversation_lastMessageAt_idx`(`lastMessageAt`),
    UNIQUE INDEX `Conversation_userAId_userBId_key`(`userAId`, `userBId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `type` VARCHAR(16) NOT NULL DEFAULT 'text',
    `mediaUrl` VARCHAR(191) NULL,
    `flagged` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `readAt` DATETIME(3) NULL,

    INDEX `Message_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `Message_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `RefreshToken_token_key`(`token`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerificationToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(6) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailVerificationToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(6) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PasswordResetToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhoneVerificationToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `code` VARCHAR(6) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PhoneVerificationToken_userId_idx`(`userId`),
    INDEX `PhoneVerificationToken_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Block` (
    `id` VARCHAR(191) NOT NULL,
    `blockerId` VARCHAR(191) NOT NULL,
    `blockedId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Block_blockerId_idx`(`blockerId`),
    INDEX `Block_blockedId_idx`(`blockedId`),
    UNIQUE INDEX `Block_blockerId_blockedId_key`(`blockerId`, `blockedId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Report` (
    `id` VARCHAR(191) NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `reportedId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `details` TEXT NULL,
    `category` VARCHAR(64) NULL,
    `severity` VARCHAR(16) NOT NULL DEFAULT 'low',
    `status` VARCHAR(32) NOT NULL DEFAULT 'open',
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Report_reportedId_idx`(`reportedId`),
    INDEX `Report_reporterId_idx`(`reporterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(191) NOT NULL,
    `tier` ENUM('basic', 'premium', 'vip') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `priceCents` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'USD',
    `interval` VARCHAR(16) NOT NULL DEFAULT 'month',
    `features` JSON NULL,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `stripePriceId` VARCHAR(191) NULL,
    `appleProductId` VARCHAR(191) NULL,
    `googleProductId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Plan_visible_sortOrder_idx`(`visible`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(16) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'active',
    `externalId` VARCHAR(191) NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_userId_key`(`userId`),
    INDEX `Subscription_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NULL,
    `provider` VARCHAR(16) NOT NULL,
    `amountCents` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'USD',
    `status` VARCHAR(16) NOT NULL DEFAULT 'succeeded',
    `externalId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Transaction_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Device` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `platform` ENUM('ios', 'android', 'web') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Device_token_key`(`token`),
    INDEX `Device_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ad` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `imageUrl` TEXT NULL,
    `ctaText` VARCHAR(191) NULL,
    `targetUrl` VARCHAR(191) NULL,
    `placement` ENUM('HOME_BANNER', 'BETWEEN_MATCHES', 'CHAT_TOP', 'PROFILE_SIDEBAR') NOT NULL,
    `audience` ENUM('ALL', 'FREE', 'PREMIUM') NOT NULL DEFAULT 'ALL',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Ad_placement_isActive_idx`(`placement`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InboxMessage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fromAdmin` BOOLEAN NOT NULL DEFAULT true,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InboxMessage_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `InboxMessage_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportTicket` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `guestName` VARCHAR(191) NULL,
    `guestEmail` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupportTicket_userId_status_updatedAt_idx`(`userId`, `status`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportTicketMessage` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `fromAdmin` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupportTicketMessage_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountDeletionRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `status` ENUM('pending', 'confirmed', 'rejected') NOT NULL DEFAULT 'pending',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `scheduledPurgeAt` DATETIME(3) NULL,
    `handledAt` DATETIME(3) NULL,
    `handledById` VARCHAR(191) NULL,
    `handledNote` TEXT NULL,
    `hardDeleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `AccountDeletionRequest_status_requestedAt_idx`(`status`, `requestedAt`),
    INDEX `AccountDeletionRequest_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IslamicSetting` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `prayerTimesEnabled` BOOLEAN NOT NULL DEFAULT true,
    `qiblaEnabled` BOOLEAN NOT NULL DEFAULT true,
    `dailyContentEnabled` BOOLEAN NOT NULL DEFAULT true,
    `tasbihEnabled` BOOLEAN NOT NULL DEFAULT true,
    `ramadanMode` BOOLEAN NOT NULL DEFAULT false,
    `calcMethod` VARCHAR(16) NOT NULL DEFAULT 'MWL',
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NULL,
    `adminEmail` VARCHAR(191) NULL,
    `action` VARCHAR(255) NOT NULL,
    `target` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Broadcast` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `audience` VARCHAR(16) NOT NULL DEFAULT 'all',
    `reach` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Broadcast_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TasbihBadge` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `badgeType` ENUM('milestone', 'streak', 'consistency', 'special', 'achievement') NOT NULL,
    `threshold` INTEGER NULL,
    `streakDays` INTEGER NULL,
    `iconUrl` VARCHAR(191) NULL,
    `color` VARCHAR(7) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `requiresPremium` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TasbihBadge_name_key`(`name`),
    INDEX `TasbihBadge_badgeType_isActive_idx`(`badgeType`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TasbihSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `sessionDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `intention` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TasbihSession_userId_sessionDate_idx`(`userId`, `sessionDate`),
    INDEX `TasbihSession_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TasbihDaily` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `metGoal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TasbihDaily_userId_date_idx`(`userId`, `date`),
    UNIQUE INDEX `TasbihDaily_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TasbihStreak` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `currentStreak` INTEGER NOT NULL DEFAULT 0,
    `longestStreak` INTEGER NOT NULL DEFAULT 0,
    `graceDaysRemaining` INTEGER NOT NULL DEFAULT 2,
    `graceMonth` VARCHAR(191) NOT NULL DEFAULT '',
    `streakStartDate` DATETIME(3) NULL,
    `streakEndDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TasbihStreak_userId_idx`(`userId`),
    UNIQUE INDEX `TasbihStreak_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserBadge` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL,
    `earnedAt` DATETIME(3) NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(16) NOT NULL DEFAULT 'locked',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserBadge_userId_status_idx`(`userId`, `status`),
    INDEX `UserBadge_earnedAt_idx`(`earnedAt`),
    UNIQUE INDEX `UserBadge_userId_badgeId_key`(`userId`, `badgeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TasbihUserSettings` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `visibility` ENUM('private', 'matchesOnly', 'public') NOT NULL DEFAULT 'private',
    `dailyGoal` INTEGER NOT NULL DEFAULT 100,
    `notificationsEnabled` BOOLEAN NOT NULL DEFAULT true,
    `soundEnabled` BOOLEAN NOT NULL DEFAULT true,
    `hapticEnabled` BOOLEAN NOT NULL DEFAULT true,
    `lifetimeTotal` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TasbihUserSettings_userId_key`(`userId`),
    INDEX `TasbihUserSettings_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TasbihSettings` (
    `id` VARCHAR(191) NOT NULL,
    `badgesEnabled` BOOLEAN NOT NULL DEFAULT true,
    `streaksEnabled` BOOLEAN NOT NULL DEFAULT true,
    `leaderboardEnabled` BOOLEAN NOT NULL DEFAULT true,
    `dailyGoalEnabled` BOOLEAN NOT NULL DEFAULT true,
    `encouragementEnabled` BOOLEAN NOT NULL DEFAULT true,
    `defaultDailyGoal` INTEGER NOT NULL DEFAULT 100,
    `minStreakDays` INTEGER NOT NULL DEFAULT 7,
    `leaderboardScope` VARCHAR(32) NOT NULL DEFAULT 'global',
    `encouragementMessages` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TasbihLeaderboard` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(32) NOT NULL,
    `rank` INTEGER NOT NULL,
    `lifetimeCount` INTEGER NOT NULL,
    `currentStreak` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TasbihLeaderboard_scope_rank_idx`(`scope`, `rank`),
    INDEX `TasbihLeaderboard_updatedAt_idx`(`updatedAt`),
    UNIQUE INDEX `TasbihLeaderboard_userId_scope_key`(`userId`, `scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WaliLink` (
    `id` VARCHAR(191) NOT NULL,
    `waliId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `seeProfiles` BOOLEAN NOT NULL DEFAULT true,
    `seeChats` BOOLEAN NOT NULL DEFAULT false,
    `approveLikes` BOOLEAN NOT NULL DEFAULT false,
    `approveMatches` BOOLEAN NOT NULL DEFAULT false,
    `inviteSentAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WaliLink_userId_status_idx`(`userId`, `status`),
    INDEX `WaliLink_waliId_status_idx`(`waliId`, `status`),
    UNIQUE INDEX `WaliLink_waliId_userId_key`(`waliId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WaliDigest` (
    `id` VARCHAR(191) NOT NULL,
    `waliId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(32) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `newMatches` INTEGER NOT NULL DEFAULT 0,
    `newLikes` INTEGER NOT NULL DEFAULT 0,
    `newMessages` INTEGER NOT NULL DEFAULT 0,
    `usersLinked` INTEGER NOT NULL DEFAULT 0,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WaliDigest_waliId_period_startDate_key`(`waliId`, `period`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WaliApproval` (
    `id` VARCHAR(191) NOT NULL,
    `waliId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `actionType` VARCHAR(32) NOT NULL,
    `targetUserId` VARCHAR(191) NOT NULL,
    `actionDetails` JSON NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `WaliApproval_waliId_status_idx`(`waliId`, `status`),
    INDEX `WaliApproval_userId_actionType_idx`(`userId`, `actionType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HealthDisclosure` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `hasHealthMatter` BOOLEAN NULL,
    `disclosureType` ENUM('chronicCondition', 'physicalDisability', 'mentalHealth', 'reproductiveFertility', 'genetic', 'medicalTreatment', 'other', 'preferToExplainPrivately') NULL,
    `impactLevel` ENUM('notSignificantly', 'sometimes', 'significantly', 'preferNotToSay') NULL,
    `privateNotes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `completedAt` DATETIME(3) NULL,
    `lastUpdatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `flaggedAt` DATETIME(3) NULL,
    `flagReason` VARCHAR(191) NULL,

    UNIQUE INDEX `HealthDisclosure_userId_key`(`userId`),
    INDEX `HealthDisclosure_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HealthDisclosureAccess` (
    `id` VARCHAR(191) NOT NULL,
    `disclosureId` VARCHAR(191) NOT NULL,
    `requestingUserId` VARCHAR(191) NOT NULL,
    `ownerUserId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `grantedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HealthDisclosureAccess_disclosureId_status_idx`(`disclosureId`, `status`),
    INDEX `HealthDisclosureAccess_ownerUserId_idx`(`ownerUserId`),
    UNIQUE INDEX `HealthDisclosureAccess_disclosureId_requestingUserId_key`(`disclosureId`, `requestingUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarriageReadinessChecklist` (
    `id` VARCHAR(191) NOT NULL,
    `user1Id` VARCHAR(191) NOT NULL,
    `user2Id` VARCHAR(191) NOT NULL,
    `completedTopics` JSON NOT NULL,
    `reminderShownAt` DATETIME(3) NULL,
    `reminderDismissedAt` DATETIME(3) NULL,
    `engagementConfirmedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MarriageReadinessChecklist_user1Id_idx`(`user1Id`),
    INDEX `MarriageReadinessChecklist_user2Id_idx`(`user2Id`),
    UNIQUE INDEX `MarriageReadinessChecklist_user1Id_user2Id_key`(`user1Id`, `user2Id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationActivity` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('matched', 'weekMilestone', 'daysOfConversation', 'healthDiscussionMarked', 'nikahConversationSuggested', 'nikahAcceptedByOne', 'nikahAcceptedByBoth', 'customEvent') NOT NULL,
    `data` JSON NOT NULL,
    `viewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConversationActivity_conversationId_userId_idx`(`conversationId`, `userId`),
    INDEX `ConversationActivity_userId_viewedAt_idx`(`userId`, `viewedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptEligibility` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `partnerUserId` VARCHAR(191) NOT NULL,
    `promptType` ENUM('healthDisclosure', 'nikahProposal', 'customSuggestion') NOT NULL,
    `state` ENUM('notEligible', 'eligible', 'shown', 'dismissed', 'accepted', 'completed', 'expired') NOT NULL DEFAULT 'notEligible',
    `shownAt` DATETIME(3) NULL,
    `dismissedAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `cooldownUntil` DATETIME(3) NULL,
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PromptEligibility_userId_promptType_state_idx`(`userId`, `promptType`, `state`),
    INDEX `PromptEligibility_conversationId_idx`(`conversationId`),
    UNIQUE INDEX `PromptEligibility_userId_conversationId_promptType_key`(`userId`, `conversationId`, `promptType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NikahProposal` (
    `id` VARCHAR(191) NOT NULL,
    `initiatorId` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `status` ENUM('proposed', 'accepted', 'rejected', 'waiting') NOT NULL DEFAULT 'proposed',
    `acceptedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `bothAgreeAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NikahProposal_initiatorId_idx`(`initiatorId`),
    INDEX `NikahProposal_recipientId_idx`(`recipientId`),
    INDEX `NikahProposal_conversationId_idx`(`conversationId`),
    INDEX `NikahProposal_status_idx`(`status`),
    UNIQUE INDEX `NikahProposal_initiatorId_recipientId_conversationId_key`(`initiatorId`, `recipientId`, `conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingAnswer` ADD CONSTRAINT `OnboardingAnswer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IdentityVerification` ADD CONSTRAINT `IdentityVerification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Photo` ADD CONSTRAINT `Photo_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhotoAccessRequest` ADD CONSTRAINT `PhotoAccessRequest_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhotoAccessRequest` ADD CONSTRAINT `PhotoAccessRequest_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Like` ADD CONSTRAINT `Like_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Like` ADD CONSTRAINT `Like_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_userAId_fkey` FOREIGN KEY (`userAId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_userBId_fkey` FOREIGN KEY (`userBId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_userAId_fkey` FOREIGN KEY (`userAId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_userBId_fkey` FOREIGN KEY (`userBId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailVerificationToken` ADD CONSTRAINT `EmailVerificationToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhoneVerificationToken` ADD CONSTRAINT `PhoneVerificationToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Block` ADD CONSTRAINT `Block_blockerId_fkey` FOREIGN KEY (`blockerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Block` ADD CONSTRAINT `Block_blockedId_fkey` FOREIGN KEY (`blockedId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_reportedId_fkey` FOREIGN KEY (`reportedId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InboxMessage` ADD CONSTRAINT `InboxMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicketMessage` ADD CONSTRAINT `SupportTicketMessage_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountDeletionRequest` ADD CONSTRAINT `AccountDeletionRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TasbihSession` ADD CONSTRAINT `TasbihSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TasbihDaily` ADD CONSTRAINT `TasbihDaily_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TasbihStreak` ADD CONSTRAINT `TasbihStreak_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBadge` ADD CONSTRAINT `UserBadge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBadge` ADD CONSTRAINT `UserBadge_badgeId_fkey` FOREIGN KEY (`badgeId`) REFERENCES `TasbihBadge`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TasbihUserSettings` ADD CONSTRAINT `TasbihUserSettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaliLink` ADD CONSTRAINT `WaliLink_waliId_fkey` FOREIGN KEY (`waliId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaliLink` ADD CONSTRAINT `WaliLink_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaliDigest` ADD CONSTRAINT `WaliDigest_waliId_fkey` FOREIGN KEY (`waliId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaliApproval` ADD CONSTRAINT `WaliApproval_waliId_fkey` FOREIGN KEY (`waliId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaliApproval` ADD CONSTRAINT `WaliApproval_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HealthDisclosure` ADD CONSTRAINT `HealthDisclosure_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HealthDisclosureAccess` ADD CONSTRAINT `HealthDisclosureAccess_disclosureId_fkey` FOREIGN KEY (`disclosureId`) REFERENCES `HealthDisclosure`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HealthDisclosureAccess` ADD CONSTRAINT `HealthDisclosureAccess_requestingUserId_fkey` FOREIGN KEY (`requestingUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HealthDisclosureAccess` ADD CONSTRAINT `HealthDisclosureAccess_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarriageReadinessChecklist` ADD CONSTRAINT `MarriageReadinessChecklist_user1Id_fkey` FOREIGN KEY (`user1Id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarriageReadinessChecklist` ADD CONSTRAINT `MarriageReadinessChecklist_user2Id_fkey` FOREIGN KEY (`user2Id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationActivity` ADD CONSTRAINT `ConversationActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromptEligibility` ADD CONSTRAINT `PromptEligibility_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NikahProposal` ADD CONSTRAINT `NikahProposal_initiatorId_fkey` FOREIGN KEY (`initiatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NikahProposal` ADD CONSTRAINT `NikahProposal_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

