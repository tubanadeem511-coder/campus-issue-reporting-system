
import { categories, jsonError, statuses } from "@/lib/supabase";
import {
  authenticatedUser,
  requireAdmin,
} from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

const bucket = "complaint-images";
const maxImageSize = 5 * 1024 * 1024;

type Row = {
  id: string;
  reference_number: string;
  title: string;
  category: string;
  location: string;
  building: string | null;
  room: string | null;
  description: string;
  image_path: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  owner_id?: string;
  user_id?: string;
  image_url?: string | null;
};

async function imageUrls(client: SupabaseClient, rows: Row[]) {
  const paths = rows.flatMap((row) =>
    row.image_path ? [row.image_path] : []
  );

  if (!paths.length) {
    return rows.map((row) => ({ ...row, image_url: null }));
  }

  const result = await client.storage
    .from(bucket)
    .createSignedUrls(paths, 300);

  const urls = new Map(
    (result.data ?? []).map((item) => [item.path, item.signedUrl])
  );

  return rows.map((row) => ({
    ...row,
    image_url: row.image_path
      ? urls.get(row.image_path) ?? null
      : null,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adminMode = searchParams.get("scope") === "admin";

  const auth = adminMode
    ? await requireAdmin(request)
    : await authenticatedUser(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const building = searchParams.get("building");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q")?.trim().replace(/[,%()]/g, " ");

  const rows: Row[] = [];

  for (let offset = 0; ; offset += 1000) {
    let query = auth.client
      .from("complaints")
      .select(
        "id,reference_number,title,category,location,building,room,description,image_path,status,created_at,updated_at"
      )
      .order("created_at", { ascending: false });

    if (!adminMode) {
      query = query.eq("owner_id", auth.user.id);
    }

    if (status && statuses.includes(status as never)) {
      query = query.eq("status", status);
    }

    if (category && categories.includes(category as never)) {
      query = query.eq("category", category);
    }

    if (building) {
      query = query.ilike("building", `%${building}%`);
    }

    if (from) {
      query = query.gte("created_at", `${from}T00:00:00.000Z`);
    }

    if (to) {
      query = query.lt("created_at", `${to}T23:59:59.999Z`);
    }

    if (q) {
      query = query.or(
        `reference_number.ilike.%${q}%,title.ilike.%${q}%,location.ilike.%${q}%,building.ilike.%${q}%,room.ilike.%${q}%`
      );
    }

    const { data, error } = await query.range(offset, offset + 999);

    if (error) {
      console.error("Load complaints failed:", error);
      return jsonError(
        "Could not load complaints. Check database migration and RLS.",
        502
      );
    }

    rows.push(...((data ?? []) as Row[]));

    if (!data || data.length < 1000) break;
  }

  const complaints = await imageUrls(auth.client, rows);

  const counts = Object.fromEntries(
    statuses.map((s) => [
      s,
      rows.filter((row) => row.status === s).length,
    ])
  );

  const byCategory = Object.fromEntries(
    categories.map((c) => [
      c,
      rows.filter((row) => row.category === c).length,
    ])
  );

  return Response.json(
    { complaints, total: rows.length, counts, byCategory },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const auth = await authenticatedUser(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const form = await request.formData().catch(() => null);

  if (!form) {
    return jsonError("Could not read the complaint form.");
  }

  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const building = String(form.get("building") ?? "").trim();
  const room = String(form.get("room") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  if (
    title.length < 3 ||
    title.length > 120 ||
    !categories.includes(category as never) ||
    building.length < 1 ||
    building.length > 120 ||
    room.length < 1 ||
    room.length > 80 ||
    description.length < 10 ||
    description.length > 3000
  ) {
    return jsonError("Check all required fields and their length limits.");
  }

  // Required database column: location
  const location = [building, room].filter(Boolean).join(", ");

  const file = form.get("image");
  let imagePath: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > maxImageSize) {
      return jsonError("Images must be no larger than 5 MB.");
    }

    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const extension = extensions[file.type];

    if (!extension) {
      return jsonError("Choose a JPG, PNG, or WebP image.");
    }

    const bytes = new Uint8Array(
      await file.slice(0, 12).arrayBuffer()
    );

    const valid =
      file.type === "image/jpeg"
        ? bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes[2] === 255
        : file.type === "image/png"
          ? bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

    if (!valid) {
      return jsonError("The selected file is not a valid image.");
    }

    imagePath = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await auth.client.storage
      .from(bucket)
      .upload(imagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Image upload failed:", uploadError);
      return jsonError(
        "Image upload failed. Check the private bucket setup.",
        502
      );
    }
  }

  const { data, error } = await auth.client
    .from("complaints")
    .insert({
      user_id: auth.user.id,
      owner_id: auth.user.id,
      title,
      category,
      location,
      building,
      room,
      description,
      image_path: imagePath,
      status: "Pending",
    })
    .select("id,reference_number")
    .single();

  if (error || !data) {
    console.error("Complaint insert failed:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

    if (imagePath) {
      await auth.client.storage.from(bucket).remove([imagePath]);
    }

    return jsonError(
      error?.message ?? "Could not save complaint.",
      502
    );
  }

  return Response.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: string;
  } | null;

  if (!body?.id || !statuses.includes(body.status as never)) {
    return jsonError("Provide a valid complaint and status.");
  }

  const { data, error } = await auth.client
    .from("complaints")
    .update({ status: body.status })
    .eq("id", body.id)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Update complaint failed:", error);
    return jsonError("Could not update complaint status.", 502);
  }

  return Response.json({ success: true });
}