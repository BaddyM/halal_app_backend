# Missing APIs & Implementation Guide

## Overview

The admin dashboard has **Tasbih** and **Wali** pages implemented, but the **backend APIs and mobile app integration are incomplete**. This document provides the full API contracts, database schema, and implementation roadmap.

---

## Part 1: TASBIH (Dhikr Tracking)

### Status
- ✅ Admin UI exists (mock data only)
- ❌ Mobile session recording APIs missing
- ❌ Stats/leaderboard endpoints missing
- ❌ Badge system backend missing
- ❌ Offline sync capability missing

### Database Schema (Prisma)

```prisma
model TasbihSession {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Session metadata
  startedAt     DateTime @default(now())
  endedAt       DateTime?
  durationMs    Int?     // Calculated: endedAt - startedAt
  
  // Dhikr count: total repetitions
  totalCount    Int      @default(0)
  
  // Dhikr category breakdown (stored as JSON object)
  // Example: { "tahlil": 10, "tahmid": 5, "takbir": 3, ... }
  countByType   Json     @default("{}")
  
  // Device/app context
  deviceId      String?
  appVersion    String?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([userId, createdAt])
  @@index([userId, startedAt])
}

model TasbihDaily {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Date of the daily summary (stored as YYYY-MM-DD or use Date type)
  date          DateTime
  
  // Aggregate counts for the day
  totalCount    Int      @default(0)
  sessionCount  Int      @default(0)
  totalDurationMs Int    @default(0)
  
  // Breakdown by dhikr type
  countByType   Json     @default("{}")
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([userId, date])
  @@index([userId, date])
}

model TasbihStreak {
  id            String   @id @default(cuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Current streak
  currentStreak Int      @default(0)
  lastActiveDate DateTime
  
  // Longest streak record
  longestStreak Int      @default(0)
  longestStreakStart DateTime?
  longestStreakEnd   DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model TasbihBadge {
  id            String   @id @default(cuid())
  badgeType     String   // "milestone_100", "streak_7", "daily_master", etc.
  title         String   // "Century Master"
  description   String
  icon          String?  // URL or emoji
  requirement   Int      // How many to unlock
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([badgeType])
}

model UserBadge {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  badgeType     String
  unlockedAt    DateTime @default(now())
  
  createdAt     DateTime @default(now())
  
  @@unique([userId, badgeType])
  @@index([userId, unlockedAt])
}

model TasbihUserSettings {
  id            String   @id @default(cuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Notification preferences
  notificationsEnabled Boolean @default(true)
  dailyReminderEnabled Boolean @default(true)
  dailyReminderTime    String? // "08:00" format
  
  // Display preferences
  showLeaderboard Boolean @default(true)
  privateStats    Boolean @default(false)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### Mobile APIs

#### 1. Start a Tasbih Session

**POST** `/api/tasbih/sessions/start`

Request:
```json
{
  "deviceId": "device-uuid",
  "appVersion": "1.0.0"
}
```

Response:
```json
{
  "sessionId": "session-uuid",
  "startedAt": "2026-08-21T10:30:00Z",
  "status": "active"
}
```

---

#### 2. Record Dhikr Count

**POST** `/api/tasbih/sessions/:sessionId/record`

Request:
```json
{
  "type": "tahlil",        // "tahlil" | "tahmid" | "takbir" | "tasbeeh" | "custom"
  "count": 33,
  "timestamp": "2026-08-21T10:35:00Z"
}
```

Response:
```json
{
  "sessionId": "session-uuid",
  "type": "tahlil",
  "count": 33,
  "totalCount": 250,
  "recordedAt": "2026-08-21T10:35:00Z"
}
```

---

#### 3. End a Tasbih Session

**POST** `/api/tasbih/sessions/:sessionId/end`

Request:
```json
{
  "totalCount": 250,
  "countByType": {
    "tahlil": 100,
    "tahmid": 75,
    "takbir": 50,
    "tasbeeh": 25
  }
}
```

Response:
```json
{
  "sessionId": "session-uuid",
  "startedAt": "2026-08-21T10:30:00Z",
  "endedAt": "2026-08-21T10:45:00Z",
  "durationMs": 900000,
  "totalCount": 250,
  "countByType": {...},
  "streakIncremented": true,
  "newBadges": ["milestone_100"]
}
```

---

#### 4. Get Today's Stats

**GET** `/api/tasbih/today`

Response:
```json
{
  "date": "2026-08-21",
  "totalCount": 750,
  "sessionCount": 3,
  "totalDurationMs": 1800000,
  "countByType": {
    "tahlil": 300,
    "tahmid": 250,
    "takbir": 150,
    "tasbeeh": 50
  },
  "streak": 7,
  "badges": ["milestone_100", "streak_7"]
}
```

---

#### 5. Get Monthly/Yearly Stats

**GET** `/api/tasbih/stats?period=month&year=2026&month=08`

Response:
```json
{
  "period": "month",
  "year": 2026,
  "month": 8,
  "totalCount": 22500,
  "sessionCount": 90,
  "totalDurationMs": 54000000,
  "bestDay": {
    "date": "2026-08-15",
    "count": 1200
  },
  "averageDailyCount": 750,
  "streakInfo": {
    "current": 21,
    "longest": 45
  }
}
```

---

#### 6. Get Leaderboard

**GET** `/api/tasbih/leaderboard?period=week&limit=20`

Allowed periods: `day`, `week`, `month`, `year`, `allTime`

Response:
```json
{
  "period": "week",
  "endDate": "2026-08-21",
  "leaders": [
    {
      "rank": 1,
      "userId": "user-123",
      "name": "Fatima",
      "imageUrl": "https://...",
      "totalCount": 5000,
      "sessionCount": 14,
      "streak": 7
    },
    {
      "rank": 2,
      "userId": "user-456",
      "name": "Ibrahim",
      "imageUrl": "https://...",
      "totalCount": 4800,
      "sessionCount": 12,
      "streak": 6
    }
  ],
  "yourRank": {
    "rank": 5,
    "totalCount": 3500,
    "sessionCount": 10
  }
}
```

---

### Admin APIs

#### 1. Get Tasbih Dashboard Stats

**GET** `/api/admin/tasbih/stats?period=month&year=2026&month=08`

Response:
```json
{
  "period": "month",
  "totalUsers": 450,
  "activeUsers": 320,
  "totalSessions": 4200,
  "totalCount": 1050000,
  "averageSessionDuration": 900000,
  "topBadges": [
    {
      "badgeType": "milestone_100",
      "unlockedCount": 180,
      "percentage": 40
    }
  ],
  "dailyTrend": [
    {
      "date": "2026-08-01",
      "count": 35000,
      "sessions": 140,
      "users": 85
    }
  ]
}
```

---

#### 2. Get User's Detailed Tasbih History

**GET** `/api/admin/tasbih/users/:userId`

Response:
```json
{
  "userId": "user-123",
  "name": "Fatima",
  "totalCount": 22500,
  "sessionCount": 90,
  "currentStreak": 21,
  "longestStreak": 45,
  "badges": [
    "milestone_100",
    "streak_7",
    "daily_master"
  ],
  "recentSessions": [
    {
      "sessionId": "sess-123",
      "startedAt": "2026-08-21T10:30:00Z",
      "endedAt": "2026-08-21T10:45:00Z",
      "totalCount": 250,
      "countByType": {...}
    }
  ]
}
```

---

#### 3. Manage Badges

**GET** `/api/admin/tasbih/badges`

Response:
```json
[
  {
    "badgeType": "milestone_100",
    "title": "Century Master",
    "description": "Record 100+ dhikr in a single session",
    "requirement": 100,
    "icon": "🏅",
    "unlockedCount": 180
  }
]
```

**POST** `/api/admin/tasbih/badges`

Request:
```json
{
  "badgeType": "streak_30",
  "title": "Monthly Devotee",
  "description": "Maintain a 30-day streak",
  "requirement": 30,
  "icon": "🔥"
}
```

---

#### 4. Adjust User Streak

**PATCH** `/api/admin/tasbih/users/:userId/streak`

Request:
```json
{
  "action": "reset" | "increment" | "set",
  "value": 0 | 1 | 7,
  "reason": "Admin correction"
}
```

---

#### 5. View Leaderboard Admin Panel

**GET** `/api/admin/tasbih/leaderboard?period=month&limit=100`

Returns full leaderboard with additional admin fields like suspension status, etc.

---

#### 6. Export Tasbih Data

**GET** `/api/admin/tasbih/export?format=csv&period=month&year=2026&month=08`

Returns CSV file with all Tasbih data for reporting/analysis.

---

## Part 2: WALI (Guardian Oversight)

### Status
- ✅ Admin types defined but no endpoints
- ❌ Mobile invite/accept flow missing
- ❌ Wali digest feature missing
- ❌ Approval workflow for matches/chats missing
- ❌ CC (carbon copy) notifications missing

### Database Schema (Prisma)

```prisma
model WaliLink {
  id            String   @id @default(cuid())
  
  // Guardian side
  waliId        String
  wali          User     @relation("WaliGuardian", fields: [waliId], references: [id], onDelete: Cascade)
  
  // User being guided
  userId        String
  user          User     @relation("UserWali", fields: [userId], references: [id], onDelete: Cascade)
  
  // Approval state
  status        String   @default("pending") // "pending" | "active" | "rejected" | "revoked"
  
  // Permissions
  seeProfiles   Boolean @default(true)   // Can view who you're matched with
  seeChats      Boolean @default(false)  // Can view chat messages
  approveLikes  Boolean @default(false)  // Must approve before you like someone
  approveMatches Boolean @default(false) // Must approve before accepting a match
  
  // Invitation tracking
  inviteSentAt  DateTime?
  acceptedAt    DateTime?
  rejectedAt    DateTime?
  revokedAt     DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([waliId, userId])
  @@index([userId, status])
  @@index([waliId, status])
}

model WaliDigest {
  id            String   @id @default(cuid())
  waliId        String
  wali          User     @relation(fields: [waliId], references: [id], onDelete: Cascade)
  
  // Summary for a week/month
  period        String   // "weekly" | "monthly"
  startDate     DateTime
  endDate       DateTime
  
  // Events summary
  newMatches    Int      @default(0)
  newLikes      Int      @default(0)
  newMessages   Int      @default(0)
  
  // Protected users summary
  usersLinked   Int      @default(0)
  
  // Digest sent status
  sentAt        DateTime?
  
  createdAt     DateTime @default(now())
  
  @@unique([waliId, period, startDate])
}

model WaliApproval {
  id            String   @id @default(cuid())
  waliId        String
  wali          User     @relation("WaliApprovals", fields: [waliId], references: [id], onDelete: Cascade)
  
  userId        String
  user          User     @relation("UserApprovals", fields: [userId], references: [id], onDelete: Cascade)
  
  // Type of action needing approval
  actionType    String   // "like" | "match_accept" | "match_reject"
  
  // Details about the action
  targetUserId  String   // The user being liked/matched with
  actionDetails Json     // Store the match/like details
  
  // Approval state
  status        String   @default("pending") // "pending" | "approved" | "rejected"
  approvedAt    DateTime?
  
  createdAt     DateTime @default(now())
  expiresAt     DateTime // Approval requests expire after 7 days
  
  @@index([waliId, status])
  @@index([userId, actionType])
}
```

### Mobile APIs

#### 1. Invite a Wali (Guardian)

**POST** `/api/wali/invite`

Request:
```json
{
  "waliEmail": "guardian@example.com",
  "message": "Please be my wali and guide my matrimonial journey"
}
```

Response:
```json
{
  "linkId": "wali-link-123",
  "waliEmail": "guardian@example.com",
  "status": "pending",
  "inviteSentAt": "2026-08-21T10:30:00Z"
}
```

---

#### 2. Accept/Reject Wali Invitation

**POST** `/api/wali/links/:linkId/respond`

Request:
```json
{
  "action": "accept" | "reject",
  "permissions": {
    "seeProfiles": true,
    "seeChats": false,
    "approveLikes": false,
    "approveMatches": false
  }
}
```

Response:
```json
{
  "linkId": "wali-link-123",
  "status": "active",
  "permissions": {...},
  "acceptedAt": "2026-08-21T10:35:00Z"
}
```

---

#### 3. List My Walis (For User)

**GET** `/api/wali/my-walis`

Response:
```json
[
  {
    "linkId": "wali-link-123",
    "waliId": "user-456",
    "waliName": "Uncle Ahmed",
    "waliImage": "https://...",
    "status": "active",
    "permissions": {
      "seeProfiles": true,
      "seeChats": false,
      "approveLikes": false,
      "approveMatches": false
    },
    "acceptedAt": "2026-07-15T08:00:00Z"
  }
]
```

---

#### 4. List Protected Users (For Wali)

**GET** `/api/wali/protected-users`

Response:
```json
[
  {
    "linkId": "wali-link-123",
    "userId": "user-789",
    "userName": "Fatima",
    "userImage": "https://...",
    "status": "active",
    "permissions": {
      "seeProfiles": true,
      "seeChats": false,
      "approveLikes": false,
      "approveMatches": false
    }
  }
]
```

---

#### 5. Revoke Wali Access

**POST** `/api/wali/links/:linkId/revoke`

Response:
```json
{
  "linkId": "wali-link-123",
  "status": "revoked",
  "revokedAt": "2026-08-21T10:40:00Z"
}
```

---

#### 6. Update Wali Permissions

**PATCH** `/api/wali/links/:linkId/permissions`

Request:
```json
{
  "seeProfiles": true,
  "seeChats": true,
  "approveLikes": false,
  "approveMatches": false
}
```

---

#### 7. Request Wali Approval (When Configured)

**POST** `/api/wali/request-approval`

Request:
```json
{
  "actionType": "like" | "match_accept",
  "targetUserId": "user-999",
  "details": {
    "name": "Aisha",
    "imageUrl": "https://...",
    "bio": "..."
  }
}
```

Response:
```json
{
  "approvalId": "approval-123",
  "status": "pending",
  "waliNotified": true,
  "expiresAt": "2026-08-28T10:30:00Z"
}
```

---

#### 8. Get Pending Approvals for Wali

**GET** `/api/wali/pending-approvals`

Response:
```json
[
  {
    "approvalId": "approval-123",
    "userId": "user-789",
    "userName": "Fatima",
    "actionType": "like",
    "targetUser": {
      "userId": "user-999",
      "name": "Aisha",
      "imageUrl": "https://..."
    },
    "createdAt": "2026-08-21T10:30:00Z",
    "expiresAt": "2026-08-28T10:30:00Z"
  }
]
```

---

#### 9. Approve/Reject Wali Request

**POST** `/api/wali/approvals/:approvalId/respond`

Request:
```json
{
  "action": "approved" | "rejected",
  "reason": "They seem like a good match"
}
```

Response:
```json
{
  "approvalId": "approval-123",
  "status": "approved",
  "userNotified": true,
  "approvedAt": "2026-08-21T10:35:00Z"
}
```

---

### Admin APIs

#### 1. Get Wali Statistics

**GET** `/api/admin/wali/stats`

Response:
```json
{
  "totalWaliLinks": 850,
  "activeLinks": 650,
  "pendingInvites": 150,
  "rejectedLinks": 50,
  "usageByPermission": {
    "seeProfiles": 600,
    "seeChats": 120,
    "approveLikes": 200,
    "approveMatches": 180
  }
}
```

---

#### 2. Get User's Wali Links

**GET** `/api/admin/wali/users/:userId/links`

Response:
```json
[
  {
    "linkId": "wali-link-123",
    "waliId": "user-456",
    "waliName": "Ahmed",
    "status": "active",
    "permissions": {...},
    "createdAt": "2026-07-15T08:00:00Z",
    "acceptedAt": "2026-07-15T08:30:00Z"
  }
]
```

---

#### 3. Manage Wali Link

**PATCH** `/api/admin/wali/links/:linkId`

Request:
```json
{
  "action": "suspend" | "activate" | "remove",
  "reason": "Abuse detected"
}
```

---

#### 4. View Wali Digest Settings

**GET** `/api/admin/wali/settings`

Response:
```json
{
  "digestFrequency": "weekly",
  "digestDay": "friday",
  "digestTime": "18:00",
  "enabled": true
}
```

---

#### 5. Send Manual Digest

**POST** `/api/admin/wali/send-digest`

Request:
```json
{
  "waliId": "user-456",
  "period": "weekly"
}
```

---

#### 6. View Approval Requests

**GET** `/api/admin/wali/approvals?status=pending&limit=50`

Response:
```json
[
  {
    "approvalId": "approval-123",
    "waliId": "user-456",
    "userId": "user-789",
    "actionType": "like",
    "status": "pending",
    "createdAt": "2026-08-21T10:30:00Z"
  }
]
```

---

## Real-Time Events (WebSocket)

### Tasbih Events

- `tasbih:session-started` - User started a session
- `tasbih:badge-unlocked` - User earned a badge
- `tasbih:streak-updated` - User's streak changed
- `tasbih:leaderboard-updated` - Leaderboard position changed

### Wali Events

- `wali:invitation-received` - New wali invitation
- `wali:link-activated` - Wali accepted the invitation
- `wali:digest-sent` - Weekly/monthly digest sent
- `wali:approval-requested` - User requesting wali approval
- `wali:approval-responded` - Wali responded to approval

---

## Implementation Priority

### Phase 1 (MVP - Weeks 1-2)
- [ ] Tasbih session start/end/record endpoints
- [ ] Daily stats API
- [ ] Basic leaderboard
- [ ] Database migrations

### Phase 2 (Weeks 3-4)
- [ ] Monthly/yearly stats
- [ ] Badge system backend
- [ ] Streak tracking
- [ ] Flutter Tasbih screen integration

### Phase 3 (Weeks 5-6)
- [ ] Wali invite/accept flow
- [ ] Basic Wali link management
- [ ] Protected user listing
- [ ] Flutter Wali invite screen

### Phase 4 (Weeks 7-8)
- [ ] Approval workflows
- [ ] Wali digest system
- [ ] Real-time events
- [ ] Admin panel integration

### Phase 5 (Weeks 9-10)
- [ ] Offline sync
- [ ] Performance optimization
- [ ] Analytics dashboard
- [ ] Testing & bug fixes

---

## Error Handling

All endpoints should return appropriate HTTP status codes:

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Auth required
- `403 Forbidden` - Permission denied (Wali rules)
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate Wali link, etc.
- `500 Internal Server Error` - Server error

Error response format:
```json
{
  "statusCode": 400,
  "message": "Email is required",
  "error": "BadRequestException"
}
```

---

## Notes for Implementation

1. **Offline Sync**: Use a local queue to record Tasbih counts when offline; sync when reconnected
2. **Privacy**: Wali permissions must be strictly enforced on all endpoints
3. **Notifications**: Send push notifications for wali invites, approvals, badge unlocks
4. **Audit**: Log all wali actions for security
5. **Rate Limiting**: Implement rate limiting on session creation to prevent spam
6. **Testing**: Create comprehensive test suites for permission checks

