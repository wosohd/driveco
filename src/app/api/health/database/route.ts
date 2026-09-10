import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const {
      error,
    } = await supabaseAdmin
      .from("applications")
      .select("id")
      .limit(1);

    if (error) {
      console.error(
        "Database health check failed:",
        error.message,
      );

      return NextResponse.json(
        {
          ok: false,
          database: "unavailable",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      database: "connected",
    });
  } catch (error) {
    console.error(
      "Unexpected database health check error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        database: "unavailable",
      },
      {
        status: 500,
      },
    );
  }
}