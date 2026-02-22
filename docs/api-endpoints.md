# Jack & Jill — Edge Function API Endpoints

> **Target runtime:** Supabase Edge Functions (Deno)
> **Auth:** All endpoints require a valid Supabase JWT in the `Authorization: Bearer <token>` header.
> **AI model:** OpenAI GPT-4o via `OPENAI_API_KEY` secret.
> **Database access:** Use `service_role` key to bypass RLS inside edge functions.

---

## 1. `POST /api/jack/greeting`

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
3. Generate a personalised greeting via GPT-4o using Jack's system prompt.
4. Save the greeting as the first `messages` row (`role = 'assistant'`).
5. Return the greeting text.

---

## 2. `POST /api/jack/transcript`

**Purpose:** Returns the live transcript lines during the candidate onboarding voice call. In the MVP this simulates a voice conversation.

**Request body:** _None_ (user identity from JWT)

**Response:**
```json
{
  "lines": [
    { "speaker": "Jack", "text": "So what kind of role are you looking for?" },
    { "speaker": "You", "text": "I want a senior frontend role at a startup..." },
    { "speaker": "Jack", "text": "Love it. Remote or on-site?" }
  ]
}
```

**Backend logic:**
1. Fetch the active `candidate_onboarding` conversation for the user.
2. Return all `messages` formatted as transcript lines.
3. Each message's `role` maps: `assistant` → speaker `"Jack"`, `user` → speaker `"You"`.

---

## 3. `POST /api/jack/chat`

**Purpose:** Powers the Jack chat panel on the candidate dashboard. Candidates can ask Jack career questions or refine their profile.

**Request body:**
```json
{
  "messages": [
    { "from": "jack", "text": "Hey! How can I help?" },
    { "from": "user", "text": "Can you update my skills to include Go?" }
  ]
}
```

**Response:**
```json
{
  "reply": "Done! I've added Go to your skill set. Want me to find new matches with that?"
}
```

**Backend logic:**
1. Load or create a `candidate_chat` conversation for the user.
2. Append the latest user message to `messages` table.
3. Build GPT-4o prompt with Jack's system prompt + full conversation history + candidate profile context.
4. If the reply contains profile-update intent (detected via `metadata` JSONB), update the `candidates` row accordingly.
5. Save the assistant reply to `messages`.
6. Return the reply text.

---

## 4. `POST /api/jill/greeting`

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
3. Generate a personalised greeting via GPT-4o using Jill's system prompt.
4. Save the greeting as the first `messages` row (`role = 'assistant'`).
5. Return the greeting text.

---

## 5. `POST /api/jill/chat`

**Purpose:** Powers the Jill briefing conversation. Jill asks structured questions to build the employer's hiring brief.

**Request body:**
```json
{
  "messages": [
    { "from": "jill", "text": "What role are you hiring for?" },
    { "from": "user", "text": "Senior Frontend Engineer, ideally with fintech experience." }
  ]
}
```

**Response:**
```json
{
  "reply": "Great — fintech frontend. Remote or on-site? And what's the team size?",
  "briefingComplete": false
}
```

When Jill determines the brief is complete:
```json
{
  "reply": "Perfect, I have everything I need. Let me curate your shortlist now!",
  "briefingComplete": true
}
```

**Backend logic:**
1. Load or create an `employer_briefing` conversation for the user.
2. Append the latest user message to `messages` table.
3. Build GPT-4o prompt with Jill's system prompt + conversation history.
4. Extract structured hiring data from the conversation via `metadata` JSONB (role title, skills, location, salary range, vibe keywords).
5. Update the `employers` row with extracted fields.
6. Determine if enough information has been gathered → set `briefingComplete`.
7. If complete, trigger the matching algorithm (or queue it).
8. Save the assistant reply to `messages`.
9. Return reply + `briefingComplete` flag.

---

## 6. `GET /api/candidate/profile`

**Purpose:** Returns the authenticated candidate's profile for the dashboard.

**Request body:** _None_ (user identity from JWT)

**Response:**
```json
{
  "name": "Alex Chen",
  "title": "Senior Frontend Engineer",
  "skills": ["React", "TypeScript", "Node.js", "Figma"],
  "goals": "Lead a small product team at a mission-driven startup",
  "vibe": "Calm builder who thrives in async-first teams"
}
```

**Backend logic:**
1. Fetch the `candidates` row for the authenticated user.
2. Return the profile fields. `skills` is stored as `text[]`, all others as `text`.

---

## 7. `GET /api/candidate/matches`

**Purpose:** Returns the list of matched jobs for the candidate dashboard.

**Request body:** _None_ (user identity from JWT)

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

## 8. `GET /api/employer/candidates`

**Purpose:** Returns the curated candidate shortlist for the employer dashboard.

**Request body:** _None_ (user identity from JWT)

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

## 9. `POST /api/employer/candidate-status`

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
- Extract structured data (skills, goals, vibe) from natural conversation and store it

Tone: Conversational, supportive, occasionally witty. Never corporate or robotic.
```

### Jill (Employer Agent)
```
You are Jill, a sharp and efficient AI hiring strategist. Your personality is professional yet personable — like a top recruiter who cuts through the noise.

Your goals:
- During briefing: extract a complete hiring brief through structured but natural conversation (role, skills, experience level, location, salary range, team culture, deal-breakers)
- Determine when enough information has been gathered to start matching
- Be direct but warm — respect the employer's time

Tone: Professional, concise, confident. Asks smart follow-up questions. Never vague.
```

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
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
```

Handle `OPTIONS` preflight requests by returning `204` with these headers.
