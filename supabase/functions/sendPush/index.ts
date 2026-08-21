// DiskieReels notification dispatcher.
// Deploy: supabase functions deploy sendPush --no-verify-jwt

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Json = Record<string, unknown>;
type NotificationRow = {
  id: string;
  user_id: string;
  actor_id?: string | null;
  video_id?: string | null;
  comment_id?: string | null;
  conversation_id?: string | null;
  message_id?: string | null;
  type: string;
  message?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const oneSignalKey = Deno.env.get("ONESIGNAL_REST_API_KEY")!;
  const appId = Deno.env.get("ONESIGNAL_APP_ID") ?? "1f015029-2aa3-41db-894d-9aa14c50b11d";

  try {
    if (!supabaseUrl || !serviceKey || !oneSignalKey) {
      throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ONESIGNAL_REST_API_KEY are required");
    }

    const input = await req.json() as Json;
    const notification = await loadNotification(supabaseUrl, serviceKey, input);
    const eventType = normalizeType(notification.type);
    const dedupeKey = [
      eventType,
      notification.user_id,
      notification.actor_id ?? "",
      notification.video_id ?? "",
      notification.comment_id ?? "",
      notification.conversation_id ?? "",
    ].join(":");
    const logBase = {
      notification_id: notification.id,
      user_id: notification.user_id,
      event_type: eventType,
      dedupe_key: dedupeKey,
    };

    const preference = await firstRow(supabaseUrl, serviceKey,
      `notification_preferences?user_id=eq.${notification.user_id}&select=*`);
    const preferenceColumn = preferenceFor(eventType);
    if (preference && (preference.push_enabled === false || preference[preferenceColumn] === false)) {
      await writeLog(supabaseUrl, serviceKey, { ...logBase, status: "suppressed", response_body: { reason: "user_preference", preference: preferenceColumn } });
      console.log(JSON.stringify({ stage: "suppressed", reason: "user_preference", ...logBase }));
      return json({ success: true, suppressed: true, reason: "user_preference" });
    }

    const duplicate = await firstRow(supabaseUrl, serviceKey,
      `notification_delivery_logs?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&status=in.(queued,sent)&created_at=gte.${encodeURIComponent(new Date(Date.now() - 300000).toISOString())}&select=id,status,created_at&order=created_at.desc&limit=1`);
    if (duplicate) {
      await writeLog(supabaseUrl, serviceKey, { ...logBase, status: "suppressed", response_body: { reason: "duplicate", previous: duplicate } });
      console.log(JSON.stringify({ stage: "suppressed", reason: "duplicate", ...logBase }));
      return json({ success: true, suppressed: true, reason: "duplicate" });
    }

    const recent = await rows(supabaseUrl, serviceKey,
      `notification_delivery_logs?user_id=eq.${notification.user_id}&status=eq.sent&created_at=gte.${encodeURIComponent(new Date(Date.now() - 600000).toISOString())}&select=id&limit=13`);
    if (recent.length >= 12) {
      await writeLog(supabaseUrl, serviceKey, { ...logBase, status: "suppressed", response_body: { reason: "rate_limit", window_seconds: 600, limit: 12 } });
      console.log(JSON.stringify({ stage: "suppressed", reason: "rate_limit", ...logBase }));
      return json({ success: true, suppressed: true, reason: "rate_limit" });
    }

    const [actor, video, template] = await Promise.all([
      notification.actor_id ? firstRow(supabaseUrl, serviceKey, `profiles?id=eq.${notification.actor_id}&select=id,username,full_name,avatar_url`) : null,
      notification.video_id ? firstRow(supabaseUrl, serviceKey, `videos?id=eq.${notification.video_id}&select=id,title,description,thumbnail_url`) : null,
      loadTemplate(supabaseUrl, serviceKey, eventType),
    ]);
    const actorName = String(actor?.username ?? actor?.full_name ?? "Someone");
    const reelTitle = String(video?.title ?? video?.description ?? "your reel");
    const values = {
      actor: actorName,
      reel_title: reelTitle,
      comment: String(notification.message ?? ""),
    };
    const defaults = defaultTemplate(eventType);
    const title = cleanTemplateLeaks(render(String(template?.title_template ?? defaults.title), values), values);
    const body = cleanTemplateLeaks(render(String(template?.body_template ?? defaults.body), values), values);
    const route = deepLinkRoute(notification, eventType);
    const appUrl = `diskiereels://open${route}`;
    const thumbnailUrl = publicHttps(String(video?.thumbnail_url ?? ""));
    const actorAvatarUrl = publicHttps(String(actor?.avatar_url ?? ""));
    const data = {
      notification_id: notification.id,
      type: eventType,
      actor_id: notification.actor_id ?? "",
      video_id: notification.video_id ?? "",
      comment_id: notification.comment_id ?? "",
      conversation_id: notification.conversation_id ?? "",
      message_id: notification.message_id ?? "",
      url: route,
      deep_link: route,
    };
    const payload: Json = {
      app_id: appId,
      target_channel: "push",
      include_aliases: { external_id: [notification.user_id] },
      headings: { en: title },
      contents: { en: body },
      data,
      url: appUrl,
      small_icon: "ic_stat_onesignal_default",
      large_icon: actorAvatarUrl || "ic_onesignal_large_icon_default",
      android_group: `diskie-${eventType}`,
      collapse_id: dedupeKey.slice(0, 64),
      priority: 10,
      android_accent_color: "22A04A",
    };

    if (thumbnailUrl && isReelEvent(eventType)) {
      payload.big_picture = thumbnailUrl;
      payload.chrome_web_image = thumbnailUrl;
      payload.ios_attachments = { id1: thumbnailUrl };
    }

    await writeLog(supabaseUrl, serviceKey, { ...logBase, status: "queued", request_body: payload });
    console.log(JSON.stringify({ stage: "onesignal_request", ...logBase, title, route, has_thumbnail: Boolean(thumbnailUrl), has_actor_icon: Boolean(actorAvatarUrl) }));
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { Authorization: `Key ${oneSignalKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();
    const responseBody = parseJson(responseText);
    const providerId = typeof responseBody === "object" && responseBody ? String((responseBody as Json).id ?? "") : "";
    await writeLog(supabaseUrl, serviceKey, {
      ...logBase,
      status: response.ok ? "sent" : "failed",
      provider_id: providerId || null,
      response_code: response.status,
      response_body: responseBody,
    });
    console.log(JSON.stringify({ stage: "onesignal_response", status: response.status, provider_id: providerId, ...logBase, response: responseBody }));
    if (!response.ok) return json({ error: "OneSignal rejected the notification", status: response.status, details: responseBody }, 502);
    return json({ success: true, provider_id: providerId, route, response: responseBody });
  } catch (error) {
    console.error(JSON.stringify({ stage: "fatal", error: error instanceof Error ? error.message : String(error) }));
    return json({ error: error instanceof Error ? error.message : "Notification dispatch failed" }, 500);
  }
});

async function loadNotification(url: string, key: string, input: Json): Promise<NotificationRow> {
  if (input.id) {
    const row = await firstRow(url, key, `notifications?id=eq.${input.id}&select=id,user_id,actor_id,video_id,comment_id,conversation_id,message_id,type,message`);
    if (!row) throw new Error(`Notification ${input.id} was not found`);
    return row as unknown as NotificationRow;
  }
  if (!input.user_id || !input.type) throw new Error("id, or user_id plus type, is required");
  return input as unknown as NotificationRow;
}

async function loadTemplate(url: string, key: string, eventType: string) {
  const pushTemplate = await firstRow(url, key, `push_templates?event_type=eq.${eventType}&enabled=eq.true&select=*`);
  if (pushTemplate) return pushTemplate;
  return firstRow(url, key, `notification_templates?event_type=eq.${eventType}&enabled=eq.true&select=*`);
}

function normalizeType(type: string) {
  if (type === "new_follower") return "follow";
  if (type === "comment_reply") return "reply";
  return String(type ?? "notification");
}
function preferenceFor(type: string) {
  return ({
    follow: "follows_enabled",
    like: "likes_enabled",
    comment: "comments_enabled",
    reply: "replies_enabled",
    new_video: "new_videos_enabled",
    share: "shares_enabled",
    save: "saves_enabled",
    message: "messages_enabled",
    star_gift: "star_gifts_enabled",
    mention: "mentions_enabled",
    tag: "tags_enabled",
  } as Record<string, string>)[type] ?? "push_enabled";
}
function defaultTemplate(type: string) {
  return ({
    follow: { title: "New follower", body: "{actor} started following you." },
    like: { title: "New like", body: "{actor} liked your reel." },
    comment: { title: "New comment", body: "{actor} commented on your reel." },
    reply: { title: "New reply", body: "{actor} replied to your comment." },
    share: { title: "Reel shared", body: "{actor} shared your reel." },
    save: { title: "Reel saved", body: "{actor} saved your reel." },
    new_video: { title: "{actor} uploaded a new reel - you follow them", body: "{reel_title}" },
    message: { title: "New message", body: "{actor} sent you a message." },
    star_gift: { title: "New star gift", body: "{actor} sent you stars." },
    mention: { title: "You were mentioned", body: "{actor} mentioned you on a reel." },
    tag: { title: "You were tagged", body: "{actor} tagged you on a reel." },
  } as Record<string, { title: string; body: string }>)[type] ?? { title: "DiskieReels", body: "You have a new notification." };
}
function render(template: string, values: Record<string, string>) {
  return template
    .replace(/\{\{\s*(actor|reel_title|comment)\s*\}\}/g, (_, key) => values[key] ?? "")
    .replace(/\{\s*(actor|reel_title|comment)\s*\}/g, (_, key) => values[key] ?? "");
}
function cleanTemplateLeaks(value: string, values: Record<string, string>) {
  return value
    .replace(/\{\{\s*actor\s*\}\}|\{\s*actor\s*\}/gi, values.actor || "Someone")
    .replace(/\{\{\s*reel_title\s*\}\}|\{\s*reel_title\s*\}/gi, values.reel_title || "your reel")
    .replace(/\{\{\s*comment\s*\}\}|\{\s*comment\s*\}/gi, values.comment || "")
    .replace(/\s+/g, " ")
    .trim();
}
function deepLinkRoute(row: NotificationRow, type: string) {
  if (type === "message" && row.conversation_id) return `/messages/${encodeURIComponent(row.conversation_id)}`;
  if (type === "follow" && row.actor_id) return `/profile/${encodeURIComponent(row.actor_id)}`;
  if (row.video_id) {
    const comments = row.comment_id ? `&comments=1&comment=${encodeURIComponent(row.comment_id)}` : "";
    return `/feed?video=${encodeURIComponent(row.video_id)}${comments}`;
  }
  if (type === "message" && row.actor_id) return `/notifications?tab=inbox&user=${encodeURIComponent(row.actor_id)}`;
  return "/notifications";
}
function isReelEvent(type: string) {
  return ["like", "comment", "reply", "save", "share", "new_video", "star_gift", "mention", "tag"].includes(type);
}
function publicHttps(value: string) {
  if (!value || !/^https:\/\//i.test(value)) return "";
  return value;
}
async function rows(url: string, key: string, query: string): Promise<Json[]> {
  const response = await fetch(`${url}/rest/v1/${query}`, { headers: serviceHeaders(key) });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return await response.json();
}
async function firstRow(url: string, key: string, query: string): Promise<Json | null> {
  const result = await rows(url, key, query + (query.includes("limit=") ? "" : "&limit=1"));
  return result[0] ?? null;
}
async function writeLog(url: string, key: string, body: Json) {
  const response = await fetch(`${url}/rest/v1/notification_delivery_logs`, {
    method: "POST", headers: { ...serviceHeaders(key), Prefer: "return=minimal" }, body: JSON.stringify(body),
  });
  if (!response.ok) console.error(JSON.stringify({ stage: "log_write_failed", status: response.status, detail: await response.text() }));
}
function serviceHeaders(key: string) { return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }
function parseJson(value: string): unknown { try { return value ? JSON.parse(value) : {}; } catch { return value; } }
function json(body: Json, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
