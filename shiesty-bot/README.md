# Dog Wif Shiesty X PFP bot

This is a standalone Railway worker. It is intentionally isolated from the website and any token or fee-distribution code.

The worker reads the bot account's X mentions. It acts only when a user directly mentions the bot or directly replies to it and the entire command, after removing the bot handle, is exactly `shiesty me` (case-insensitive). It downloads that author's public X profile image, runs input moderation, makes one identity-preserving image edit with OpenAI `gpt-image-2`, moderates the output, uploads it to X, and posts one reply labeled with `made_with_ai: true`.

`STOP` is recognized as an exact direct command and permanently stores that X user ID in the opt-out table. There is no automatic re-enable command.

## Safety properties

- `BOT_DRY_RUN=true` is the default. Dry run reads, validates, deduplicates, and records requests but does not call OpenAI or write to X.
- Live startup fails unless `X_AI_AUTOREPLY_APPROVED=true`, an OpenAI key is present, and all four OAuth 1.0a write credentials are present.
- Startup verifies the configured bot ID and username through the read client and through both X v1 and v2 authenticated-user lookups for the OAuth write client.
- The transformation prompt is built into the source and cannot be changed through a post or environment variable. It requests a nonviolent black fabric balaclava and forbids weapons, threats, gore, crime, drugs, gang symbols, text, and logos.
- The author's text and profile image are moderated before the edit. The generated image is moderated again before upload. The Image API also receives `moderation=auto`.
- Profile downloads are HTTPS-only, restricted to `pbs.twimg.com` and `abs.twimg.com`, DNS-checked against private addresses, redirect-limited, byte-limited, timed out, and checked by file signature.
- The source post ID is the database idempotency key. After generation and immediately before upload, the worker re-fetches the source post and confirms it is still readable, belongs to the same author, is not marked sensitive, and still contains the exact direct opt-in. The database writes `posting` before the single create-post request. An ambiguous network result is held in `posting` for manual review and is never automatically posted again.
- Mentions are processed oldest first. Polling, backlog, age, global, per-cycle, per-author, download, and OpenAI timeout limits are bounded.
- Temporary source and output files are removed in a `finally` block.
- Logs contain post/user IDs and bounded error messages, never credentials or image bytes.

## 1. X prerequisites

Create an X developer App owned by the bot operator and set the App permissions to **Read and write**. After changing permissions, regenerate the OAuth 1.0a Access Token and Access Token Secret. The API key/secret identify the App; the access token/secret identify the bot account. They are four different values.

Before live use:

1. Enable X's **Automated** account label.
2. State in the bio that the account is automated and identify/link its human operator.
3. Obtain X's prior written approval for AI-generated replies through the Policy Support process.
4. Confirm that your X API plan has enough credits for mention reads, media uploads, and replies.

X Premium or a blue check is neither required nor sufficient. Developer access, a suitable API plan, Read and write permissions, user-context credentials, the automated-account disclosures, and explicit approval for AI replies are separate requirements.

Official references: [Developer Guidelines](https://docs.x.com/developer-guidelines), [mentions timeline](https://docs.x.com/x-api/users/get-mentions), [media upload](https://docs.x.com/x-api/media/introduction), and [create/reply with `made_with_ai`](https://docs.x.com/x-api/posts/create-post).

## 2. Supabase

Create a Supabase project, open its SQL editor, paste all of [`supabase.sql`](./supabase.sql), and run it. The migration creates:

- `shiesty_bot_interactions` for one-time claims and reply state;
- `shiesty_bot_opt_outs` for persistent `STOP` requests;
- `shiesty_bot_cursors` for `since_id` polling.

RLS is enabled and no browser role receives access. Put only the server-side service-role key in Railway. Never use it in a `NEXT_PUBLIC_*` variable.

## 3. Railway

Create a Railway service from this repository and set its **Root Directory** to `/shiesty-bot`. The included [`Dockerfile`](./Dockerfile) runs `npm ci`, builds TypeScript, prunes development packages, and starts the long-running worker with `npm start`. In the Railway dashboard select the detected Dockerfile builder, set **Restart Policy** to `On Failure` with 10 retries, and keep one replica. Dashboard settings are authoritative.

This project intentionally does not use the deprecated `railway.json`/`railway.toml` Config as Code format, which new Railway services cannot adopt and existing services lose after December 1, 2026. Railway's current alternative is project-specific `.railway/railway.ts` infrastructure state generated with `railway config init`, so it should be created only after the real project/service is linked.

Copy the variables from [`.env.example`](./.env.example). Start with:

```env
BOT_DRY_RUN=true
X_AI_AUTOREPLY_APPROVED=false
```

Deploy, then send a fresh direct mention such as:

```text
@YourBot shiesty me
```

Confirm Railway logs show `interaction.dry_run` exactly once. Dry-run interactions are intentionally consumed; send a new mention for the live test.

Once X has approved the AI reply workflow and the bot account is labeled correctly, set both of these exact values and redeploy:

```env
BOT_DRY_RUN=false
X_AI_AUTOREPLY_APPROVED=true
```

Send one fresh `shiesty me` mention. Confirm the edited PFP reply is labeled as AI-generated, then review the `replied` row in Supabase. Keep one Railway replica; database idempotency is still enforced if a second process starts accidentally.

## OpenAI behavior

The worker calls `/v1/moderations`, then `/v1/images/edits`, then `/v1/moderations` again. Image edits default to `gpt-image-2`, `1024x1024`, `quality=medium`, and PNG output. `gpt-image-2` always applies high input fidelity, so the worker does not send a redundant or potentially incompatible `input_fidelity` field. OpenAI may require organization verification for GPT Image access. See the official [Image generation guide](https://developers.openai.com/api/docs/guides/image-generation) and [moderations endpoint](https://developers.openai.com/api/reference/resources/moderations/methods/create).

## Local verification

```bash
cp .env.example .env
npm install
npm test
npm run typecheck
npm run build
```

Run one poll with configured dry-run credentials:

```bash
npm run poll:once
```

Never commit `.env`, X credentials, OpenAI keys, or the Supabase service-role key.

## Operational notes

- `failed` means no create-post request was made and the interaction will not be retried automatically.
- `posting` with `reply_result_unknown` means X may have accepted the one allowed create-post request. Check the bot timeline manually; do not change the row to retry blindly.
- `skipped` rows record safety, age, or rate-limit decisions and are terminal.
- To honor an X content-deletion request, remove the corresponding interaction row within X's required window. Keep an opt-out row unless that user also requests deletion of the opt-out record.
