import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' }
});
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function dateParts(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function thursdayWeek(localDate: string) {
  const date = new Date(`${localDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 3) % 7);
  return date.toISOString().slice(0, 10);
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  if (request.method === 'GET') return publicKey ? json({ publicKey }) : json({ error: 'Push is not configured.' }, 503);
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const cronSecret = Deno.env.get('PUSH_CRON_SECRET');
  if (!cronSecret || request.headers.get('Authorization') !== `Bearer ${cronSecret}`) return json({ error: 'Unauthorized.' }, 401);

  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject) return json({ error: 'VAPID is not configured.' }, 503);
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subscriptions, error } = await supabase
    .from('weekly_push_subscriptions')
    .select('endpoint,p256dh,auth,timezone,week_start,weekly_complete,last_sent_local_date')
    .eq('weekly_complete', false);
  if (error) return json({ error: 'Could not load push subscriptions.' }, 500);

  let sent = 0, expired = 0;
  for (const sub of subscriptions || []) {
    try {
      const local = dateParts(sub.timezone);
      const localDate = `${local.year}-${local.month}-${local.day}`;
      const localTime = `${local.hour}:${local.minute}`;
      const currentWeek = thursdayWeek(localDate);
      if (sub.week_start !== currentWeek) {
        const { error: rolloverError } = await supabase.from('weekly_push_subscriptions').update({
          week_start: currentWeek, weekly_complete: false, last_sent_local_date: null
        }).eq('endpoint', sub.endpoint);
        if (rolloverError) { console.error('Could not roll push subscription into the new week.'); continue; }
        sub.week_start = currentWeek;
        sub.weekly_complete = false;
        sub.last_sent_local_date = null;
      }
      if (localTime < '19:00' || sub.last_sent_local_date === localDate) continue;

      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({
        title: 'The Hollow Roots · Weekly Quest',
        body: 'Your weekly quest is still unfinished. Log today’s effort and keep the challenge moving.',
        url: new URL('./', Deno.env.get('GAME_URL') || 'https://manandi.github.io/god/').href,
        tag: 'hollow-roots-weekly-quest'
      }), { TTL: 21600, urgency: 'normal' });
      await supabase.from('weekly_push_subscriptions').update({ last_sent_local_date: localDate }).eq('endpoint', sub.endpoint);
      sent++;
    } catch (error) {
      const status = Number((error as { statusCode?: number })?.statusCode);
      if (status === 404 || status === 410) {
        await supabase.from('weekly_push_subscriptions').delete().eq('endpoint', sub.endpoint);
        expired++;
      } else console.error('Weekly push failed:', status || 'unknown');
    }
  }
  return json({ sent, expired });
});
