import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { HealthDisclosureService } from './health-disclosure.service';
import { AuthGuard } from '../auth/auth.guard';
import { HealthDisclosureType, ImpactLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health-disclosure')
@UseGuards(AuthGuard)
export class HealthDisclosureController {
  constructor(
    private readonly healthService: HealthDisclosureService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getDisclosureAlias(@Request() req) {
    return this.healthService.getOwnDisclosure(req.user.id);
  }

  @Post()
  async upsertDisclosureAlias(
    @Request() req,
    @Body()
    body: {
      hasHealthMatter?: boolean | null;
      disclosureType?: HealthDisclosureType;
      impactLevel?: ImpactLevel;
      privateNotes?: string;
      isActive?: boolean;
      userId?: string;
    },
  ) {
    if (body.hasHealthMatter !== undefined) {
      return this.healthService.setInitialHealthDisclosureAnswer(
        req.user.id,
        body.hasHealthMatter,
      );
    }

    if (body.userId) {
      const disclosure = await this.prisma.healthDisclosure.findUnique({
        where: { userId: req.user.id },
      });

      if (!disclosure) {
        throw new Error('Health disclosure not initialized');
      }

      const access = await this.prisma.healthDisclosureAccess.upsert({
        where: {
          disclosureId_requestingUserId: {
            disclosureId: disclosure.id,
            requestingUserId: body.userId,
          },
        },
        update: {
          status: 'granted',
          grantedAt: new Date(),
          expiresAt: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000),
        },
        create: {
          disclosureId: disclosure.id,
          requestingUserId: body.userId,
          ownerUserId: req.user.id,
          status: 'granted',
          grantedAt: new Date(),
          expiresAt: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000),
        },
      });

      return access;
    }

    return this.healthService.updateHealthDisclosureDetails(req.user.id, body);
  }

  @Patch()
  async updateDisclosureAlias(
    @Request() req,
    @Body()
    body: {
      disclosureType?: HealthDisclosureType;
      impactLevel?: ImpactLevel;
      privateNotes?: string;
      isActive?: boolean;
    },
  ) {
    return this.healthService.updateHealthDisclosureDetails(req.user.id, body);
  }

  @Delete('share/:userId')
  async revokeShareAlias(@Request() req, @Param('userId') userId: string) {
    await this.healthService.denyDisclosureAccess(req.user.id, userId);
    return { success: true };
  }

  @Post('share')
  async shareDisclosureAlias(
    @Request() req,
    @Body() body: { userId?: string },
  ) {
    const userId = body.userId;
    if (!userId) {
      throw new Error('userId is required');
    }

    const disclosure = await this.prisma.healthDisclosure.findUnique({
      where: { userId: req.user.id },
    });

    if (!disclosure) {
      throw new Error('Health disclosure not initialized');
    }

    const access = await this.prisma.healthDisclosureAccess.upsert({
      where: {
        disclosureId_requestingUserId: {
          disclosureId: disclosure.id,
          requestingUserId: userId,
        },
      },
      update: {
        status: 'granted',
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000),
      },
      create: {
        disclosureId: disclosure.id,
        requestingUserId: userId,
        ownerUserId: req.user.id,
        status: 'granted',
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000),
      },
    });

    return access;
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 1: ONBOARDING
  // ─────────────────────────────────────────────────────────────

  /**
   * POST /health-disclosure/onboarding-answer
   * Save user's answer: "Do you have health matters to disclose?"
   *
   * Body:
   * {
   *   "hasHealthMatter": true | false | null
   * }
   */
  @Post('onboarding-answer')
  async setOnboardingAnswer(
    @Request() req,
    @Body() body: { hasHealthMatter: boolean | null },
  ) {
    return this.healthService.setInitialHealthDisclosureAnswer(
      req.user.id,
      body.hasHealthMatter,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 2: PROFILE MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  /**
   * POST /health-disclosure/details
   * Update health disclosure details (type, impact, notes)
   *
   * Body:
   * {
   *   "disclosureType": "chronicCondition" | "physicalDisability" | etc,
   *   "impactLevel": "notSignificantly" | "sometimes" | "significantly",
   *   "privateNotes": "Details visible only to granted matches..."
   * }
   */
  @Post('details')
  async updateDetails(
    @Request() req,
    @Body()
    body: {
      disclosureType?: HealthDisclosureType;
      impactLevel?: ImpactLevel;
      privateNotes?: string;
    },
  ) {
    return this.healthService.updateHealthDisclosureDetails(req.user.id, body);
  }

  /**
   * GET /health-disclosure/my-disclosure
   * Get user's own disclosure (full details including private notes)
   */
  @Get('my-disclosure')
  async getMyDisclosure(@Request() req) {
    return this.healthService.getOwnDisclosure(req.user.id);
  }

  /**
   * GET /health-disclosure/public-indicator/:userId
   * Get public-safe health indicator for a user's profile
   * Returns only "Available" or null (no type/impact details)
   */
  @Get('public-indicator/:userId')
  async getPublicIndicator(@Param('userId') userId: string) {
    return this.healthService.getPublicHealthIndicator(userId);
  }

  /**
   * PUT /health-disclosure/toggle-active
   * Hide/show disclosure from matches (doesn't delete, just marks inactive)
   *
   * Body:
   * {
   *   "isActive": true | false
   * }
   */
  @Put('toggle-active')
  async toggleActive(@Request() req, @Body() body: { isActive: boolean }) {
    return this.healthService.updateHealthDisclosureDetails(req.user.id, {
      isActive: body.isActive,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ACCESS CONTROL
  // ─────────────────────────────────────────────────────────────

  /**
   * POST /health-disclosure/:userId/request-access
   * Request to see another user's health disclosure details
   * Typically used in serious match context
   */
  @Post(':userId/request-access')
  @HttpCode(HttpStatus.CREATED)
  async requestAccess(@Request() req, @Param('userId') disclosureOwnerId: string) {
    return this.healthService.requestDisclosureAccess(
      req.user.id,
      disclosureOwnerId,
    );
  }

  /**
   * POST /health-disclosure/:requestingUserId/grant-access
   * Grant access to another user to view our health disclosure
   */
  @Post(':requestingUserId/grant-access')
  async grantAccess(@Request() req, @Param('requestingUserId') requestingUserId: string) {
    return this.healthService.grantDisclosureAccess(req.user.id, requestingUserId);
  }

  /**
   * POST /health-disclosure/:requestingUserId/deny-access
   * Deny access request to view our health disclosure
   */
  @Post(':requestingUserId/deny-access')
  async denyAccess(@Request() req, @Param('requestingUserId') requestingUserId: string) {
    await this.healthService.denyDisclosureAccess(req.user.id, requestingUserId);
    return { success: true };
  }

  /**
   * GET /health-disclosure/:userId/with-access
   * Get full disclosure details of another user (if they granted access)
   */
  @Get(':userId/with-access')
  async getDisclosureWithAccess(
    @Request() req,
    @Param('userId') ownerUserId: string,
  ) {
    return this.healthService.getDisclosureWithAccess(
      req.user.id,
      ownerUserId,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 3: MARRIAGE READINESS CHECKLIST
  // ─────────────────────────────────────────────────────────────

  /**
   * POST /health-disclosure/readiness-checklist/:partnerId
   * Initialize marriage readiness checklist for matched couple
   */
  @Post('readiness-checklist/:partnerId/initialize')
  async initializeChecklist(
    @Request() req,
    @Param('partnerId') partnerId: string,
  ) {
    return this.healthService.initializeReadinessChecklist(req.user.id, partnerId);
  }

  /**
   * GET /health-disclosure/readiness-checklist/:partnerId
   * Get marriage readiness status with couple
   */
  @Get('readiness-checklist/:partnerId')
  async getChecklist(
    @Request() req,
    @Param('partnerId') partnerId: string,
  ) {
    return this.healthService.getReadinessChecklist(req.user.id, partnerId);
  }

  /**
   * POST /health-disclosure/readiness-checklist/:partnerId/mark-topic
   * Mark a discussion topic as completed
   *
   * Body:
   * {
   *   "topic": "health" | "fertility" | "finances" | "living" | "family" | "religion" | "timeline" | "location" | "work"
   * }
   */
  @Post('readiness-checklist/:partnerId/mark-topic')
  async markTopic(
    @Request() req,
    @Param('partnerId') partnerId: string,
    @Body() body: { topic: string },
  ) {
    return this.healthService.markTopicDiscussed(
      req.user.id,
      partnerId,
      body.topic as any,
    );
  }

  /**
   * POST /health-disclosure/readiness-checklist/:partnerId/show-reminder
   * Trigger "before engagement" reminder to be shown
   */
  @Post('readiness-checklist/:partnerId/show-reminder')
  async showReminder(
    @Request() req,
    @Param('partnerId') partnerId: string,
  ) {
    return this.healthService.showEngagementReminder(req.user.id, partnerId);
  }

  /**
   * POST /health-disclosure/readiness-checklist/:partnerId/acknowledge-reminder
   * User acknowledges reminder and optionally marks health as discussed
   *
   * Body:
   * {
   *   "discussedHealthMatters": true | false
   * }
   */
  @Post('readiness-checklist/:partnerId/acknowledge-reminder')
  async acknowledgeReminder(
    @Request() req,
    @Param('partnerId') partnerId: string,
    @Body() body: { discussedHealthMatters: boolean },
  ) {
    return this.healthService.acknowledgeEngagementReminder(
      req.user.id,
      partnerId,
      body.discussedHealthMatters,
    );
  }

  /**
   * POST /health-disclosure/readiness-checklist/:partnerId/confirm-engagement
   * Mark engagement/marriage as confirmed (locks checklist for reference)
   */
  @Post('readiness-checklist/:partnerId/confirm-engagement')
  async confirmEngagement(
    @Request() req,
    @Param('partnerId') partnerId: string,
  ) {
    return this.healthService.confirmEngagement(req.user.id, partnerId);
  }

  // ─────────────────────────────────────────────────────────────
  // CONVERSATION ACTIVITY
  // ─────────────────────────────────────────────────────────────

  /**
   * POST /health-disclosure/conversation/:conversationId/log-activity
   * Log a conversation milestone/event (matched, day milestone, health discussed, etc.)
   */
  @Post('conversation/:conversationId/log-activity')
  @HttpCode(HttpStatus.CREATED)
  async logConversationActivity(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Body() body: { type: string; data?: any },
  ) {
    return this.healthService.logConversationActivity(
      req.user.id,
      conversationId,
      body.type,
      body.data || {},
    );
  }

  /**
   * GET /health-disclosure/conversation/:conversationId/activity-feed
   * Get conversation activity feed (system events only)
   */
  @Get('conversation/:conversationId/activity-feed')
  async getConversationActivityFeed(
    @Request() req,
    @Param('conversationId') conversationId: string,
  ) {
    return this.healthService.getConversationActivityFeed(
      conversationId,
      req.user.id,
      50,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // PROMPT ELIGIBILITY
  // ─────────────────────────────────────────────────────────────

  /**
   * GET /health-disclosure/prompt-eligibility/:conversationId/:promptType
   * Check if a prompt can be shown (state, cooldown, etc.)
   */
  @Get('prompt-eligibility/:conversationId/:promptType')
  async checkPromptEligibility(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Param('promptType') promptType: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ userAId: req.user.id }, { userBId: req.user.id }],
      },
      select: { userAId: true, userBId: true },
    });
    const partnerUserId = conversation
      ? conversation.userAId === req.user.id
        ? conversation.userBId
        : conversation.userAId
      : 'unknown';

    return this.healthService.checkPromptEligibility(
      req.user.id,
      conversationId,
      partnerUserId,
      promptType,
    );
  }

  /**
   * POST /health-disclosure/prompt-eligibility/:conversationId/:promptType
   * Update prompt eligibility state
   */
  @Post('prompt-eligibility/:conversationId/:promptType')
  async updatePromptEligibility(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Param('promptType') promptType: string,
    @Body() body: { state: string; metadata?: any; partnerUserId?: string },
  ) {
    return this.healthService.updatePromptEligibility(
      req.user.id,
      conversationId,
      body.partnerUserId || 'unknown',
      promptType,
      body.state,
      body.metadata || {},
    );
  }

  /**
   * POST /health-disclosure/prompt-eligibility/:conversationId/:promptType/dismiss
   * Dismiss a prompt with cooldown period
   */
  @Post('prompt-eligibility/:conversationId/:promptType/dismiss')
  async dismissPrompt(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Param('promptType') promptType: string,
    @Body() body: { cooldownDays?: number },
  ) {
    return this.healthService.dismissPrompt(
      req.user.id,
      conversationId,
      promptType,
      body.cooldownDays || 7,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // NIKAH PROPOSAL
  // ─────────────────────────────────────────────────────────────

  /**
   * POST /health-disclosure/nikah-proposal/:conversationId/:recipientId
   * Propose to discuss Nikah (marriage) with a match
   */
  @Post('nikah-proposal/:conversationId/:recipientId')
  @HttpCode(HttpStatus.CREATED)
  async proposeNikahDiscussion(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Param('recipientId') recipientId: string,
  ) {
    return this.healthService.proposeNikahDiscussion(
      req.user.id,
      recipientId,
      conversationId,
    );
  }

  /**
   * POST /health-disclosure/nikah-proposal/:conversationId/:initiatorId/accept
   * Accept a Nikah proposal
   */
  @Post('nikah-proposal/:conversationId/:initiatorId/accept')
  async acceptNikahProposal(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Param('initiatorId') initiatorId: string,
  ) {
    return this.healthService.acceptNikahProposal(
      initiatorId,
      req.user.id,
      conversationId,
    );
  }

  /**
   * POST /health-disclosure/nikah-proposal/:conversationId/:initiatorId/reject
   * Reject a Nikah proposal
   */
  @Post('nikah-proposal/:conversationId/:initiatorId/reject')
  async rejectNikahProposal(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Param('initiatorId') initiatorId: string,
  ) {
    return this.healthService.rejectNikahProposal(
      initiatorId,
      req.user.id,
      conversationId,
    );
  }

  /**
   * GET /health-disclosure/nikah-proposal/:conversationId/:initiatorId
   * Get Nikah proposal status
   */
  @Get('nikah-proposal/:conversationId/:initiatorId')
  async getNikahProposal(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Param('initiatorId') initiatorId: string,
  ) {
    return this.healthService.getNikahProposal(
      initiatorId,
      req.user.id,
      conversationId,
    );
  }
}
