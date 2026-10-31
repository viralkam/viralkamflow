import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'User Data Deletion Instructions — Karmflow',
  description: 'Step-by-step instructions for deleting your user data and revoking permissions for Karmflow on Meta platforms.',
};

export default function DataDeletionPage() {
  return (
    <div className="legal-page-container">
      <div className="legal-card">
        <header className="legal-header">
          <div className="legal-brand-badge">
            <span>🛡️ Data Privacy & Protection</span>
          </div>
          <h1 className="legal-title">User Data Deletion Instructions</h1>
          <div className="legal-meta">
            <span><strong>App Name:</strong> Karmflow</span>
            <span><strong>Meta App ID:</strong> 2082873572346486</span>
            <span><strong>Contact:</strong> contact.antiviral@gmail.com</span>
          </div>
        </header>

        <main className="legal-content">
          <p>
            At <strong>Karmflow</strong>, we respect your data privacy and give you complete control over your personal information and connected social accounts.
          </p>
          <p>
            According to Meta&apos;s platform policy, we provide clear instructions on how users can delete their activities, disconnect accounts, and permanently purge any stored data associated with the <strong>Karmflow</strong> Facebook, Instagram, or Threads integration.
          </p>

          <div className="legal-highlight-box">
            <strong>Summary:</strong> You can delete your data in any of the following 3 ways: directly through Facebook/Meta settings, inside the Karmflow dashboard, or by emailing our support desk.
          </div>

          <h2>Option 1: Remove Karmflow from Your Facebook Account (Recommended)</h2>
          <p>
            If you wish to remove Karmflow activities and revoke all permissions directly from Meta:
          </p>
          <ol>
            <li>Log in to your Facebook profile and click on your profile picture in the top right corner.</li>
            <li>Select <strong>Settings &amp; Privacy</strong>, then click <strong>Settings</strong>.</li>
            <li>In the left-hand menu, scroll down and click on <strong>Apps and Websites</strong>.</li>
            <li>In the list of active apps, search for <strong>karmflow</strong> (or App ID: <code>2082873572346486</code>).</li>
            <li>Click the <strong>Remove</strong> button next to the app name.</li>
            <li>Check the box if you wish to allow Facebook to notify Karmflow that your authorization has been revoked.</li>
            <li>Confirm by clicking <strong>Remove</strong>. Once removed, Karmflow can no longer access your Facebook or Instagram accounts.</li>
          </ol>

          <h2>Option 2: Delete Directly Inside Karmflow Dashboard</h2>
          <p>
            You can instantly revoke authorization and erase tokens directly from our application:
          </p>
          <ol>
            <li>Log in to your Karmflow dashboard at <a href="https://viralkamflow.vercel.app" style={{ color: '#4f46e5' }}>https://viralkamflow.vercel.app</a>.</li>
            <li>Navigate to the <Link href="/connect" style={{ color: '#4f46e5', fontWeight: 600 }}>Connect Accounts</Link> page.</li>
            <li>Find your connected Facebook Page, Instagram Account, or Threads profile.</li>
            <li>Click the <strong>Disconnect</strong> / <strong>Delete</strong> button.</li>
            <li>This action immediately wipes your OAuth access tokens and account linkage from our database.</li>
          </ol>

          <h2>Option 3: Request Complete Database Erasure via Email</h2>
          <p>
            If you want us to completely erase all records, scheduled posts, analytics history, and logs associated with your account from all our servers:
          </p>
          <ol>
            <li>Send an email to: <a href="mailto:contact.antiviral@gmail.com" style={{ color: '#4f46e5', fontWeight: 600 }}>contact.antiviral@gmail.com</a></li>
            <li>Use the subject line: <code>Data Deletion Request - Karmflow</code></li>
            <li>Provide your connected Facebook Page ID, Instagram Username, or the registered email address.</li>
            <li>Our team will verify your identity and permanently delete all your data within <strong>48 hours</strong>. You will receive a confirmation email once the deletion is complete.</li>
          </ol>

          <div className="legal-highlight-box success">
            <strong>Need Help?</strong><br />
            If you have any difficulty revoking access or need verification of data removal, feel free to contact us anytime at <a href="mailto:contact.antiviral@gmail.com" style={{ color: '#166534', fontWeight: 600 }}>contact.antiviral@gmail.com</a>.
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
