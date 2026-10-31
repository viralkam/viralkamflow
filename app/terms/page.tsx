import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — Karmflow',
  description: 'Terms of Service for using Karmflow social media management and publishing platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="legal-page-container">
      <div className="legal-card">
        <header className="legal-header">
          <div className="legal-brand-badge">
            <span>📜 Legal Terms</span>
          </div>
          <h1 className="legal-title">Terms of Service</h1>
          <div className="legal-meta">
            <span><strong>Effective Date:</strong> October 31, 2026</span>
            <span><strong>Last Updated:</strong> October 31, 2026</span>
            <span><strong>App ID:</strong> 2082873572346486</span>
          </div>
        </header>

        <main className="legal-content">
          <p>
            Welcome to <strong>Karmflow</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By accessing or using our application, website (<a href="https://viralkamflow.vercel.app" style={{ color: '#4f46e5' }}>https://viralkamflow.vercel.app</a>), and services, you agree to be bound by these Terms of Service.
          </p>

          <h2>1. Description of Service</h2>
          <p>
            Karmflow provides tools for social media creators and businesses to connect their authorized Facebook Pages, Instagram Professional accounts, and Threads accounts to schedule posts, manage multimedia publishing, track engagement, and configure automated comment-to-DM or comment responses.
          </p>

          <h2>2. Meta Platform Compliance</h2>
          <p>
            By connecting any Facebook, Instagram, or Threads account to Karmflow, you acknowledge and agree that your use of our service is also subject to Meta&apos;s applicable terms, including the <a href="https://www.facebook.com/terms.php" target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5' }}>Meta Terms of Service</a> and the <a href="https://developers.facebook.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5' }}>Meta Platform Terms</a>.
          </p>
          <p>
            You agree not to use Karmflow to transmit spam, unsolicited commercial messages, misleading content, or engage in any activity that violates Meta Community Standards.
          </p>

          <h2>3. User Responsibilities & Content Ownership</h2>
          <p>
            You retain full copyright and ownership of all content, images, videos, captions, and text that you upload and publish through Karmflow. You represent and warrant that you own or have obtained all necessary licenses, permissions, and rights to distribute the content you publish.
          </p>

          <h2>4. Account Security</h2>
          <p>
            You are responsible for maintaining the confidentiality of your credentials and access tokens. You agree to notify us immediately at <code>contact.antiviral@gmail.com</code> if you suspect any unauthorized access to your account.
          </p>

          <h2>5. Disclaimers & Limitation of Liability</h2>
          <p>
            Karmflow is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. We are not liable for any disruptions, delays, or failures resulting from third-party social media platform downtime, API deprecations, rate limits, or account restrictions imposed by Meta.
          </p>

          <h2>6. Termination</h2>
          <p>
            You may terminate your agreement with us at any time by disconnecting your social media accounts and discontinuing your use of the service. We reserve the right to suspend or terminate accounts that violate these terms.
          </p>

          <h2>7. Contact Us</h2>
          <p>
            If you have any questions about these Terms of Service, please reach out to us at:
          </p>
          <div className="legal-highlight-box success">
            Email: <a href="mailto:contact.antiviral@gmail.com" style={{ color: '#166534', fontWeight: 600 }}>contact.antiviral@gmail.com</a><br />
            Website: <a href="https://viralkamflow.vercel.app" style={{ color: '#166534' }}>https://viralkamflow.vercel.app</a>
          </div>
        </main>

        <footer className="legal-footer">
          <div>&copy; {new Date().getFullYear()} Karmflow. All rights reserved.</div>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/data-deletion">Data Deletion</Link>
            <Link href="/dashboard">Back to App</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
