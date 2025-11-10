import ProfileClient from "@/components/user-profile/ProfileClient";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Next.js Profile | Cosmorigin Admin - Next.js Dashboard Template",
  description:
    "This is Next.js Profile page for Cosmorigin Admin - Next.js Tailwind CSS Admin Dashboard Template",
};

export default function Profile() {
  return (
    <ProfileClient />
  );
}
