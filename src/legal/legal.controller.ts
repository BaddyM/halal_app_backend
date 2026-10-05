import { Controller, Get } from '@nestjs/common';

const PRIVACY = [
  { title: 'Information We Collect', body: 'We collect information you provide directly, such as your name, email address, date of birth, location, and profile photos. We also collect usage data including how you interact with profiles, matches, and messages within the app.' },
  { title: 'How We Use Your Information', body: 'Your data is used to provide and improve Halal Connect services, personalise your matching experience, send you relevant notifications, and ensure the safety of our community. We never sell your personal data to advertisers or third parties.' },
  { title: 'Data Sharing', body: 'We share data only with service providers who help us operate the app (e.g. cloud hosting, analytics), and only under strict confidentiality agreements. We may disclose data when required by law.' },
  { title: 'Halal Verification Data', body: 'Identity documents submitted for verification are used for manual review and are accessible only through authorized review workflows. Contact support for questions about a specific submission or applicable retention.' },
  { title: 'Your Rights', body: 'You may request access to, correction of, or deletion of your personal data at any time by contacting halalconnectug@gmail.com. Account deletion is handled through the in-app deletion request process.' },
  { title: 'Cookies & Tracking', body: 'We use minimal analytics to understand app performance. We do not use cross-site tracking cookies and we do not build advertising profiles.' },
  { title: "Children's Privacy", body: 'Halal Connect is intended for users aged 18 and above. We do not knowingly collect data from minors. If we discover a minor has registered, their account and data are deleted immediately.' },
  { title: 'Changes to This Policy', body: 'We may update this policy periodically. We will notify you via in-app notice or email at least 14 days before any material changes take effect.' },
  { title: 'Contact Us', body: 'If you have questions about this policy, please reach out to our Data Protection Officer at halalconnectug@gmail.com or contact Halal Connect through the in-app support section.' },
];

const TERMS = [
  { title: '1. Acceptance of Terms', body: 'By creating an account on Halal Connect, you agree to these Terms of Service and our Privacy Policy. If you do not agree, you may not use our services.' },
  { title: '2. Eligibility', body: 'You must be at least 18 years old and a Muslim to register. By registering, you confirm that the information you provide is truthful and accurate.' },
  { title: '3. Account Responsibilities', body: 'You are responsible for maintaining the confidentiality of your account credentials. Contact support if you suspect unauthorised access.' },
  { title: '4. Prohibited Conduct', body: 'You may not create fake profiles, harass or threaten other users, share explicit or inappropriate content, use the app for commercial solicitation, or attempt to extract personal contact information through deception.' },
  { title: '5. Content You Post', body: 'You retain ownership of content you upload. By posting, you grant Halal Connect a non-exclusive licence to display that content within the app. You are responsible for the content you share.' },
  { title: '6. Subscriptions & Billing', body: 'Prices, payment methods, and available plans are shown in the app from the current server configuration before checkout. Payments are processed by the configured provider. Contact support for billing questions.' },
  { title: '7. Termination', body: 'We reserve the right to suspend or permanently ban accounts that violate these Terms, subject to applicable law.' },
  { title: '8. Disclaimer of Warranties', body: 'Halal Connect is provided on an as-available basis. We do not guarantee that you will find a match or that all users are who they claim to be. Use reasonable caution when communicating with strangers.' },
  { title: '9. Governing Law', body: 'Applicable law and dispute resolution are subject to the terms presented in the current published service agreement and local legal requirements.' },
];

@Controller('legal')
export class LegalController {
  @Get('privacy')
  privacy() {
    return { title: 'Privacy Policy', updatedAt: 'January 1, 2025', intro: 'Your privacy is important to us. This policy explains how Halal Connect collects, uses, and protects your personal information.', sections: PRIVACY };
  }

  @Get('terms')
  terms() {
    return { title: 'Terms of Service', updatedAt: 'January 1, 2025', intro: 'Please read these terms carefully before using Halal Connect. They govern your use of our services.', sections: TERMS };
  }
}