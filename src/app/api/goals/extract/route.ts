import { NextResponse } from "next/server";
import { friendlyError, scanInput } from "@/lib/planner";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const text = String(form.get("text") ?? "").trim();
    const image = form.get("image");

    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;

    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith("image/")) {
        return NextResponse.json({ error: "Please upload an image." }, { status: 400 });
      }
      if (image.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Image must be smaller than 5 MB." }, { status: 400 });
      }
      // Held in memory only. The photo is never written to disk.
      imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
      imageMimeType = image.type;
    }

    if (!text && !imageBase64) {
      return NextResponse.json({ error: "Enter goals or select an image." }, { status: 400 });
    }

    const goals = await scanInput({ text, imageBase64, imageMimeType });
    return NextResponse.json({ goals });
  } catch (error) {
    console.error("Goal extraction failed:", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
  }
}
