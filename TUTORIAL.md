# Antigravity AI Stack: Token Optimization Tutorial
### Setup Guide: Graphify + Caveman + Playwright

This document outlines the step-by-step setup to minimize context windows and maximize speed within the Antigravity IDE / VS Code workspace.

---

## 🛠️ Step 1: Install Graphify & Local Configuration

First, we set up Graphify locally to index our `env-vault` codebase structure using an Abstract Syntax Tree (AST), bypassing the need for expensive external LLM tokens.

1. **Install the dependencies globally or locally:**
   ```bash
   pip install graphifyy
   graphify install
   graphify antigravity install
   ```

2. **Create the exclusion map file (`.graphify.json`)** in your project root to keep the indexer clean:
   ```json
   {
     "exclude": [
       "node_modules/**",
       "playwright-report/**",
       "test-results/**",
       "*.trace",
       "dist/**",
       "*.md",
       "docs/**",
       "hosting.ZGlzdA.cache",
       ".firebaserc",
       "firestore.rules"
     ],
     "include": [
       "**/*.ts",
       "**/*.js",
       "**/*.json"
     ]
   }
   ```

---

## 🏗️ Step 2: Build the Local Structure Graph

Generate your codebase map file using the zero-token local index engine.

1. **Run the local extraction scan:**
   ```bash
   graphify . --code-only
   ```
2. **Compile the structural clusters:**
   ```bash
   graphify cluster-only .
   ```
   *This outputs your structural map inside the `.\graphify-out\` folder, featuring `graph.json` and a visual `graph.html`.*

---

## 🚀 Step 3: Link the Graph to Antigravity

Load the compiled structural architecture directly into the active AI panel context.

1. Open the **Antigravity IDE** (or toggle your AI panel using `Ctrl + L`).
2. Run the initialization hook command inside your chat workspace terminal to feed the layout map directly to the underlying agent:
   ```text
   /graphify load .\graphify-out\graph.json
   ```

---

## 🦎 Step 4: Configure Caveman Output Rules

Enforce absolute verbosity constraints across the workspace. This forces the agent to reference your Graphify roadmap rather than re-indexing codebase files.

1. Create a file named **`AI.md`** in your project root directory.
2. Paste the following configuration rules:
   ```markdown
   # AI Coding Instructions (Caveman Stack)
   - Never output pleasantries, conversational intro/outro text, or lengthy explanations.
   - Only output direct code diffs, command-line scripts, or exact line references.
   - Hard limit output generation to 200 tokens unless given explicit override permissions.
   - Use `graphify-out/graph.json` maps exclusively to traverse the codebase directory. Do not run text search across multiple open workspace tabs.
   ```
3. Set your active chat session constraint inside the chat panel:
   ```text
   /caveman strict
   ```

---

## 🌐 Step 5: Restrict Playwright Context Bloat

Limit Playwright's Model Context Protocol (MCP) server integration parameters to prevent raw HTML document models from overwhelming the input context window.

1. Press **`Ctrl + ,`** (or `Cmd + ,` on macOS) to access **IDE Settings**.
2. Search for your active **MCP Configurations** block.
3. Update your `@playwright/mcp` extension server runtime arguments:
   ```json
   {
     "mcpServers": {
       "playwright": {
         "command": "npx",
         "args": ["-y", "@playwright/mcp", "--max-dom-tokens=300", "--prefer-locators"]
       }
     }
   }
   ```

---

## 🔥 Step 6: Verify with a Dense Prompt Template

Test the entire operational stack using this dense prompt layout to ensure complete token optimization efficiency:

> **Template:**
> "Using the loaded Graphify map, identify the script node handling our environment file decryption. Generate a concise Playwright automation script to validate its DOM inputs. Obey strict Caveman rules: provide only the test code block and the execution command. Zero conversation."
