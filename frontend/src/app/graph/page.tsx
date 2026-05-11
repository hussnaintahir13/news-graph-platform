import { redirect } from "next/navigation";

export default function GraphRedirect() {
  redirect("/explore?mode=single");
}
