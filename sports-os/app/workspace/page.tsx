import { redirect } from "next/navigation";

// Keep a single management experience. The legacy workspace URL remains
// compatible, but all users land in the canonical integrated platform.
export default function WorkspaceRedirect() {
  redirect("/platform");
}
