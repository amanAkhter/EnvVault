<div align="center">
  <h1>EnvVault</h1>
  <p><strong>A production-ready SaaS platform for managing Environment Variables and Application Configurations for development teams.</strong></p>
</div>

---

## 🚀 Overview
EnvVault is a secure, scalable, and modern application configuration manager built to solve the headache of passing `.env` files around via Slack or Notion. Designed with a premium developer experience in mind, it acts as a single source of truth for your team's secrets, configuration, and environment states.

Think of it as an open-core alternative to Doppler, Infisical, or Hashicorp Vault.

## ✨ Features
- **Project & Workspace Management:** Organize your configuration by organizations and specific projects.
- **Environment Handling:** Create and manage distinct environments (e.g., Development, Staging, Production) effortlessly.
- **Client-Side Encryption:** Deeply integrated security where DEKs (Data Encryption Keys) are wrapped, ensuring your secrets are encrypted before they hit the database.
- **Smart Import & Export:** Drag-and-drop parsing of `.env` and JSON formats with preview modes and immediate validations.
- **Audit Logging:** Built-in tracking of who changed what and when, ensuring full accountability for production keys.
- **Modern Tech Stack:** React 19, TypeScript, TailwindCSS v4, Vite, and Firebase.

## 🛠️ Technology Stack
- **Frontend:** React 19, TypeScript
- **Styling:** Tailwind CSS v4, Framer Motion (for micro-animations), Base UI
- **State Management:** Zustand, React Query
- **Backend & Auth:** Firebase Auth, Firestore
- **Build Tool:** Vite

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+)
- `pnpm` (recommended) or `npm`

### Installation
1. Clone the repository:
   ```bash
   git clone git@github.com:amanAkhter/EnvVault.git
   cd EnvVault
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure Environment Variables:
   Duplicate `.env.example` and rename the copies to `.env.development` and `.env.production`. Fill in your Firebase config keys.
   ```bash
   cp .env.example .env.development
   ```

4. Run the Development Server:
   ```bash
   pnpm run dev
   ```
   *Note: Our custom script automatically handles copying the correct environment config to `.env` based on the command you execute.*

## 📜 Available Scripts

- `pnpm run dev` — Starts the development server using the `.env.development` config.
- `pnpm run dev:prod` — Starts the development server but connects to your production Firebase database (`.env.production`).
- `pnpm run build` — Builds the production bundle using the production config.
- `pnpm run build:dev` — Builds the bundle using the development config (useful for testing builds).

## 🔒 Security Architecture
EnvVault prioritizes the security of your variables:
1. **Master Keys:** Each user holds a derived master key based on their secure authentication.
2. **Project DEKs:** Every project generates a unique Data Encryption Key (DEK).
3. **Wrapping:** The DEK is encrypted (wrapped) by the user's master key before it is ever stored in Firestore.
4. **End-to-End Security:** Variables are encrypted client-side using the project's DEK. Firebase only ever sees ciphertexts and IVs, never the plaintext secrets.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

---
*Built for developers, by developers.*
