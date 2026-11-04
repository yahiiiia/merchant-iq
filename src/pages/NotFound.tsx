import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/CRMShared";

export default function NotFound() {
  return <div className="panel my-10"><EmptyState title="This page isn't in your directory" description="The address may be incorrect. Return to your business overview to continue."><Button asChild className="mt-5 h-9 text-xs"><Link to="/">Back to overview</Link></Button></EmptyState></div>;
}
