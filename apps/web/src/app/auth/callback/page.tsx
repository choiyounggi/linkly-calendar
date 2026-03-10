"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setToken(token);
      router.replace("/main");
    } else {
      router.replace("/");
    }
  }, [searchParams, setToken, router]);

  return <p>로그인 처리 중...</p>;
}

export default function AuthCallbackPage() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <Suspense fallback={<p>로딩 중...</p>}>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
