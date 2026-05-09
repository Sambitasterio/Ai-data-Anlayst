"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { ChatWindow } from "@/components/chat/chat-window";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  return (
    <motion.main
      className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
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
    </motion.main>
  );
}
