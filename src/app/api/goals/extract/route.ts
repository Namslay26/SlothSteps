
import { NextResponse } from "next/server";
import { extractGoals } from "@/lib/agent";

//export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const text = String(form.get("text") ?? "").trim();
    const image = form.get("image");

    let imageBase64: string | undefined;

    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Please upload an image." },
          { status: 400 }
        );
      }

      if (image.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image must be smaller than 5 MB." },
          { status: 400 }
        );
      }

      imageBase64 = Buffer.from(
        await image.arrayBuffer()
      ).toString("base64");
    }

    if (!text && !imageBase64) {
      return NextResponse.json(
        { error: "Enter goals or select an image." },
        { status: 400 }
      );
    }

    const goals = await extractGoals({ text, imageBase64 });

    return NextResponse.json({ goals });
  } catch (error) {
    console.error("Goal extraction failed", error);
    return NextResponse.json(
      { error: "Extraction failed. Please try again." },
      { status: 500 }
    );
  }
}
