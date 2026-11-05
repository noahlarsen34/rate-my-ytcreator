import { ArrowLeft } from 'lucide-react';

const legalPages = {
  privacy: {
    label: 'PRIVACY', title: 'Privacy Policy',
    intro: 'This policy explains what information Rate My Creator collects, why we use it, and the choices available to you.',
    sections: [
      ['Information we collect', <><p>When you create an account, we may collect your email address, first and last name, username, birthdate, optional phone number, optional gender, and profile image. If you continue with Google, Google provides basic account information such as your name, email address, and profile image. We do not receive your Google password.</p><p>We also collect content you submit, including creator ratings, reviews, disclosures, and votes on reviews. Our service providers may process technical information needed to operate and secure the service, such as authentication records and browser or device information.</p></>],
      ['How we use information', <p>We use this information to create and secure accounts, complete user profiles, display reviews and ratings, personalize account pages, prevent abuse, troubleshoot problems, and improve Rate My Creator.</p>],
      ['How information is shared', <p>Your username, ratings, reviews, and related contributions may be visible to other users. We use Supabase for authentication and database services, Google for Google sign-in, and Vercel to host the application. These providers process information as needed to deliver their services. We do not sell your personal information.</p>],
      ['Data retention and security', <p>We retain account information and contributions while your account is active or as reasonably necessary to operate the service, resolve disputes, and comply with legal obligations. We use reasonable safeguards, including authenticated access and database row-level security, but no online service can guarantee absolute security.</p>],
      ['Your choices', <p>You may update available profile information from your account settings. You may disconnect Rate My Creator from your Google Account through your Google Account permissions. To request access, correction, or deletion of your account information, contact us at <a href="mailto:noahlarsen018@gmail.com">noahlarsen018@gmail.com</a>.</p>],
      ['Children’s privacy', <p>Rate My Creator is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided personal information, please contact us so we can review and remove it where appropriate.</p>],
      ['Changes to this policy', <p>We may update this policy as the service changes. We will post the revised policy here and update the effective date.</p>]
    ]
  },
  terms: {
    label: 'TERMS', title: 'Terms of Service',
    intro: 'These terms govern your use of Rate My Creator. By creating an account or using the service, you agree to these terms.',
    sections: [
      ['Using the service', <p>You must provide accurate account information, keep your account secure, and use Rate My Creator only for lawful purposes. You are responsible for activity performed through your account.</p>],
      ['Reviews and community content', <p>You retain ownership of content you submit. By submitting it, you grant Rate My Creator a non-exclusive, worldwide, royalty-free license to host, display, reproduce, and distribute that content as needed to operate and improve the service. Reviews must reflect honest opinions and must not include harassment, threats, impersonation, unlawful material, spam, or content that violates another person’s rights.</p>],
      ['Moderation', <p>We may review, remove, or restrict content or accounts that violate these terms, create security risks, or harm the community. We are not required to publish or retain every submission.</p>],
      ['Third-party services', <p>Rate My Creator uses services provided by Google, Supabase, and Vercel and may link to YouTube or other third-party websites. Their own terms and privacy policies govern your use of those services, and we are not responsible for third-party content or availability.</p>],
      ['Service availability', <p>The service is provided “as is” and “as available.” We may change, suspend, or discontinue features. To the extent permitted by law, we disclaim implied warranties and are not liable for indirect, incidental, special, or consequential damages arising from use of the service.</p>],
      ['Ending your use', <p>You may stop using the service at any time. We may suspend or terminate access when these terms are violated or when necessary to protect the service and its users.</p>],
      ['Changes and contact', <p>We may update these terms and will post the revised version here with a new effective date. Questions may be sent to <a href="mailto:noahlarsen018@gmail.com">noahlarsen018@gmail.com</a>.</p>]
    ]
  }
};

export function LegalPage({ type, navigate }) {
  const content = legalPages[type];
  return <main className="page legal-page"><button className="back" onClick={() => navigate('home')}><ArrowLeft size={17}/> Back home</button><header className="legal-heading"><span className="kicker">{content.label}</span><h1>{content.title}</h1><p>{content.intro}</p><small>Effective November 4, 2026</small></header><div className="legal-content">{content.sections.map(([title, body]) => <section key={title}><h2>{title}</h2>{body}</section>)}</div></main>;
}
