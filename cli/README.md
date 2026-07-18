# EnvVault CLI

Securely sync encrypted environment variables from the cloud. Secrets are
encrypted and decrypted **only on your machine** — the server never sees a
plaintext value or a raw data-encryption key.

## Install

```bash
cd cli
npm install
npm run build
npm link          # exposes the `envvault` command globally
```

## Configure

The CLI needs your Firebase project's public web config. Set it once:

```bash
envvault config set \
  --api-key <FIREBASE_WEB_API_KEY> \
  --project-id <FIREBASE_PROJECT_ID> \
  --app-id <FIREBASE_APP_ID> \
  --auth-domain <PROJECT>.firebaseapp.com \
  --region us-central1
```

Or via environment variables (useful in CI):
`ENVVAULT_API_KEY`, `ENVVAULT_PROJECT_ID`, `ENVVAULT_APP_ID`,
`ENVVAULT_AUTH_DOMAIN`, `ENVVAULT_REGION`.

Point at the local emulator with `ENVVAULT_EMULATOR=1`.

## How the security model works

```
Per user:         RSA-OAEP 2048 keypair. Private key stays on your device.
Per environment:  AES-256-GCM data-encryption key (DEK).
                  The DEK is wrapped (RSA-encrypted) once per authorized user.

fetch    → server returns encrypted vars + YOUR wrapped DEK
           → CLI unwraps DEK with your private key → decrypts values locally
push     → CLI encrypts values with the DEK → server stores ciphertext only
add-user → admin wraps the DEK with the new user's public key
remove-user → server deletes their wrapped DEK AND the admin rotates the DEK
              (new DEK, re-encrypt all vars, re-wrap for remaining members),
              so any copy the removed user kept is instantly worthless.
```

The server enforces access on every `fetch`: a disabled account or an
`inactive`/`removed` environment membership is rejected with a 403. Locally
written `.env` files carry a signed header with a 24-hour expiry; after that the
CLI refuses to treat them as fresh and requires a new `fetch`.

## Commands

### Auth
```bash
envvault login [--email you@co.com] [--organization <orgId>]
envvault logout
envvault whoami
```
First login generates your keypair and registers the public key.

### Sync
```bash
envvault list                         # environments you can access
envvault fetch production             # write ./.env (mode 0600)
envvault fetch production -f .env.prod --project <projectId>
envvault run production -- npm start   # inject vars, write NOTHING to disk
envvault validate                     # is the local .env managed and fresh?
```

`run` is the recommended workflow: variables live only in the child process's
memory and vanish when it exits — nothing to copy.

### Admin (requires owner/admin/devops role)
```bash
envvault admin create-env staging --project <projectId> --type staging
envvault admin update-env staging --name "Staging" --description "..."
envvault admin delete-env staging [--yes]
envvault admin push production --file .env           # encrypt + upload
envvault admin add-user production teammate@co.com
envvault admin remove-user production teammate@co.com          # rotates DEK
envvault admin remove-user production teammate@co.com --no-rotate
envvault admin list-users production
```

### Config
```bash
envvault config show
envvault config set --api-key ... --project-id ...
```

## Credential storage

- Refresh token + RSA private key live in an encrypted local store
  (`conf`, machine-scoped). The refresh token is exchanged for a short-lived ID
  token on every command.
- `.env` files are written with `0600` permissions on Unix.
- The server stores only a **hash** of any CLI refresh token, never the token.
