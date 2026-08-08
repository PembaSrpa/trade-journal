import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { usernameToEmail } from "@/lib/auth";

export async function POST(request: Request) {
  const { username, password, inviteCode } = await request.json();

  if (inviteCode !== process.env.SIGNUP_INVITE_CODE) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
  }

  if (!username || !password || password.length < 8) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const email = usernameToEmail(username);

  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create account" },
      { status: 400 }
    );
  }

  const { error: profileError } = await admin.from("users").insert({
    id: created.user.id,
    username: username.toLowerCase(),
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Could not create account" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
