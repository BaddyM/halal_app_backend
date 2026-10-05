import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  HealthDisclosureType,
  ImpactLevel,
  MarriageReadinessTopic,
} from '@prisma/client';

/**
 * HealthDisclosureService
 *
 * Implements a progressive, privacy-conscious three-stage health disclosure system:
 *
 * Stage 1 (Onboarding): Ask if user has something important to disclose
 * Stage 2 (Profile): Show private indicator, manage disclosure details
 * Stage 3 (Serious Match): Remind about discussion, track readiness topics
 *
 * Philosophy: Encourage honesty without forcing medical data collection.
 * Disclosure details are private and only shared with explicit consent.
 */
@Injectable()
export class HealthDisclosureService {
  constructor(private prisma: PrismaService) {}

  /// The other participant in [conversationId], verified to include [userId].
  ///
  /// The controller previously passed the literal string 'unknown' as the
  /// partner, so every eligibility record was written against a non-existent
  /// user and could never be matched back. Resolving it here also stops one
  /// user reading or writing prompt state on a conversation they are not in.
  async resolvePartner(userId: string, conversationId: string): Promise<string> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userAId: true, userBId: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation.userAId === userId
      ? conversation.userBId
      : conversation.userAId;
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 1: ONBOARDING — Initial disclosure question
  // ─────────────────────────────────────────────────────────────

  /**
   * Save user's answer to onboarding question:
   * "Do you have any health-related matter that a future spouse should know about?"
   *
   * Answers:
   * - true: Yes, I have something to disclose
   * - false: No health matters / prefer to discuss later
   * - null: Not yet answered (skip)
   */
  async setInitialHealthDisclosureAnswer(
    userId: string,
    hasHealthMatter: boolean | null,
  ): Promise<any> {
    const disclosure = await this.prisma.healthDisclosure.upsert({
      where: { userId },
      create: {
        userId,
        hasHealthMatter,
        completedAt: hasHealthMatter !== null ? new Date() : null,
      },
      update: {
        hasHealthMatter,
        completedAt: hasHealthMatter !== null ? new Date() : null,
      },
    });

    return {
      id: disclosure.id,
      hasHealthMatter: disclosure.hasHealthMatter,
      completedAt: disclosure.completedAt,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 2: PROFILE — Detailed disclosure management
  // ─────────────────────────────────────────────────────────────

  /**
   * If user answered "yes" to having health matters, collect details:
   * - Type of condition (chronic, mental health, fertility, etc.)
   * - Impact level (not significant, sometimes, significantly)
   * - Private notes (only shown to serious matches after consent)
   */
  async updateHealthDisclosureDetails(
    userId: string,
    data: {
      disclosureType?: HealthDisclosureType;
      impactLevel?: ImpactLevel;
      privateNotes?: string;
      isActive?: boolean;
    },
  ): Promise<any> {
    const disclosure = await this.prisma.healthDisclosure.findUnique({
      where: { userId },
    });

    if (!disclosure) {
      throw new NotFoundException(
        'Health disclosure not initialized. Complete onboarding first.',
      );
    }

    // Only allow details if user said yes to having something
    if (disclosure.hasHealthMatter !== true) {
      throw new BadRequestException(
        'Can only set disclosure details if hasHealthMatter is true',
      );
    }

    const updated = await this.prisma.healthDisclosure.update({
      where: { userId },
      data: {
        disclosureType: data.disclosureType,
        impactLevel: data.impactLevel,
        privateNotes: data.privateNotes,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
        lastUpdatedAt: new Date(),
      },
    });

    return this.formatDisclosure(updated);
  }

  /**
   * Get user's health disclosure (excluding private notes for privacy)
   * Returns public-safe indicator for profile view
   */
  async getPublicHealthIndicator(userId: string): Promise<any> {
    const disclosure = await this.prisma.healthDisclosure.findUnique({
      where: { userId },
    });

    if (!disclosure || !disclosure.isActive || disclosure.hasHealthMatter !== true) {
      return null;
    }

    // Return only what should be visible on profile
    return {
      hasHealthMatter: true,
      indicator: 'Important disclosure: Available',
      // Don't expose type or impact level on profile
    };
  }

  /**
   * Get full disclosure for user viewing their own profile
   */
  async getOwnDisclosure(userId: string): Promise<any> {
    const disclosure = await this.prisma.healthDisclosure.findUnique({
      where: { userId },
    });

    if (!disclosure) {
      return null;
    }

    return this.formatDisclosure(disclosure);
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 2: ACCESS CONTROL — Request & grant access to details
  // ─────────────────────────────────────────────────────────────

  /**
   * User requests to see health disclosure details of a serious match.
   * Sends notification to disclosure owner.
   */
  async requestDisclosureAccess(
    requestingUserId: string,
    ownerUserId: string,
  ): Promise<any> {
    const disclosure = await this.prisma.healthDisclosure.findUnique({
      where: { userId: ownerUserId },
    });

    if (!disclosure) {
      throw new NotFoundException('User has not set up health disclosure');
    }

    // Check if request already exists
    const existing = await this.prisma.healthDisclosureAccess.findUnique({
      where: {
        disclosureId_requestingUserId: {
          disclosureId: disclosure.id,
          requestingUserId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const access = await this.prisma.healthDisclosureAccess.create({
      data: {
        disclosureId: disclosure.id,
        requestingUserId,
        ownerUserId,
        status: 'pending',
      },
    });

    // TODO: Send notification to disclosure owner
    // await this.notificationService.notifyAccessRequested(ownerUserId, requestingUserId)

    return access;
  }

  /**
   * Owner grants access to their disclosure details to a serious match
   */
  async grantDisclosureAccess(
    ownerId: string,
    requestingUserId: string,
  ): Promise<any> {
    const disclosure = await this.prisma.healthDisclosure.findUnique({
      where: { userId: ownerId },
    });

    if (!disclosure) {
      throw new NotFoundException('Disclosure not found');
    }

    const access = await this.prisma.healthDisclosureAccess.findUnique({
      where: {
        disclosureId_requestingUserId: {
          disclosureId: disclosure.id,
          requestingUserId,
        },
      },
    });

    if (!access) {
      throw new NotFoundException('Access request not found');
    }

    const updated = await this.prisma.healthDisclosureAccess.update({
      where: { id: access.id },
      data: {
        status: 'granted',
        grantedAt: new Date(),
        // Auto-expire after 2 years (relationship is serious by then or over)
        expiresAt: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000),
      },
    });

    // TODO: Notify requester
    // await this.notificationService.notifyAccessGranted(requestingUserId, ownerId)

    return updated;
  }

  /**
   * Owner denies access request
   */
  async denyDisclosureAccess(
    ownerId: string,
    requestingUserId: string,
  ): Promise<void> {
    const disclosure = await this.prisma.healthDisclosure.findUnique({
      where: { userId: ownerId },
    });

    if (!disclosure) {
      throw new NotFoundException('Disclosure not found');
    }

    await this.prisma.healthDisclosureAccess.update({
      where: {
        disclosureId_requestingUserId: {
          disclosureId: disclosure.id,
          requestingUserId,
        },
      },
      data: { status: 'denied' },
    });
  }

  /**
   * Retrieve disclosure details IF user has granted access
   */
  async getDisclosureWithAccess(
    requestingUserId: string,
    ownerUserId: string,
  ): Promise<any> {
    const disclosure = await this.prisma.healthDisclosure.findUnique({
      where: { userId: ownerUserId },
    });

    if (!disclosure) {
      return null;
    }

    // Check access permission
    const access = await this.prisma.healthDisclosureAccess.findUnique({
      where: {
        disclosureId_requestingUserId: {
          disclosureId: disclosure.id,
          requestingUserId,
        },
      },
    });

    // Only return details if access is granted (and not expired)
    if (!access || access.status !== 'granted') {
      return {
        indicator: 'Important disclosure: Available',
        details: 'Access pending',
      };
    }

    if (access.expiresAt && access.expiresAt < new Date()) {
      return {
        indicator: 'Important disclosure: Available',
        details: 'Access expired',
      };
    }

    return {
      indicator: 'Important disclosure: Available',
      disclosureType: disclosure.disclosureType,
      impactLevel: disclosure.impactLevel,
      privateNotes: disclosure.privateNotes,
      grantedAt: access.grantedAt,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 3: MARRIAGE READINESS — Track discussion topics
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize marriage readiness checklist for a matched couple
   */
  async initializeReadinessChecklist(
    user1Id: string,
    user2Id: string,
  ): Promise<any> {
    // Ensure consistent ordering: smaller UUID first
    const [firstId, secondId] =
      user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    const existing = await this.prisma.marriageReadinessChecklist.findUnique({
      where: {
        user1Id_user2Id: {
          user1Id: firstId,
          user2Id: secondId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const checklist = await this.prisma.marriageReadinessChecklist.create({
      data: {
        user1Id: firstId,
        user2Id: secondId,
        completedTopics: [],
      },
    });

    return checklist;
  }

  /**
   * Mark a topic as discussed between a couple
   */
  async markTopicDiscussed(
    user1Id: string,
    user2Id: string,
    topic: MarriageReadinessTopic,
  ): Promise<any> {
    const [firstId, secondId] =
      user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    const checklist = await this.prisma.marriageReadinessChecklist.findUnique({
      where: {
        user1Id_user2Id: {
          user1Id: firstId,
          user2Id: secondId,
        },
      },
    });

    if (!checklist) {
      throw new NotFoundException('Readiness checklist not found');
    }

    const completed = (checklist.completedTopics as string[]) || [];
    if (!completed.includes(topic)) {
      completed.push(topic);
    }

    const updated = await this.prisma.marriageReadinessChecklist.update({
      where: {
        user1Id_user2Id: {
          user1Id: firstId,
          user2Id: secondId,
        },
      },
      data: { completedTopics: completed },
    });

    return updated;
  }

  /**
   * Get marriage readiness status for a couple
   */
  async getReadinessChecklist(user1Id: string, user2Id: string): Promise<any> {
    const [firstId, secondId] =
      user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    const checklist = await this.prisma.marriageReadinessChecklist.findUnique({
      where: {
        user1Id_user2Id: {
          user1Id: firstId,
          user2Id: secondId,
        },
      },
    });

    if (!checklist) {
      return null;
    }

    const completed = (checklist.completedTopics as string[]) || [];
    const allTopics: MarriageReadinessTopic[] = [
      'health',
      'fertility',
      'finances',
      'living',
      'family',
      'religion',
      'timeline',
      'location',
      'work',
    ];

    return {
      id: checklist.id,
      completedTopics: completed,
      totalTopics: allTopics.length,
      completionPercentage: Math.round((completed.length / allTopics.length) * 100),
      reminderShownAt: checklist.reminderShownAt,
      reminderDismissedAt: checklist.reminderDismissedAt,
      engagementConfirmedAt: checklist.engagementConfirmedAt,
    };
  }

  /**
   * Show the "before engagement" reminder to a user
   */
  async showEngagementReminder(user1Id: string, user2Id: string): Promise<any> {
    const [firstId, secondId] =
      user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    const updated = await this.prisma.marriageReadinessChecklist.update({
      where: {
        user1Id_user2Id: {
          user1Id: firstId,
          user2Id: secondId,
        },
      },
      data: { reminderShownAt: new Date() },
    });

    return updated;
  }

  /**
   * User acknowledges "Have you discussed health matters?" reminder
   */
  async acknowledgeEngagementReminder(
    userId: string,
    partnerId: string,
    discussedHealthMatters: boolean,
  ): Promise<any> {
    const [firstId, secondId] =
      userId < partnerId ? [userId, partnerId] : [partnerId, userId];

    const data: any = {
      reminderDismissedAt: new Date(),
    };

    if (discussedHealthMatters) {
      data.completedTopics = ['health']; // Ensure health is marked
    }

    const updated = await this.prisma.marriageReadinessChecklist.update({
      where: {
        user1Id_user2Id: {
          user1Id: firstId,
          user2Id: secondId,
        },
      },
      data,
    });

    return updated;
  }

  /**
   * Confirm engagement/marriage (locks checklist for reference)
   */
  async confirmEngagement(user1Id: string, user2Id: string): Promise<any> {
    const [firstId, secondId] =
      user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    const updated = await this.prisma.marriageReadinessChecklist.update({
      where: {
        user1Id_user2Id: {
          user1Id: firstId,
          user2Id: secondId,
        },
      },
      data: { engagementConfirmedAt: new Date() },
    });

    return updated;
  }

  // ─────────────────────────────────────────────────────────────
  // CONVERSATION ACTIVITY SYSTEM
  // ─────────────────────────────────────────────────────────────

  /**
   * Log a conversation milestone or event (matched, day milestone, etc.)
   */
  async logConversationActivity(
    userId: string,
    conversationId: string,
    type: string,
    data: any = {},
  ): Promise<any> {
    return await this.prisma.conversationActivity.create({
      data: {
        userId,
        conversationId,
        type: type as any,
        data,
      },
    });
  }

  /**
   * Get conversation activity feed for a user (system events only)
   */
  async getConversationActivityFeed(
    conversationId: string,
    userId: string,
    limit: number = 50,
  ): Promise<any[]> {
    return await this.prisma.conversationActivity.findMany({
      where: {
        conversationId,
        userId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // PROMPT ELIGIBILITY SYSTEM
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if a prompt can be shown to user in conversation
   */
  async checkPromptEligibility(
    userId: string,
    conversationId: string,
    partnerUserId: string,
    promptType: string,
  ): Promise<any> {
    return await this.prisma.promptEligibility.findUnique({
      where: {
        userId_conversationId_promptType: {
          userId,
          conversationId,
          promptType: promptType as any,
        },
      },
    });
  }

  /**
   * Initialize or update prompt eligibility state
   */
  async updatePromptEligibility(
    userId: string,
    conversationId: string,
    partnerUserId: string,
    promptType: string,
    state: string,
    metadata: any = {},
  ): Promise<any> {
    return await this.prisma.promptEligibility.upsert({
      where: {
        userId_conversationId_promptType: {
          userId,
          conversationId,
          promptType: promptType as any,
        },
      },
      create: {
        userId,
        conversationId,
        partnerUserId,
        promptType: promptType as any,
        state: state as any,
        metadata,
      },
      update: {
        state: state as any,
        shownAt: state === 'shown' ? new Date() : undefined,
        dismissedAt: state === 'dismissed' ? new Date() : undefined,
        acceptedAt: state === 'accepted' ? new Date() : undefined,
        completedAt: state === 'completed' ? new Date() : undefined,
        metadata,
      },
    });
  }

  /**
   * Mark a prompt as dismissed with cooldown period
   */
  async dismissPrompt(
    userId: string,
    conversationId: string,
    promptType: string,
    cooldownDays: number = 7,
  ): Promise<any> {
    const cooldownUntil = new Date();
    cooldownUntil.setDate(cooldownUntil.getDate() + cooldownDays);

    return await this.prisma.promptEligibility.upsert({
      where: {
        userId_conversationId_promptType: {
          userId,
          conversationId,
          promptType: promptType as any,
        },
      },
      create: {
        userId,
        conversationId,
        partnerUserId: '',
        promptType: promptType as any,
        state: 'dismissed',
        dismissedAt: new Date(),
        cooldownUntil,
      },
      update: {
        state: 'dismissed',
        dismissedAt: new Date(),
        cooldownUntil,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // NIKAH PROPOSAL SYSTEM
  // ─────────────────────────────────────────────────────────────

  /**
   * Create or update a Nikah (marriage discussion) proposal
   */
  async proposeNikahDiscussion(
    initiatorId: string,
    recipientId: string,
    conversationId: string,
  ): Promise<any> {
    return await this.prisma.nikahProposal.upsert({
      where: {
        initiatorId_recipientId_conversationId: {
          initiatorId,
          recipientId,
          conversationId,
        },
      },
      create: {
        initiatorId,
        recipientId,
        conversationId,
        status: 'proposed',
      },
      update: {
        status: 'proposed',
      },
    });
  }

  /**
   * Accept a Nikah proposal
   */
  async acceptNikahProposal(
    initiatorId: string,
    recipientId: string,
    conversationId: string,
  ): Promise<any> {
    const proposal = await this.prisma.nikahProposal.findUnique({
      where: {
        initiatorId_recipientId_conversationId: {
          initiatorId,
          recipientId,
          conversationId,
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException('Nikah proposal not found');
    }

    const now = new Date();

    // If both have accepted, mark bothAgreeAt
    let bothAgreeAt = proposal.bothAgreeAt;
    if (
      proposal.status === 'accepted' ||
      (proposal.acceptedAt && proposal.acceptedAt !== now)
    ) {
      bothAgreeAt = now; // Both have now accepted
    }

    return await this.prisma.nikahProposal.update({
      where: {
        initiatorId_recipientId_conversationId: {
          initiatorId,
          recipientId,
          conversationId,
        },
      },
      data: {
        status: 'accepted',
        acceptedAt: now,
        bothAgreeAt,
      },
    });
  }

  /**
   * Reject a Nikah proposal
   */
  async rejectNikahProposal(
    initiatorId: string,
    recipientId: string,
    conversationId: string,
  ): Promise<any> {
    return await this.prisma.nikahProposal.update({
      where: {
        initiatorId_recipientId_conversationId: {
          initiatorId,
          recipientId,
          conversationId,
        },
      },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
      },
    });
  }

  /**
   * Get Nikah proposal status
   */
  async getNikahProposal(
    initiatorId: string,
    recipientId: string,
    conversationId: string,
  ): Promise<any> {
    return await this.prisma.nikahProposal.findUnique({
      where: {
        initiatorId_recipientId_conversationId: {
          initiatorId,
          recipientId,
          conversationId,
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  private formatDisclosure(disclosure: any) {
    return {
      id: disclosure.id,
      userId: disclosure.userId,
      hasHealthMatter: disclosure.hasHealthMatter,
      disclosureType: disclosure.disclosureType,
      impactLevel: disclosure.impactLevel,
      privateNotes: disclosure.privateNotes,
      isActive: disclosure.isActive,
      completedAt: disclosure.completedAt,
      lastUpdatedAt: disclosure.lastUpdatedAt,
    };
  }
}
