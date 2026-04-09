import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDemoAgentStatus, getDemoStreamLines } from "@/lib/demo-data";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const LIVE_LOG = path.join(DATA_DIR, "agent_live.jsonl");
const STATUS_FILE = path.join(DATA_DIR, "agent_status.json");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const demoLines = getDemoStreamLines();
  const demoStatus = getDemoAgentStatus();

  // Read status
  let status = { status: "idle" };
  try {
    if (fs.existsSync(STATUS_FILE)) {
      status = JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }

  // Read live log from offset
  const lines: object[] = [];
  let newOffset = offset;
  let hasLiveLog = false;
  try {
    if (fs.existsSync(LIVE_LOG)) {
      hasLiveLog = true;
      const content = fs.readFileSync(LIVE_LOG, "utf-8");
      const allLines = content.split("\n").filter(Boolean);
      newOffset = allLines.length;
      const newLines = allLines.slice(offset);

      for (const line of newLines) {
        try {
          const msg = JSON.parse(line);
          // Extract useful info for the frontend
          if (msg.type === "item.completed" && msg.item) {
            const item = msg.item;
            if (item.type === "agent_message" && item.text) {
              lines.push({ type: "text", text: item.text });
            }
            if (item.type === "command_execution") {
              lines.push({
                type: "tool_use",
                tool: "exec_command",
                input: String(item.command || "").slice(0, 500),
              });
              if (item.aggregated_output) {
                lines.push({
                  type: "tool_result",
                  tool_use_id: item.id,
                  text: String(item.aggregated_output).slice(0, 2000),
                });
              }
            }
            if (item.type === "web_search") {
              lines.push({
                type: "tool_use",
                tool: "web_search",
                input: String(item.query || "").slice(0, 500),
              });
            }
          }
          if (msg.type === "assistant" && msg.message?.content) {
            for (const block of msg.message.content) {
              if (block.type === "text" && block.text) {
                lines.push({ type: "text", text: block.text });
              }
              if (block.type === "tool_use") {
                lines.push({
                  type: "tool_use",
                  tool: block.name,
                  input: typeof block.input === "string"
                    ? block.input.slice(0, 500)
                    : JSON.stringify(block.input).slice(0, 500),
                });
              }
            }
          }
          if (msg.type === "tool_result" || (msg.type === "user" && msg.message?.content)) {
            const content = msg.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "tool_result" && block.content) {
                  const text = typeof block.content === "string"
                    ? block.content
                    : JSON.stringify(block.content);
                  lines.push({
                    type: "tool_result",
                    tool_use_id: block.tool_use_id,
                    text: text.slice(0, 2000),
                  });
                }
              }
            }
          }
          if (msg.type === "result") {
            lines.push({ type: "result", result: msg.result?.slice(0, 5000) });
          }
        } catch {
          // skip unparseable lines
        }
      }
    }
  } catch {
    // ignore
  }

  if (!hasLiveLog && lines.length === 0) {
    return NextResponse.json({
      status: demoStatus,
      lines: demoLines.slice(offset),
      offset: demoLines.length,
    });
  }

  return NextResponse.json({
    status,
    lines,
    offset: newOffset,
  });
}
