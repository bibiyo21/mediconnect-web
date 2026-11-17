import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of use' };

export default function Page() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="notice" role="note">
        This document is being prepared and will be published after legal review. It is not in effect yet.
      </p>
    </>
  );
}
