import { NextResponse } from "next/server";
import { runAssessment } from "@/lib/agent/orchestrator";
import { RiskReportSchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = typeof body.message === "string" ? body.message : "";
    if (!message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    const report = await runAssessment(message);
    const parsed = RiskReportSchema.safeParse(report);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_report", details: parsed.error.flatten() }, { status: 500 });
    }
    return NextResponse.json(parsed.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
