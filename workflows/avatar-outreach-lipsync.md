# AI avatar outreach — lip-synced name greetings

[`zvid-avatar-outreach-lipsync.json`](zvid-avatar-outreach-lipsync.json)

Record **one** video. For every prospect in your sheet, a clone of your voice
says *"Hi Mark! Thanks for connecting."*, a lip-sync model repaints only the
mouth on your 3-second intro clip, and Zvid hard-cuts that personalized intro
onto your unchanged pitch video. The prospect sees you greet them by name; you
paid lip-sync prices on ~3 seconds instead of the whole video, and 95% of every
video is untouched real footage — which is exactly why it looks real.

```
Manual ─▶ Config ─▶ prospects (Sheet or built-in test rows) ─▶ Clean names
   ├─ usable name ──▶ TTS (cloned voice) ─▶ lip-sync intro ─▶ poll until done ─┐
   └─ unusable name ─▶ pre-recorded generic intro (never a butchered name) ────┤
        ─▶ compose 2-scene payload ─▶ Validate (free) ─▶ Bulk render ─▶ poll
        ─▶ write Status / VideoUrl / IntroSource back ─▶ Run summary ─▶ ▶ Watch video
```

## Why this one is different

**Only the name is synthetic.** The workflow never lip-syncs the whole video.
It regenerates a ~3-second greeting per prospect and concatenates it with the
real body clip — so cost is ~**$0.15 per prospect** (WaveSpeed `veed/lipsync`
bills $0.15 per 5 s of audio) instead of $3–6 per prospect for a full-video
lip-sync, and long-video quality drift never enters the picture.

**Free to test, no card.** WaveSpeed signup gives $1 in credits: an optional
one-time voice clone ($0.50, `minimax/voice-clone`) plus 3–6 complete
end-to-end intros. Zvid's validate endpoint is free and quotes exact credits
before anything renders. `dryRun: true` routes every row through the fallback
intro, so a dry run spends **$0 on WaveSpeed** and 0 Zvid credits while still
validating every row.

**A bad name can never ship.** `Clean names` strips titles and emoji,
title-cases, takes the first token, and validates against a conservative
pattern + blocklist. Anything uncertain — plus every row of a dry run — uses
your pre-recorded generic intro (`IntroSource: fallback` in the sheet, with the
reason in the run summary). The failure mode is a warm generic greeting, never
"Hi J🚀!".

**The seam is engineered away, not hoped away.**

- The cloned voice speaks the **whole greeting sentence** — splicing just a
  name into real audio is the #1 tell (prosody discontinuity).
- Mouth-region lip-sync keeps lighting, pose and framing pixel-identical to
  your real footage, so the generated intro's last frame still matches the
  body's first frame.
- **Hard cut, no xfade** — a dissolve on a talking head screams edit; a jump
  cut reads as normal pacing. The body scene gets a slow **1.05× push-in**
  (Ken Burns zoom) so the cut looks like a deliberate punch-in and the pitch
  gains subtle production motion.
- Optional **music bed** (`musicUrl`, 8% volume) spans both scenes and masks
  the TTS-room-tone → real-room-tone switch.
- A **name chip** (`Mark · Northwind`) fades in bottom-left: free visual
  personalization that reinforces the audio.

**Variable-length intros need zero bookkeeping.** Both scenes use Zvid's
`duration: -1` — the renderer probes each clip and sizes the scene to it, so
"Al" and "Alexandra" produce different intro lengths and the output is always
exactly intro + body.

## What you need

| Thing | Where |
| --- | --- |
| Zvid API key | app.zvid.io → API Keys → **Header Auth** credential, name `x-api-key` |
| WaveSpeed API key | wavespeed.ai → **Header Auth** credential, name `Authorization`, value `Bearer wsk-…` ($1 free on signup) |
| `voiceId` | Clone once with `minimax/voice-clone` on WaveSpeed (~10 s sample from the same recording session), or any stock minimax voice id for testing |
| 3 clips on public URLs | `intro-master.mp4` (6–8 s greeting, mouth closed at the end), `body.mp4` (the pitch, name-free), `intro-generic.mp4` (recorded "Hey there!" fallback) |
| Google Sheet (optional) | headers `first_name, company` + empty `Status, VideoUrl, IntroSource`; or leave `useTestRows: true` |

Record all three clips with a locked camera, the same framing and lighting
(ideally one take split at a natural pause), and never say the name in the
body — "you / your team" only. Host them anywhere public; Zvid's own
`POST /api/uploads` accepts your `x-api-key` if you don't have a bucket handy.

## Config reference

| Key | Default | Notes |
| --- | --- | --- |
| `ttsModel` / `lipsyncModel` | `minimax/speech-02-hd` / `veed/lipsync` | Any WaveSpeed model path works — swap to A/B cost vs quality |
| `voiceId` | `YOUR_VOICE_ID` | Cloned or stock minimax voice |
| `ttsSpeed` | `1` | Nudge to match your real speaking pace |
| `greetingTemplate` | `Hi {name}! Thanks for connecting.` | `{name}` is replaced per prospect; keep it one sentence |
| `introMasterUrl` / `bodyVideoUrl` / `fallbackIntroUrl` | placeholders | The workflow refuses to run until these are real https URLs |
| `videoWidth` × `videoHeight` | 1920 × 1080 | Match how you recorded |
| `nameChip` / `brandColor` | `true` / `#C6FF3D` | Lower-third chip on the intro scene |
| `musicUrl` / `musicVolume` | `""` / `0.08` | Strongly recommended — it masks the audio seam. Pick a track longer than the video; it is trimmed to fit |
| `useTestRows` / `testRows` | `true` / 3 demo rows | Row 2 (`mr. MARK`) cleans to *Mark*; row 3 (`J`) demonstrates the fallback |
| `dryRun` | `false` | `true` = free validation + credit quote, $0 spent anywhere |
| `rowLimit` | `0` | Cap rows per run (0 = all). Bulk hard cap is 500/run |

## Cost at a glance

| Volume | Lip-sync + TTS | Notes |
| --- | --- | --- |
| Test (3–6 videos) | **$0** | WaveSpeed signup credit covers it |
| 100 prospects | ~$15 | + Zvid render credits |
| 1,000 prospects | ~$150 | vs $3–6k for full-video lip-sync |

Premium alternative: sync.so's dedicated lip-sync API ($5/mo + ~$0.05/s,
ElevenLabs TTS built into the same generate call) — the node shape is
identical (submit → poll), so swapping providers is a two-node edit.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Campaign Config.introMasterUrl is not set` | Replace the `YOUR-CDN` placeholders with your real clip URLs |
| WaveSpeed TTS/lipsync `failed` | The guard node surfaces the provider error verbatim; check the clip URL is public and the `voiceId` exists |
| `Zvid rejected N row(s)` | The free validator lists every failing field per row — usually a non-https intro URL or a plan limit |
| HTTP 429 `hourly_limit_exceeded` on submit | Your plan's hourly render cap; nothing charged, re-run after the top of the hour |
| Sheet write-back fails | Tab name must match the bottom bar of the sheet exactly; sheet needs `Status`, `VideoUrl`, `IntroSource` headers |
| Greeting sounds rushed/slow vs the body | Tune `ttsSpeed` in 0.05 steps; regenerate the voice clone from a sample recorded in the same session as the master clip |

## Send-side tips (after rendering)

Use the video's thumbnail as the email/DM preview — it shows the name chip, so
the "made for you" signal lands before play is pressed. Ship 1080p; LinkedIn
and email player compression hides whatever tiny artifacts remain. Keep total
length under ~60 s for reply-rate, and put the prospect's name in the message
text too so the video confirms what the copy promised.
