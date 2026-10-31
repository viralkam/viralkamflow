import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — Karmflow',
  description: 'Privacy Policy and data protection terms for Karmflow social media management platform.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="legal-page-container">
      <div className="legal-card">
        <header className="legal-header">
          <div className="legal-brand-badge">
            <span>⚡ Karmflow Platform</span>
          </div>
          <h1 className="legal-title">Privacy Policy</h1>
          <div className="legal-meta">
            <span><strong>Effective Date:</strong> October 31, 2026</span>
            <span><strong>Last Updated:</strong> October 31, 2026</span>
            <span><strong>App ID:</strong> 2082873572346486</span>
          </div>
        </header>

        <main className="legal-content">
          <p>
            Welcome to <strong>Karmflow</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how our application connects to social media platforms (including Meta Facebook, Instagram, and Threads APIs), what data we collect, how it is used, and how you can exercise full control over your information.
          </p>

          <div className="legal-highlight-box">
            <strong>Key Principle:</strong> Karmflow only accesses your social media accounts with your explicit permission via official OAuth protocols to publish content, manage posts, and handle auto-replies that you configure. We never sell, rent, or trade your personal data.
          </div>

          <h2>1. Information We Collect</h2>
          <p>When you use Karmflow, we may access and process the following categories of information:</p>
          <ul>
            <li>
              <strong>Account & Profile Information:</strong> Your Facebook Page name, Page ID, Instagram Creator/Business account username, Instagram Account ID, Threads username, profile pictures, and contact email address (<code>contact.antiviral@gmail.com</code>).
            </li>
            <li>
              <strong>Authentication & Access Tokens:</strong> Secure OAuth access tokens granted by you during authorization. These tokens allow Karmflow to perform actions on your behalf (such as scheduling posts or reading incoming comments for configured auto-replies).
            </li>
            <li>
              <strong>Content & Scheduling Data:</strong> Media URLs, captions, publishing schedules, and timestamps of posts you choose to upload and distribute through the platform.
            </li>
            <li>
              <strong>Comment & Interaction Data:</strong> Incoming comments on your authorized Facebook and Instagram posts, used solely to trigger automated responses or comment moderation according to rules you define in your dashboard.
            </li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We process your information strictly for the following purposes:</p>
          <ul>
            <li>To authenticate your identity and connect your social media profiles via official Meta APIs.</li>
            <li>To schedule and automatically publish your approved posts, reels, photos, and threads.</li>
            <li>To scan incoming post comments and send real-time automated direct messages or comment replies per your customized rules.</li>
            <li>To monitor publishing success, error handling, and token expiration to keep your accounts seamlessly connected.</li>
          </ul>

          <h2>3. Meta (Facebook, Instagram & Threads) Data Usage</h2>
          <p>
            Karmflow strictly complies with the <a href="https://developers.facebook.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5' }}>Meta Developer Platform Terms</a> and Data Use Policies.
          </p>
          <ul>
            <li>We only request permissions that are directly necessary for core features (e.g., <code>pages_show_list</code>, <code>pages_manage_posts</code>, <code>instagram_business_basic</code>, <code>instagram_business_content_publish</code>, <code>instagram_business_manage_comments</code>, <code>threads_content_publish</code>).</li>
            <li>Meta user tokens are encrypted at rest and in transit.</li>
            <li>We do not transfer or disclose any data received through Meta APIs to third-party ad networks, data brokers, or independent analytics providers.</li>
          </ul>

          <h2>4. Data Storage and Security</h2>
          <p>
            We implement industry-standard security protocols to protect your personal information and API tokens against unauthorized access, loss, or alteration. All communications between your browser, our servers, and Meta APIs are secured using HTTPS and SSL/TLS encryption.
          </p>

          <h2>5. Data Retention & User Data Deletion Rights</h2>
          <p>
            We retain your data only for as long as your Karmflow account is active. You have full control over your data at any time:
          </p>
          <ul>
            <li>
              <strong>Disconnect Accounts:</strong> You can disconnect your social media accounts directly from the <Link href="/connect" style={{ color: '#4f46e5' }}>Connect Accounts</Link> section at any time, which immediately deletes stored access tokens.
            </li>
            <li>
              <strong>Revoke via Meta:</strong> You can revoke permissions directly inside your Facebook or Instagram App settings (Settings &gt; Apps and Websites &gt; Karmflow &gt; Remove).
            </li>
            <li>
              <strong>Request Immediate Deletion:</strong> You can request full data deletion by visiting our <Link href="/data-deletion" style={{ color: '#4f46e5', fontWeight: 600 }}>Data Deletion Instructions</Link> or emailing us directly at <code>contact.antiviral@gmail.com</code>. We process complete deletion within 48 hours.
            </li>
          </ul>

          <h2>6. Children&apos;s Privacy</h2>
          <p>
            Our services are not intended for individuals under the age of 13 (or 16 in certain jurisdictions). We do not knowingly collect personal information from children.
          </p>

          <h2>7. Updates to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our service or legal requirements. Updates will be posted on this page with an updated &quot;Last Updated&quot; date.
          </p>

          <h2>8. Contact Information</h2>
          <p>
            If you have any questions, concerns, or requests regarding this Privacy Policy or your data privacy, please contact our support team at:
          </p>
          <div className="legal-highlight-box success">
            <strong>Contact & Support:</strong><br />
            Email: <a href="mailto:contact.antiviral@gmail.com" style={{ color: '#166534', fontWeight: 600 }}>contact.antiviral@gmail.com</a><br />
            Application: Karmflow (<a href="https://viralkamflow.vercel.app" style={{ color: '#166534' }}>https://viralkamflow.vercel.app</a>)<br />
            Meta App ID: 2082873572346486
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
