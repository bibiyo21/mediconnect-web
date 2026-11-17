import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy notice' };

export default function Page() {
  return (
    <>
      <h1>Privacy notice</h1>
      <p className="notice" role="note">
        This document is being prepared and will be published after legal review. It is not in effect yet.
      </p>
    </>
  );
}
