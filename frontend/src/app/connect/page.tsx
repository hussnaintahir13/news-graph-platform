import { redirect } from "next/navigation";

export default function ConnectRedirect() {
  redirect("/explore?mode=multi");
}
