"use client";

import { signIn } from "next-auth/react";

export default function LoginButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button className="primary" type="button" onClick={() => signIn("google", { callbackUrl })}>
      Google アカウントでログイン
    </button>
  );
}
