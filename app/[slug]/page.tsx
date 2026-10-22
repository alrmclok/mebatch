import { Suspense } from "react";
import Window from "@/components/Window";
import BatchView from "./BatchView";

async function Inner({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BatchView slug={decodeURIComponent(slug).toLowerCase()} />;
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<Window><p className="text-center">Looking for it…</p></Window>}>
      <Inner params={params} />
    </Suspense>
  );
}