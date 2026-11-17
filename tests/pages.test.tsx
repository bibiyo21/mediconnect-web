import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from '@/app/page';
import PrivacyPage from '@/app/privacy/page';
import { securityHeaders } from '../next.config';

describe('public site shell', () => {
  it('states plainly that search and booking are not available yet', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByRole('note').textContent).toMatch(/not available yet/);
  });

  it('marks legal pages as drafts pending legal review', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('note').textContent).toMatch(/after legal review/);
  });

  it('sends the security headers', () => {
    const keys = securityHeaders.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(['Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy']));
  });
});
