import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function HeroCard() {
  return (
    <Card className="border-border/70 bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl">AI Data Analyst</CardTitle>
        <ThemeToggle />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">
            Talk to your data in plain English.
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Upload CSV/Excel files, ask natural-language questions, and get
            tables, charts, and generated SQL/Python in one workflow.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Try: Which product had highest growth in Q4?"
            readOnly
            className="h-11"
          />
          <Link
            href="/chat"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 px-6"
            )}
          >
            Get Started
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
