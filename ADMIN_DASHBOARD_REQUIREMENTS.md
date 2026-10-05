# Halal Dating App — Complete Feature Analysis & Admin Dashboard Requirements

## Table of Contents
1. [User Verification System](#user-verification-system)
2. [Complete App Features](#complete-app-features)
3. [Admin Dashboard Required Features](#admin-dashboard-required-features)
4. [API Endpoints Reference](#api-endpoints-reference)

---

## User Verification System

### How Verification Works (User Side)

The app implements a **two-part verification system** to earn a Verified Badge:

#### Part 1: Phone Verification
- User submits their phone number from the **Account Verification Screen**
- Backend validates format and stores it as `phoneVerificationStatus: pending`
- Admin manually reviews and updates to `verified` or `rejected`
- On approval, `isPhoneVerified: true` is set
- User receives push notification of status change

#### Part 2: Identity Verification
- User submits government ID + selfie (document photos)
- Submission saved to `IdentityVerification.submission` (JSON with document metadata)
- Status starts as `pending` for manual admin review
- Admin reviews document images and updates to `verified` or `rejected`
- On approval, `isVerified: true` is set on the Profile
- **Badge Only Issued When:** Both phone AND identity are verified

#### Part 3 (Optional): Wali/Guardian Phone
- User can optionally provide a guardian/wali phone number
- Same verification flow as phone number
- Stored separately in `VerificationPart`
- Displayed on profile if provided and verified

#### Status Lifecycle
```
notSubmitted → pending → verified (or rejected/resubmissionRequired)
```

### Verification Data Model

**User Table Fields:**
```
- isPhoneVerified: boolean
- phoneVerificationStatus: ManualVerificationStatus (enum)
- phoneVerificationReason: string (rejection reason)
- halalVerificationSubmitted: boolean (marks that user started the flow)
```

**IdentityVerification Table:**
```
- id: UUID (unique per user)
- userId: UUID (foreign key)
- status: ManualVerificationStatus
- reason: string (rejection feedback)
- submission: JSON {
    documents: {
      idFront: { documentId, filename, uploadedAt },
      idBack: { documentId, filename, uploadedAt },
      selfie: { documentId, filename, uploadedAt }
    }
  }
- reviewedAt: datetime (when admin reviewed)
- createdAt, updatedAt
```

**Profile Table:**
```
- isVerified: boolean (set to true only when both phone AND identity verified)
```

### Verification API Endpoints (Backend)

#### User-Facing
- **POST `/verification/phone`** → Submit phone for verification
- **POST `/verification/identity`** → Submit identity documents
- **GET `/verification`** → Fetch current verification status overview
- **GET `/verification/documents/:documentId`** → Download/view verification document

#### Admin-Facing
- **GET `/admin/users/:id/verification`** → Get verification details for user
- **PATCH `/admin/users/:id/verification/phone`** → Review phone (approve/reject with reason)
- **PATCH `/admin/users/:id/verification/identity`** → Review identity (approve/reject with reason)
- **GET `/admin/users/:id/verification/documents/:documentId`** → View document file

### Verification Business Logic

1. **Auto-Moderation:** Identity documents checked server-side for flagged content (optional AI check)
2. **Notification System:** User receives push + in-app notification on status change with reason if rejected
3. **Resubmission:** Admin can mark as `resubmissionRequired` to ask user for new documents
4. **Badge Display:**
   - Verified badge shows on profile card, discover grid, chat, matches, everywhere
   - Only shown if `isVerified === true` on profile
5. **Privacy:** Verification data never exposed to other users, only to admins + verified badge display

---

## Complete App Features

### 1. **Authentication & Onboarding**
- ✅ Email/password signup, login, password reset
- ✅ OAuth (Google, Apple) integration
- ✅ Email verification
- ✅ Multi-step onboarding quiz (30+ questions about marriage preferences, cultural background, children, location, values, etc.)
- ✅ Match percentage calculation (algorithm matching user on multiple criteria)
- ✅ Halal verification submission flow

**Admin Dashboard Needs:**
- User creation/soft-delete (suspend/ban)
- Edit user profile fields
- Reset user password
- View onboarding answers submitted by each user

---

### 2. **Dating Features**

#### Home/Discovery Deck
- ✅ Swipeable profile cards with photo deck
- ✅ Like/Pass/SuperLike actions
- ✅ Compatibility score display with breakdown
- ✅ "Why this match?" algorithm-generated reasons
- ✅ Limited like allowance (Basic: 5 lifetime, Paid: unlimited)
- ✅ Auto-removal of profiles you've already interacted with

**Admin Dashboard Needs:**
- Reset user swipes/likes
- Manual match creation
- View like/match history
- Export user activity stats

#### Discover Screen (Grid View)
- ✅ 2x grid of profiles
- ✅ Advanced filtering (age, location, prayer frequency, verified only, online only)
- ✅ Search by name/location
- ✅ Sort by compatibility, newest, online
- ✅ Tribe/cultural background display (Ugandan users)

**Admin Dashboard Needs:**
- Filter/sort users for moderation
- Flag inappropriate profiles

#### Matches & Who Liked You
- ✅ View all mutual matches (both users liked each other)
- ✅ "Who Liked Me" wall (profiles that liked you, filterable)
- ✅ New match counter
- ✅ Quick message from match card

**Admin Dashboard Needs:**
- View match audit trail
- Delete inappropriate matches

---

### 3. **Messaging & Chat**

#### Conversations
- ✅ Real-time messaging with socket.io
- ✅ Read receipts (premium feature)
- ✅ Last message preview in conversation list
- ✅ Timestamps (right-aligned)
- ✅ Message auto-moderation (flagged word detection)
- ✅ Online status indicator
- ✅ Verified badge on partner profile in chat

**Admin Dashboard Needs:**
- Flag/review conversations
- Search messages by keyword
- Manual moderation queue
- Suspend conversations if needed
- Message export

#### AI Support Chat
- ✅ AI chatbot for user guidance (Gemini AI)
- ✅ Common FAQs about Islamic guidance, marriage readiness

**Admin Dashboard Needs:**
- View AI chat logs
- Configure AI responses/FAQs
- Monitor AI quality

---

### 4. **Profile Management**

#### Edit Profile
- ✅ Update photos (primary + gallery)
- ✅ Upload private photos (locked by default)
- ✅ Photo requests (request access to private photos)
- ✅ Edit bio, profession, location, prayer frequency
- ✅ Add interests/hobbies (tags)
- ✅ Social links (Instagram, Facebook, TikTok)
- ✅ Preferences (children, marriage timeline, location preference)
- ✅ Guardian/Wali info (name, email, phone, relation)
- ✅ Appearance preferences (beard, hijab)

**Admin Dashboard Needs:**
- View all user photos
- Flag inappropriate photos
- Remove photos/profile
- Edit user fields directly
- View all profile versions/history

#### Privacy Settings
- ✅ Toggle: Show distance
- ✅ Toggle: Show online status
- ✅ Toggle: Show last seen
- ✅ Toggle: Incognito mode (browse anonymously)
- ✅ Toggle: Profile visibility (everyone/premium/matches only)
- ✅ Blocked users list
- ✅ Report user (abuse, spam, fake profile)

**Admin Dashboard Needs:**
- View privacy settings for any user
- Manually block/unblock users
- Review abuse reports (feed)
- Auto-flag users with multiple reports

---

### 5. **Subscription & Billing**

#### Plans
- ✅ **Basic (Free):** 5 lifetime likes, 5 active chats max, see matches ≥85% compatibility, shows ads
- ✅ **Premium (Monthly):** Unlimited likes/chats, full visibility, no ads, advanced filters, see who liked you
- ✅ **VIP (One-time):** Everything Premium + lifetime access, VIP badge, priority support, profile boost

#### Subscription Features
- ✅ Plan selection screen with feature comparison
- ✅ Stripe/Apple/Google payment integration
- ✅ Transaction history
- ✅ Upgrade prompt banner when like limit reached
- ✅ Subscription status on profile screen
- ✅ Renewal/expiry dates displayed
- ✅ Cancel subscription (at period end or immediately)

**Admin Dashboard Needs:**
- List all users by subscription tier
- View transactions
- Refund processing
- Extend/override subscription expiry
- Create admin discount codes
- View revenue stats
- Churn analysis (who cancelled)

---

### 6. **Islamic Features**

#### Prayer Times
- ✅ Display prayer times for user's location
- ✅ Prayer time notifications (optional)
- ✅ Qibla direction calculator
- ✅ Prayer frequency filter in discovery

**Admin Dashboard Needs:**
- Configure prayer time API
- View prayer time accuracy
- Prayer engagement stats

#### Tasbih (Islamic Counter)
- ✅ Digital Islamic counter with stats (daily, monthly, yearly)
- ✅ Streak tracking (days in a row)
- ✅ Badges/achievements (milestones: 1K, 10K, 100K)
- ✅ Leaderboards (global rankings)
- ✅ Privacy settings (private/matches only/public)
- ✅ Adhkar library (pre-set Islamic phrases)

**Admin Dashboard Needs:**
- View tasbih leaderboards
- Award/revoke badges
- Configure achievement thresholds
- Analytics on tasbih engagement

---

### 7. **Health Disclosure (Progressive System)**

A three-stage system for serious couples to discuss health conditions:

#### Stage 1: Public Indicator
- ✅ "Does the user have something to disclose?" (yes/no/prefer not to say)
- ✅ Optional: "When would they want to discuss?" (immediately/after first chat/later)

#### Stage 2: Request Access
- ✅ Matched users can request access to detailed disclosure
- ✅ Requester must provide reason
- ✅ Owner can approve/deny

#### Stage 3: Full Disclosure
- ✅ Owner provides detailed condition info:
  - Type (chronic, disability, mental health, fertility, genetic, treatment, other)
  - Brief description
  - Impact level (not significant, sometimes, significantly)
  - Treatment/management info

**Admin Dashboard Needs:**
- View aggregated health disclosure stats (privacy-preserving)
- Flag inappropriate disclosures
- Monitor feature engagement

---

### 8. **Marriage Readiness Checklist**

For couples at serious stage:
- ✅ Collaborative checklist (both partners)
- ✅ Topics: health, fertility, finances, living situation, family, religion, timeline, location, work
- ✅ Real-time sync between partners
- ✅ Completion tracking

**Admin Dashboard Needs:**
- View engagement metrics
- Export anonymized data

---

### 9. **Nikah Proposal System**

- ✅ Proposal submission (with custom message)
- ✅ Proposal status tracking (pending/accepted/declined)
- ✅ Notification when partner responds
- ✅ Nikah suggestion cards based on compatibility

**Admin Dashboard Needs:**
- View proposal metrics
- Flag false/spam proposals

---

### 10. **Guardian/Wali System**

- ✅ User can assign a guardian (email-based invitation)
- ✅ Guardian invited via email link
- ✅ Guardian can:
  - View protected user's profile
  - View all conversations (read-only summaries)
  - CC'd on conversation summaries (daily/weekly digest)
  - Approve conversations before first message (optional)
  - View match history
- ✅ Guardian can delegate to another guardian
- ✅ User can remove guardian

**Admin Dashboard Needs:**
- View wali links
- Manual wali assignment for users
- View wali approval workflows
- Wali engagement stats

---

### 11. **Notifications & Inbox**

#### In-App Notifications
- ✅ Real-time push notifications (Firebase)
- ✅ Notification center (in-app list)
- ✅ Types:
  - New matches
  - New likes (who liked you)
  - New messages
  - Photo requests
  - Health disclosure requests
  - Nikah proposals
  - Verification status updates
  - Admin messages

#### Inbox (Admin Messages)
- ✅ Admin can send in-app messages to users
- ✅ Root-level threads (not 1:1 chats)
- ✅ Users can reply
- ✅ Message history per thread

**Admin Dashboard Needs:**
- Send bulk notifications
- View notification delivery stats
- Manage notification templates
- Adjust notification frequency limits

---

### 12. **Support & Feedback**

#### Help & Support Screen
- ✅ FAQ categories (Islamic guidance, verification, features, troubleshooting)
- ✅ Contact form
- ✅ Report abuse
- ✅ Data privacy, terms, licenses

#### Support Tickets
- ✅ User can create support tickets
- ✅ Admin can respond
- ✅ Ticket status tracking

#### AI Support Agent
- ✅ Gemini AI chatbot for instant help
- ✅ Rate limiting per user

**Admin Dashboard Needs:**
- Support ticket queue
- Bulk messaging templates
- FAQ management
- AI conversation logs
- Response time SLA tracking

---

### 13. **User Account Management**

#### Settings
- ✅ Account security (email, password change)
- ✅ Data export (GDPR compliance)
- ✅ Delete account (30-day soft delete)
- ✅ View privacy settings
- ✅ View blocked users
- ✅ Notification preferences

**Admin Dashboard Needs:**
- Hard delete accounts
- View account data
- Restore soft-deleted accounts
- View user settings audit trail

---

### 14. **Premium Chat Features**

- ✅ Voice messages (Premium only)
- ✅ Image sharing in chat
- ✅ Read receipts (see when message was read)
- ✅ Typing indicators
- ✅ Message reactions

**Admin Dashboard Needs:**
- Monitor media content
- Flag inappropriate images

---

### 15. **Admin Features & Moderation**

#### User Management
- ✅ List users with filters (status, plan, verified, practice level)
- ✅ Search by name/email
- ✅ View user details
- ✅ Set user status (active, pending, suspended, banned)
- ✅ View verification status
- ✅ Review/approve verification submissions

#### Moderation
- ✅ Audit log (all admin actions)
- ✅ Real-time admin feed (signups, verifications, reports)
- ✅ Message flagging for inappropriate content
- ✅ User reporting system

#### Ads Management
- ✅ Upload ads (Basic/Premium tiers)
- ✅ Ad scheduling
- ✅ View ad impressions

#### Dashboard Admin Controls (Needed)
- ✅ User creation / soft-delete
- ✅ Admin messaging to users
- ✅ User profile editing
- ✅ Password reset
- ✅ Manual swipe/like reset

---

## Admin Dashboard Required Features

### Core Admin Sections

#### 1. **Dashboard Overview**
- Total users, active users, new signups today
- Revenue (total, monthly, by plan)
- Top features used (tasbih, messages, verifications)
- Admin action queue (pending reviews)

#### 2. **User Management**
```
GET /admin/users (with filters)
POST /admin/users (create)
GET /admin/users/:id (view details)
PATCH /admin/users/:id (edit)
PATCH /admin/users/:id/status (suspend/ban/activate)
POST /admin/users/:id/reset-swipes
POST /admin/users/:id/message (send admin message)
```

**Filters:**
- Status (active, pending, suspended, banned)
- Plan (basic, premium, vip)
- Verified (yes/no)
- Prayer frequency
- Search by name/email

**Editable Fields:**
- Name, email, phone
- Profile data (bio, profession, location, etc.)
- Subscription plan override
- Subscription expiry date

#### 3. **Verification Management**
```
GET /admin/users/:id/verification
PATCH /admin/users/:id/verification/phone
PATCH /admin/users/:id/verification/identity
GET /admin/users/:id/verification/documents/:documentId
```

**Dashboard Actions:**
- View pending verifications (queue)
- Preview submitted documents
- Approve/reject with optional reason
- Mark for resubmission
- Track review time SLA

#### 4. **Billing & Transactions**
```
GET /admin/billing/transactions (with filters)
POST /admin/billing/refund/:transactionId
GET /admin/billing/plans
POST /admin/billing/plans (create/edit)
```

**Dashboard Views:**
- Transaction list (filterable by date, user, plan)
- Revenue analytics (charts)
- Churn rate (cancelled subscriptions)
- MRR (monthly recurring revenue)
- Refund requests

#### 5. **Content Moderation**
```
GET /admin/moderation/reports (user reports)
GET /admin/moderation/flagged-messages
POST /admin/moderation/actions (ban user, remove content)
```

**Dashboard Queue:**
- User abuse reports (with attachments)
- Auto-flagged messages
- Real-time admin feed
- Action history

#### 6. **Support & Tickets**
```
GET /admin/support/tickets
PATCH /admin/support/tickets/:id
POST /admin/support/tickets/:id/response
```

**Dashboard:**
- Ticket queue by priority
- Response template library
- Chat interface for ticket replies

#### 7. **Analytics**
```
GET /admin/analytics/users
GET /admin/analytics/engagement
GET /admin/analytics/revenue
```

**Metrics to Track:**
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Churn rate
- Engagement (messages sent, likes given, matches)
- Feature adoption (tasbih, wali, health disclosure)
- Revenue per user

#### 8. **Subscription Plans & Catalog**
```
GET /admin/catalog/plans
POST /admin/catalog/plans
PATCH /admin/catalog/plans/:id
```

**Dashboard Actions:**
- View all plans
- Edit plan name, price, features
- Set likes limit and period (day/month/lifetime)
- Configure feature access
- A/B test different pricing

#### 9. **Notifications & Messages**
```
POST /admin/notifications/send (bulk)
GET /admin/notifications/history
```

**Dashboard:**
- Send bulk notifications with targeting
- View delivery stats
- Message template library
- Notification type limits (throttling)

#### 10. **Ads Management**
```
GET /admin/ads
POST /admin/ads (upload)
PATCH /admin/ads/:id
DELETE /admin/ads/:id
```

**Dashboard:**
- Upload new ads
- Set tiers (Basic/Premium only)
- View impressions/click-through rates
- Schedule ad rotation

---

## API Endpoints Reference

### Authentication & User

```
POST   /auth/signup
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/password-reset
GET    /me
PATCH  /me
DELETE /me
```

### Profile

```
GET    /profile/:userId
PATCH  /profile/me
GET    /profile/me/completeness
GET    /profile/me/onboarding-status
POST   /profile/photos
DELETE /profile/photos/:photoId
POST   /profile/photos/:photoId/set-primary
GET    /profile/photos/private
```

### Verification

```
GET    /verification
POST   /verification/phone
POST   /verification/identity
GET    /verification/documents/:documentId
```

### Dating & Matches

```
GET    /discovery (profiles with filters)
POST   /matches/like
POST   /matches/pass
GET    /matches (mutual matches)
GET    /matches/likes-received
GET    /matches/new-count
```

### Chat & Messaging

```
GET    /chat/conversations
GET    /chat/conversations/:id
POST   /chat/conversations/:id/messages
GET    /chat/conversations/:id/messages
POST   /chat/support (AI chat)
```

### Subscription & Billing

```
GET    /plans
GET    /me/subscription
POST   /billing/checkout
POST   /billing/verify
POST   /billing/cancel
GET    /me/transactions
```

### Notifications

```
GET    /notifications
PATCH  /notifications/:id/read
GET    /inbox
POST   /inbox/reply/:messageId
```

### Admin Endpoints

```
GET    /admin/users
POST   /admin/users
GET    /admin/users/:id
PATCH  /admin/users/:id
PATCH  /admin/users/:id/status
PATCH  /admin/users/:id/verify
GET    /admin/users/:id/verification
PATCH  /admin/users/:id/verification/phone
PATCH  /admin/users/:id/verification/identity
GET    /admin/users/:id/verification/documents/:documentId
POST   /admin/users/:id/message
POST   /admin/users/:id/reset-swipes

GET    /admin/catalog/plans
POST   /admin/catalog/plans
PATCH  /admin/catalog/plans/:id

GET    /admin/moderation/reports
GET    /admin/moderation/flagged-messages

GET    /admin/support/tickets
PATCH  /admin/support/tickets/:id
POST   /admin/support/tickets/:id/response

GET    /admin/analytics/users
GET    /admin/analytics/engagement
GET    /admin/analytics/revenue

GET    /admin/ads
POST   /admin/ads
```

---

## Implementation Status

✅ **Fully Implemented:**
- User authentication & onboarding
- Dating features (home deck, discover, matches)
- Real-time chat with moderation
- Profile management & photos
- Verification system (backend logic complete)
- Subscription & billing
- Prayer times & Qibla
- Tasbih counter with leaderboards
- Health disclosure (3 stages)
- Marriage readiness checklist
- Guardian/Wali system
- Notifications & push
- Support tickets
- Admin user management

⚠️ **Partially Implemented / Needs Enhancement:**
- Admin verification review UI (backend complete, needs dashboard)
- Admin analytics dashboard (API structure exists, needs UI)
- Ads management system (backend minimal, needs full dashboard)
- Support ticket response interface (basic backend, needs ticket dashboard)

🔴 **Missing / Future:**
- Admin dashboard web app (entire UI)
- Advanced analytics & reporting
- User behavior analytics
- Fraud detection system
- Advanced moderation AI
- Custom discount codes system

---

## Recommendations for Admin Dashboard

1. **Priority 1:** User management, verification review, billing admin
2. **Priority 2:** Support ticket dashboard, notifications bulk send
3. **Priority 3:** Analytics & reporting, ads management
4. **Priority 4:** Advanced moderation UI, audit logs

The backend is feature-complete; the admin dashboard UI is the main missing piece.
