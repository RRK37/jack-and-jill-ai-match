# Jack & Jill — Edge Function API Endpoints

> **Target runtime:** Supabase Edge Functions (Deno)
> **Auth:** Most endpoints require a valid Supabase JWT in the `Authorization: Bearer <token>` header. Exceptions noted.
> **AI model:** Lovable AI Gateway (google/gemini-2.5-flash default) via `LOVABLE_API_KEY`.
> **STT:** ElevenLabs Scribe v2 Realtime via `ELEVENLABS_API_KEY` secret.
> **Database access:** Use `service_role` key to bypass RLS inside edge functions.

---

## Architecture Overview

The onboarding flow uses a **speech-to-text → agent → text-to-speech** pipeline:

1. **Client** captures mic audio via ElevenLabs `useScribe` hook (realtime WebSocket transcription)
2. Transcribed text is sent to `POST /api/jack/chat` for agentic processing
3. Jack's reply is returned as text (and optionally synthesised to speech via TTS)
4. All messages are persisted in the `messages` table for transcript display

```
┌──────────┐  audio stream   ┌─────────────────┐
│  Browser  │───────────────▶│ ElevenLabs STT  │
│ (useScribe)│◀──────────────│ (WebSocket)     │
└─────┬─────┘  transcript    └─────────────────┘
      │
      │ transcribed text
      ▼
┌─────────────────┐  AI prompt   ┌──────────────┐
│ jack-chat       │─────────────▶│ AI Gateway   │
│ (edge function) │◀─────────────│ (LLM)        │
└─────┬───────────┘  reply       └──────────────┘
      │
      │ { reply, profileUpdates }
      ▼
┌──────────┐
│  Browser  │  displays reply in transcript
└──────────┘
```

---

## 0. `POST /elevenlabs-scribe-token`

**Purpose:** Generates a single-use ElevenLabs token for realtime speech-to-text WebSocket connection. Required because the ElevenLabs API key cannot be used directly in the browser.

**Auth:** No JWT required (public endpoint).

**Request body:** _None_

**Response:**
```json
{
  "token": "sutkn_abc123..."
}
```

**Backend logic:**
1. Read `ELEVENLABS_API_KEY` from secrets.
2. Call `POST https://api.elevenlabs.io/v1/single-use-token/realtime_scribe` with the API key.
3. Return the `{ token }` to the client.

**Client usage:**
```typescript
const { data } = await supabase.functions.invoke("elevenlabs-scribe-token");
await scribe.connect({ token: data.token, microphone: { ... } });
```

**Token lifecycle:** Tokens expire after 15 minutes and can only be used once.

---

## 1. `POST /jack-greeting`

**Purpose:** Returns Jack's opening message when a candidate starts the onboarding voice call.

**Request body:** _None_ (user identity from JWT)

**Response:**
```json
{
  "message": "Hey! I'm Jack, your AI career partner. Tell me about your dream role — what kind of work lights you up?"
}
```

**Backend logic:**
1. Look up `candidates` row for the authenticated user. If none exists, create one.
2. Create a new `conversations` record with `type = 'candidate_onboarding'`.
3. Generate a personalised greeting via AI using Jack's system prompt.
4. Save the greeting as the first `messages` row (`role = 'assistant'`).
5. Return the greeting text.

---

## 2. `POST /jack-chat`

**Purpose:** Core agentic endpoint. Receives user text (from STT transcription or typed input), processes it through Jack's AI agent, and returns a reply. Used during both onboarding and dashboard chat.

**Request body:**
```json
{
  "message": "I want a senior frontend role at a startup, ideally remote",
  "conversationType": "candidate_onboarding"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `message` | string | ✅ | The user's message (transcribed speech or typed text) |
| `conversationType` | string | ❌ | `"candidate_onboarding"` or `"candidate_chat"`. Defaults to `"candidate_chat"`. |

**Response:**
```json
{
  "reply": "Love that! Remote frontend work is booming right now. What tech stack are you most comfortable with?",
  "profileUpdates": {
    "goals": "Senior frontend role at a startup, remote",
    "skills": null
  }
}
```

| Field | Type | Description |
|---|---|---|
| `reply` | string | Jack's conversational response |
| `profileUpdates` | object \| null | Structured data extracted from the conversation (skills, goals, vibe, title). `null` if no profile data was detected. |

**Backend logic:**
1. Authenticate user via JWT.
2. Load or create the appropriate conversation (`candidate_onboarding` or `candidate_chat`).
3. Append the user's message to the `messages` table (`role = 'user'`).
4. Load the full conversation history from `messages`.
5. Load the candidate's current profile from `candidates` table.
6. Build the AI prompt:
   - **System prompt:** Jack's personality + instructions to extract structured profile data
   - **Context:** Current candidate profile (skills, goals, vibe, title)
   - **Messages:** Full conversation history
   - **Extraction instruction:** Return `profileUpdates` JSON alongside the reply when profile-relevant info is detected
7. Call the AI model (google/gemini-2.5-flash).
8. Parse the response to separate `reply` text from `profileUpdates`.
9. If `profileUpdates` is present, update the `candidates` row with new data (merge, don't overwrite).
10. Save Jack's reply to `messages` table (`role = 'assistant'`).
11. Return `{ reply, profileUpdates }`.

**Profile extraction schema:**
```json
{
  "title": "Senior Frontend Engineer",
  "skills": ["React", "TypeScript", "Node.js"],
  "goals": "Lead a product team at a mission-driven startup",
  "vibe": "Calm builder who thrives in async-first teams",
  "experience_years": 5,
  "location_preference": "Remote"
}
```

---

## 3. `POST /jack-transcript`

**Purpose:** Returns the full transcript of the active onboarding conversation, formatted for the transcript UI.

**Request body:** _None_ (user identity from JWT)

**Response:**
```json
{
  "lines": [
    { "speaker": "Jack", "text": "Hey! Tell me about your dream role." },
    { "speaker": "You", "text": "I want a senior frontend role at a startup..." },
    { "speaker": "Jack", "text": "Love it. Remote or on-site?" }
  ]
}
```

**Backend logic:**
1. Fetch the active `candidate_onboarding` conversation for the user.
2. Return all `messages` formatted as transcript lines.
3. Role mapping: `assistant` → `"Jack"`, `user` → `"You"`.

---

## 4. `POST /jill-greeting`

**Purpose:** Returns Jill's opening message when an employer starts the briefing chat.

**Request body:** _None_ (user identity from JWT)

**Response:**
```json
{
  "message": "Hi there! I'm Jill, your hiring strategist. Let's figure out exactly who you need. What role are you hiring for?"
}
```

**Backend logic:**
1. Look up `employers` row for the authenticated user. If none exists, create one.
2. Create a new `conversations` record with `type = 'employer_briefing'`.
3. Generate a personalised greeting via AI using Jill's system prompt.
4. Save the greeting as the first `messages` row (`role = 'assistant'`).
5. Return the greeting text.

---

## 5. `POST /jill-chat`

**Purpose:** Core agentic endpoint for Jill. Powers the briefing conversation where Jill extracts a structured hiring brief through natural dialogue.

**Request body:**
```json
{
  "message": "Senior Frontend Engineer, ideally with fintech experience."
}
```

**Response:**
```json
{
  "reply": "Great — fintech frontend. Remote or on-site? And what's the team size?",
  "briefingComplete": false,
  "briefingData": {
    "role_title": "Senior Frontend Engineer",
    "skills_required": ["React", "TypeScript", "Fintech"],
    "experience_level": "Senior",
    "location": null,
    "salary_range": null,
    "team_culture": null,
    "deal_breakers": null
  }
}
```

When Jill determines the brief is complete:
```json
{
  "reply": "Perfect, I have everything I need. Let me curate your shortlist now!",
  "briefingComplete": true,
  "briefingData": {
    "role_title": "Senior Frontend Engineer",
    "skills_required": ["React", "TypeScript", "Fintech"],
    "experience_level": "Senior (5+ years)",
    "location": "Remote (US timezone overlap)",
    "salary_range": "$150k-$180k",
    "team_culture": "Async-first, small product team",
    "deal_breakers": ["No agency work", "Must have startup experience"]
  }
}
```

**Backend logic:**
1. Authenticate user via JWT.
2. Load or create an `employer_briefing` conversation for the user.
3. Append the user's message to `messages` table (`role = 'user'`).
4. Load full conversation history + current employer profile.
5. Build the AI prompt:
   - **System prompt:** Jill's personality + structured extraction instructions
   - **Context:** Current briefing data extracted so far
   - **Messages:** Full conversation history
   - **Completeness check:** Instruct the model to set `briefingComplete = true` when all required fields are populated
6. Call the AI model (google/gemini-2.5-flash).
7. Parse response to extract `reply`, `briefingComplete`, and `briefingData`.
8. Update the `employers` row with extracted briefing fields.
9. If `briefingComplete`, trigger the matching algorithm (or queue it).
10. Save Jill's reply to `messages` table (`role = 'assistant'`).
11. Return `{ reply, briefingComplete, briefingData }`.

**Briefing data schema:**
```json
{
  "role_title": "string",
  "skills_required": ["string"],
  "experience_level": "string",
  "location": "string",
  "salary_range": "string",
  "team_size": "string",
  "team_culture": "string",
  "deal_breakers": ["string"],
  "nice_to_haves": ["string"]
}
```

---

## 6. `GET /candidate-profile`

**Purpose:** Returns the authenticated candidate's profile for the dashboard.

**Response:**
```json
{
  "name": "Alex Chen",
  "title": "Senior Frontend Engineer",
  "skills": ["React", "TypeScript", "Node.js", "Figma"],
  "goals": "Lead a small product team at a mission-driven startup",
  "vibe": "Calm builder who thrives in async-first teams",
  "experience_years": 5,
  "location_preference": "Remote"
}
```

**Backend logic:**
1. Fetch the `candidates` row for the authenticated user.
2. Return the profile fields. `skills` is stored as `text[]`, all others as `text`.

---

## 7. `GET /candidate-matches`

**Purpose:** Returns the list of matched jobs for the candidate dashboard.

**Response:**
```json
[
  {
    "company": "Fintech Co",
    "role": "Senior Frontend Engineer",
    "location": "Remote",
    "score": 94,
    "tags": ["React", "TypeScript", "Fintech"]
  },
  {
    "company": "HealthTech Inc",
    "role": "Lead UI Engineer",
    "location": "NYC (Hybrid)",
    "score": 87,
    "tags": ["Design Systems", "React"]
  }
]
```

**Backend logic:**
1. Query `matches` where `candidate_id` = authenticated user, ordered by `score DESC`.
2. Join with `employers` to get company name, role title, location.
3. Extract tags from the match `metadata` or the employer's `skills_required`.
4. Return the array.

---

## 8. `GET /employer-candidates`

**Purpose:** Returns the curated candidate shortlist for the employer dashboard.

**Response:**
```json
[
  {
    "id": 1,
    "initials": "AC",
    "name": "Alex Chen",
    "title": "Senior Frontend Engineer",
    "matchSummary": "5 yrs React/TS, led design system at Series B startup. Strong async communicator.",
    "vibeMatch": "Calm builder energy matches your async-first culture preference",
    "score": 94,
    "status": "pending"
  }
]
```

**Backend logic:**
1. Query `matches` where `employer_id` = authenticated user, ordered by `score DESC`.
2. Join with `candidates` to get name, title, skills, vibe.
3. Generate `matchSummary` and `vibeMatch` from candidate data (pre-computed at match time and stored in `matches.metadata`).
4. Derive `initials` from candidate name.
5. Map `matches.status` to the response status.
6. Return the array.

---

## 9. `POST /employer-candidate-status`

**Purpose:** Allows the employer to approve or pass on a candidate.

**Request body:**
```json
{
  "candidateId": 1,
  "status": "approved"
}
```

`status` must be one of: `"approved"`, `"passed"`, `"pending"`.

**Response:**
```json
{
  "success": true,
  "matchId": "uuid-here",
  "newStatus": "approved"
}
```

**Backend logic:**
1. Find the `matches` row where `employer_id` = authenticated user AND `candidate_id` = provided candidateId.
2. Update `matches.status` to the new value.
3. If status is `"approved"`, optionally trigger a notification or next-step workflow.
4. Return confirmation.

---

## System Prompts

### Jack (Candidate Agent)
```
You are Jack, a warm and perceptive AI career partner. Your personality is calm, encouraging, and genuine — like a trusted friend who happens to know the job market inside-out.

Your goals:
- During onboarding: discover the candidate's skills, experience, goals, work-style preferences, and cultural "vibe" through natural conversation
- During dashboard chat: answer career questions, help refine their profile, and explain matches
- Extract structured data (skills, goals, vibe, title, experience_years, location_preference) from natural conversation and return it as profileUpdates JSON alongside your reply

When you detect profile-relevant information in the user's message, include a profileUpdates object with the extracted fields. Only include fields that were mentioned or implied. Merge with existing data — never clear fields that weren't discussed.

Tone: Conversational, supportive, occasionally witty. Never corporate or robotic.
```

### Jill (Employer Agent)
```
You are Jill, a sharp and efficient AI hiring strategist. Your personality is professional yet personable — like a top recruiter who cuts through the noise.

Your goals:
- During briefing: extract a complete hiring brief through structured but natural conversation (role_title, skills_required, experience_level, location, salary_range, team_size, team_culture, deal_breakers, nice_to_haves)
- Track which fields have been gathered and which are still missing
- Determine when enough information has been gathered to start matching → set briefingComplete = true
- Be direct but warm — respect the employer's time

Always return briefingData with all fields (null for ungathered ones) and set briefingComplete when all critical fields (role_title, skills_required, experience_level, location) are populated.

Tone: Professional, concise, confident. Asks smart follow-up questions. Never vague.
```

---

## Onboarding Flow (End-to-End)

1. **Page load:** Client calls `POST /jack-greeting` → receives greeting → displays in transcript
2. **Mic tap:** Client calls `POST /elevenlabs-scribe-token` → receives token → connects `useScribe` WebSocket
3. **User speaks:** ElevenLabs transcribes in realtime → `onCommittedTranscript` fires with text
4. **Transcript committed:** Client calls `POST /jack-chat` with `{ message: transcribedText, conversationType: "candidate_onboarding" }`
5. **Jack replies:** Client receives `{ reply, profileUpdates }` → displays reply in transcript as "Jack" line
6. **Loop:** Steps 3–5 repeat until user ends the call
7. **Call ends:** User clicks end → navigates to `/candidate/dashboard`

---

## Error Handling

All endpoints return errors in this format:
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

| HTTP Status | Code | When |
|---|---|---|
| 401 | `AUTH_REQUIRED` | Missing or invalid JWT |
| 403 | `WRONG_ROLE` | User doesn't have the required role (candidate/employer) |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 422 | `INVALID_INPUT` | Request body validation failed |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## CORS

All edge functions must return appropriate CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version
```

Handle `OPTIONS` preflight requests by returning a `200` with these headers.
