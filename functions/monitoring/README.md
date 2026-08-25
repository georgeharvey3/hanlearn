# Cloud Monitoring alert policies

Layer 2 of the error reporting in
[docs/adr/0001-error-reporting-for-the-cloud-functions.md](../../docs/adr/0001-error-reporting-for-the-cloud-functions.md).

Sentry (layer 1) reports every error that a handler can see. It cannot report an
out-of-memory error, a timeout or a container crash, because the platform kills
the process and no reporter inside it runs. Those are the failures of issue
[#282](https://github.com/georgeharvey3/hanlearn/issues/282), and these two
policies are what covers them.

| File | Kind | Catches |
|---|---|---|
| `oom-log-match.json` | Log match | The kill itself, after it happens |
| `memory-threshold-256mb.json` | Metric threshold | Memory above 85% of 256 MB, before the kill |
| `memory-threshold-512mb.json` | Metric threshold | Memory above 85% of 512 MB, before the kill |

Both kinds are kept. The threshold policies give warning ahead of the kill and
do not depend on a message string, but they miss a fast rise inside a single
invocation. The log-match policy catches what they miss.

A log-match condition returns no data points, so the per-point charge that
Google will start applying no sooner than 1 September 2027 does not apply to it.
That is why these are alert policies and not user-defined log-based metrics; a
log-based metric is a chargeable custom metric.

## Verify these two values before you apply anything

Neither value below can be checked from this repository. Both were written from
the documented behaviour of 1st gen functions. **Read the real values in the
Google Cloud console first and correct the files if they differ.**

1. **The kill message.** `oom-log-match.json` matches three candidate strings.
   The message is not the same for 1st gen and 2nd gen functions. Open Cloud
   Logging, filter on `resource.type="cloud_function" severity>=ERROR`, find a
   real kill, and replace the filter with the string that event actually has.
   If no kill has happened yet, force one — see "Test it" below.

2. **The metric name.** Both threshold policies use
   `cloudfunctions.googleapis.com/function/user_memory_bytes`. Open Metrics
   Explorer, search for the memory metric of one of these functions, and confirm
   the name. Do not take it from a document, this one included.

## Apply

Requires the `gcloud` CLI, authenticated against `hanlearn-dd14f`, with the
Monitoring Admin role.

Create the notification channel once, using the same email address that receives
the Sentry alerts:

```sh
gcloud beta monitoring channels create \
  --project=hanlearn-dd14f \
  --display-name="HanLearn alerts" \
  --type=email \
  --channel-labels=email_address=YOUR_ADDRESS_HERE
```

That prints a channel name of the form
`projects/hanlearn-dd14f/notificationChannels/1234567890`. Then create each
policy, attaching the channel:

```sh
CHANNEL=projects/hanlearn-dd14f/notificationChannels/1234567890

for policy in oom-log-match memory-threshold-256mb memory-threshold-512mb; do
  gcloud alpha monitoring policies create \
    --project=hanlearn-dd14f \
    --policy-from-file="$policy.json" \
    --notification-channels="$CHANNEL"
done
```

To change a policy later, edit the file and update in place rather than
recreating it, so the incident history survives:

```sh
gcloud alpha monitoring policies list --project=hanlearn-dd14f \
  --format="table(name, displayName)"

gcloud alpha monitoring policies update POLICY_ID \
  --project=hanlearn-dd14f \
  --policy-from-file=oom-log-match.json
```

## Test it

The issue's acceptance line is "a test function that goes above its memory limit
sends an alert to the email address". Nothing in this repository can prove that,
so it has to be done once by hand:

1. Deploy a throwaway callable with `runWith({ memory: '128MB' })` whose handler
   allocates until it dies, for example
   `const hog = []; for (;;) hog.push(Buffer.alloc(8 * 1024 * 1024));`
2. Call it once.
3. Confirm the email arrives, and confirm the log-match filter matched the real
   event. Correct the filter if it did not.
4. Delete the throwaway function.

## Keeping the groups honest

The two threshold policies name their member functions in the condition filter,
because Cloud Monitoring has no metric for a function's configured limit and an
absolute byte threshold only means something against a known limit.

**A function added to `functions/src` is not covered until it is added to the
matching file here.** When you change a `runWith({ memory })` value, move the
function between the two files in the same commit.

Current membership, matching `functions/src`:

| Limit | Functions |
|---|---|
| 256MB | `getDailyChengyu`, `lookupChengyuChar`, `textToSpeech`, `scoreSimilarity` |
| 512MB | the five `dictionary*` functions, `decomposeCharacter` |

The five `dictionary*` functions reach 512 MB through
[#323](https://github.com/georgeharvey3/hanlearn/pull/323). Until that lands
they still run at the 1st gen default, so the 512 MB threshold policy would not
fire for them before a kill. Apply the policies after both are deployed.
