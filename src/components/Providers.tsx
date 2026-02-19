'use client'

import Navbar from "@/components/Navbar";
import ActionModalProvider from "@/components/ActionModalProvider";
import { AuthProvider } from "@/context/AuthContext";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ActionModalProvider>
        <div className="pb-32">{children}</div>
        <Navbar />
      </ActionModalProvider>
    </AuthProvider>
  );
}

