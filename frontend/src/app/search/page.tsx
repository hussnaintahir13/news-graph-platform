import { redirect } from "next/navigation";

export default function SearchRedirect() {
  redirect("/library?mode=keyword");
}
