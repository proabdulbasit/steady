# Steady 30s Google Flow script

One continuous vertical ad. **3 scenes x 10 seconds.** Same owner, cafe, phone, light, music, and narrator in every clip. It should feel like one take, not three ads.

Use this in **Google Flow + Veo 3.1 Quality**, **9:16**, **1080p**.

---

## Flow setup (do this once)

1. Create 3 Ingredients and reuse them on every clip:
   - **Owner:** woman, early 30s, olive skin, dark hair in a low bun, gold hoops, white tee, black cafe apron
   - **Phone / UI:** black phone, Steady app, warm beige, dark text, rounded gold buttons
   - **Cafe:** small daylight cafe, wood counter, beige walls, morning window light
2. Paste the **same settings block** at the top of every prompt. Do not rewrite it.
3. Shoot in order. Scene 2 first frame = Scene 1 last frame. Scene 3 first frame = Scene 2 last frame.
4. Flow makes about **8 seconds** per generate. Then **Extend 2 seconds** with the extend prompt so each scene is 10 seconds. Same voice and music on the extend.

---

## Same on every scene (do not change)

| Setting | Lock this |
|---|---|
| Aspect | 9:16 |
| Look | Warm beige and gold, photoreal, 35mm, slow push-in |
| Light | Morning window from camera left |
| Voice | One warm female American narrator, mid 30s, close dry mic |
| Music | Low acoustic percussion, 95 BPM, continuous, do not restart |
| Ambience | Quiet cafe, espresso hiss, cup clink |
| Off camera | Pricing, Square, QuickBooks, banners, briefing, admin |

### Settings block (paste first, every prompt)

```
VERTICAL 9:16, photoreal cinematic product commercial, one continuous shot language. SAME CHARACTER every frame: a restaurant owner, woman, early 30s, olive skin, dark hair in a low bun, small gold hoop earrings, white t-shirt, black cafe apron. SAME LOCATION every frame: her small cafe at the counter, warm beige interior, wood, soft morning window light from camera left, shallow depth of field, background slightly creamy. SAME PROP every frame: the same black smartphone in her hands, screen showing the Steady app, warm beige background, dark ink text, rounded gold tan buttons, serif Steady logo, clean minimal UI, no clutter. CAMERA: handheld-stable, 35mm look, slow gentle push-in, never whip pan, never crash zoom. LIGHTING: warm morning key from camera left, soft fill, no neon, no blue tech glow. GRADE: warm beige and gold, like the Steady brand, filmic, clean, not HDR, not cyberpunk. AUDIO BED MUST MATCH THE PREVIOUS CLIP EXACTLY: quiet cafe ambience, distant espresso machine hiss, soft cup clink, low warm acoustic percussion at 95 BPM under the voice, no new melody, no bass drop. VOICE MUST MATCH THE PREVIOUS CLIP EXACTLY: one warm female American narrator, mid 30s, close dry mic, confident, direct, slightly low, speaking to a business owner, no second voice, no robot voice, no reverb change. Do not show pricing, plans, Stripe, Square, QuickBooks, notification banners, remaining-question counters, or a settings dashboard.
```

### One voiceover for the whole 30 seconds

Leave air between lines. Do not pack every second.

> A bad review just hit your restaurant. Open Steady. Pick Restaurant.
> Type it like you'd say it. Get the script. One clear next move.
> Talk it out. Drop in a receipt. Send it to your team. Ask Steady. It's free.

---

## Scene 1 — 0:00 to 0:10
**Hook, account, industry**

**Mode:** Ingredients to Video

**Last frame you need:** phone close-up, Restaurant selected, gold Create account just tapped.

**VO:** A bad review just hit your restaurant. Open Steady. Pick Restaurant.

| Time | Picture |
|---|---|
| 0:00–0:02 | Owner at the counter, worried, phone in hand. Super: Tell me your problem. I'll tell you what to do. |
| 0:02–0:07 | Push into the phone. Register fills. She taps Restaurant / Food and Beverage. Create account. |
| 0:07–0:10 | Hold on the locked Restaurant chip. Super: Built around your business. |

Generate 8s with the Scene 1 prompt in `steady-30s-google-flow-script.json`, then Extend 2s with the Scene 1 extend prompt.

---

## Scene 2 — 0:10 to 0:20
**Chat and Next move**

**Mode:** Frames to Video. Drop Scene 1 last frame in as the first frame.

**Last frame you need:** gold line on screen, Next move: Reply today before the dinner rush.

**VO:** Type it like you'd say it. Get the script. One clear next move.

| Time | Picture |
|---|---|
| 0:10–0:12 | Same phone. Chat empty: What are you working on? |
| 0:12–0:16 | Types the slow-service review question. Gold send. |
| 0:16–0:17 | Steady is thinking... |
| 0:17–0:20 | Answer streams. Hold on Next move. Super: One clear next move. Every time. |

Music does not restart. Same cafe bed continues under the VO.

---

## Scene 3 — 0:20 to 0:30
**Voice, receipt, team, CTA**

**Mode:** Frames to Video. Drop Scene 2 last frame in as the first frame.

**Last frame you need:** beige end card, Ask Steady. It's free.

**VO:** Talk it out. Drop in a receipt. Send it to your team. Ask Steady. It's free.

| Time | Picture |
|---|---|
| 0:20–0:23 | Same chat. Voice listening ring. Super: Talk it out. |
| 0:23–0:25 | Receipt chip attaches. Super: Drop in a receipt. |
| 0:25–0:28 | Explain to my team. Short staff script. Super: Send it to your team. |
| 0:28–0:30 | End card. Steady. Your business co-pilot. Ask Steady. It's free. Tiny gold stinger only here. |

---

## Assembly

In Flow Scene Builder, lay the three 10-second clips in order. No extra transition. Hard cut on the matching frames. Captions on. Export 9:16.

If a clip drifts (new face, new cafe, new song), regenerate that clip only. Do not rewrite the settings block.
