// src/app/api/auth/firebase/route.ts — Firebase Auth → DeskRPG JWT bridge
// Accepts a Firebase ID token, verifies it, and creates/links a local user.
import { db, groupMembers, groups, isPostgres, users } from "@/db";
import { verifyFirebaseToken } from "@/lib/firebase-admin-verify";
import { hashPassword } from "@/lib/password";
import { signJWT, isSecureCookie } from "@/lib/jwt";
import { buildBootstrapActions, resolveBootstrapCompletion } from "@/lib/rbac/bootstrap";
import { createStarterProjectForUser } from "@/lib/builtin-projects";
import { seedBuiltinTemplates } from "@/lib/builtin-templates";
import { NextRequest, NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { idToken } = body;

  if (!idToken) {
    return NextResponse.json(
      { errorCode: "firebase_token_required", error: "Firebase ID token is required" },
      { status: 400 },
    );
  }

  // 1. Verify the Firebase ID token
  const firebaseUser = await verifyFirebaseToken(idToken);
  if (!firebaseUser) {
    return NextResponse.json(
      { errorCode: "firebase_token_invalid", error: "Firebase ID token is invalid or expired" },
      { status: 401 },
    );
  }

  const { uid, email, name, picture } = firebaseUser;
  const provider = firebaseUser.firebase?.sign_in_provider || "unknown";

  // 2. Generate a deterministic loginId from Firebase UID
  const firebaseLoginId = `firebase:${uid}`;

  // 3. Check if this Firebase user already exists in local DB
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.loginId, firebaseLoginId))
    .limit(1);

  if (existingUser) {
    // User exists — just issue a JWT
    const token = await signJWT({ userId: existingUser.id, nickname: existingUser.nickname });
    const response = NextResponse.json({
      user: { id: existingUser.id, nickname: existingUser.nickname },
      isNewUser: false,
    });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: isSecureCookie(),
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  }

  // 4. New Firebase user — create local account
  // Generate a nickname from Firebase profile or email
  let nickname =
    name ||
    (email ? email.split("@")[0] : `user_${uid.slice(0, 8)}`);

  // Ensure nickname uniqueness (max 50 chars)
  nickname = nickname.slice(0, 45);
  const [nicknameConflict] = await db
    .select()
    .from(users)
    .where(eq(users.nickname, nickname))
    .limit(1);
  if (nicknameConflict) {
    nickname = `${nickname}_${randomUUID().slice(0, 4)}`;
  }

  // Use a random password hash since Firebase manages auth
  const passwordHash = await hashPassword(randomUUID());

  const [{ value: userCount }] = await db.select({ value: count() }).from(users);

  const [createdUser] = await db
    .insert(users)
    .values({
      loginId: firebaseLoginId,
      nickname,
      passwordHash,
      systemRole: "user",
    })
    .returning();

  // 5. Bootstrap logic (first user becomes admin, gets default group)
  const bootstrap = buildBootstrapActions({
    existingUserCount: Number(userCount),
    userId: createdUser.id,
    loginId: firebaseLoginId,
  });

  let defaultGroupCreated = false;
  let createdGroupId: string | null = null;

  if (bootstrap.createDefaultGroup && bootstrap.defaultGroup) {
    const insertedGroups = await db
      .insert(groups)
      .values({
        ...bootstrap.defaultGroup,
        createdBy: createdUser.id,
      })
      .onConflictDoNothing({ target: groups.slug })
      .returning();

    const createdGroup = insertedGroups[0];
    defaultGroupCreated = Boolean(createdGroup);
    createdGroupId = createdGroup?.id ?? null;
  }

  const completion = resolveBootstrapCompletion({ bootstrap, defaultGroupCreated });

  if (completion.systemRole === "system_admin") {
    await db
      .update(users)
      .set({ systemRole: completion.systemRole })
      .where(eq(users.id, createdUser.id));
  }

  if (completion.createGroupMembership && createdGroupId && bootstrap.groupMembership) {
    await db.insert(groupMembers).values({
      groupId: createdGroupId,
      userId: bootstrap.groupMembership.userId,
      role: bootstrap.groupMembership.role,
      approvedBy: createdUser.id,
      approvedAt: (isPostgres ? new Date() : new Date().toISOString()) as unknown as Date,
    });
  }

  // Auto-join default group for non-first users
  if (!completion.createGroupMembership) {
    const [defaultGroup] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.isDefault, true))
      .limit(1);

    if (defaultGroup) {
      await db
        .insert(groupMembers)
        .values({
          groupId: defaultGroup.id,
          userId: createdUser.id,
          role: "member",
          approvedBy: createdUser.id,
          approvedAt: (isPostgres ? new Date() : new Date().toISOString()) as unknown as Date,
        })
        .onConflictDoNothing();
    }
  }

  try {
    await seedBuiltinTemplates();
  } catch (error) {
    console.warn("Failed to seed builtin templates:", error);
  }

  try {
    await createStarterProjectForUser(createdUser.id);
  } catch (error) {
    console.warn("Failed to create starter project:", error);
  }

  const user = { ...createdUser, systemRole: completion.systemRole };
  const token = await signJWT({ userId: user.id, nickname: user.nickname });

  const response = NextResponse.json({
    user: { id: user.id, nickname: user.nickname },
    isNewUser: true,
    provider,
  });
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
