import Link from "next/link";

import { ChatWindow } from "@/components/chat/chat-window";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto mb-4 flex w-full max-w-4xl items-center justify-between">
        <h1 className="text-xl font-semibold">Chat</h1>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Back
        </Link>
      </div>
      <ChatWindow />
    </main>
  );
}
