# Translation Tool — Setup & Usage Guide

This tool translates a text file from one language to another using AI (GPT-4o). It produces a high-quality, literary translation in three passes: raw translation, style improvement, and a final polish pass that makes the result sound like it was written by a native speaker.

---

## Prerequisites

You need three things before you start: **VS Code**, **Node.js**, and an **OpenAI API key**.

### 1. Install Visual Studio Code

VS Code is a free code editor that makes it easy to open, edit, and run this tool — all in one window.

1. Go to [https://code.visualstudio.com](https://code.visualstudio.com) and click **Download for Mac** (or Windows).
2. On Mac: open the downloaded `.zip`, drag **Visual Studio Code** to your Applications folder, then open it.
3. On Windows: run the installer and follow the prompts — the defaults are fine.

### 2. Install Node.js

Go to [https://nodejs.org](https://nodejs.org) and download the **LTS** installer for your system. Run it and follow the prompts — the defaults are fine.

To verify it installed correctly, open a terminal and run:
```
node --version
```
You should see a version number starting with `v20` or higher.

> **Opening a terminal (without VS Code):**
> - **Mac:** press `Cmd + Space`, type *Terminal*, press Enter
> - **Windows:** press `Win + R`, type `cmd`, press Enter

### 3. Get an OpenAI API key

1. Go to [https://platform.openai.com](https://platform.openai.com) and sign in (or create an account).
2. Click your profile icon in the top-right corner, then **API keys**.
3. Click **Create new secret key**, give it a name, and copy the key — it starts with `sk-`.

Keep this key private. You will be charged per use based on the length of text you translate.

---

## Getting the code

You only need to do this once.

### Option A — Download as a ZIP (no Git required)

1. Go to [https://github.com/alexandrpetrov/parabellum-translations](https://github.com/alexandrpetrov/parabellum-translations)
2. Click the green **Code** button near the top right.
3. Click **Download ZIP**.
4. Once downloaded, unzip the file — you'll get a folder called `parabellum-translations-main`. You can rename it and move it anywhere you like.

### Option B — Clone with Git

If you have Git installed, open a terminal and run:

```
git clone https://github.com/alexandrpetrov/parabellum-translations.git
```

This creates a folder called `parabellum-translations` in your current directory.

> **Don't have Git?** Download it from [https://git-scm.com](https://git-scm.com). On Mac you can also install it by running `git` in the terminal — macOS will prompt you to install the developer tools.

---

## Opening the project in VS Code

This is how you work with the project going forward — everything happens inside VS Code.

1. Open VS Code.
2. Go to **File → Open Folder…** (Mac: `Cmd+O`, Windows: `Ctrl+K Ctrl+O`).
3. Navigate to the `parabellum-translations` folder and click **Open**.

The left panel (called the **Explorer**) now shows all the files in the project. You can click any file to open and edit it.

### Opening the integrated terminal

Instead of switching to a separate terminal app, use VS Code's built-in terminal — it opens already pointed at the project folder.

- Go to **Terminal → New Terminal** in the top menu bar, or
- Press `` Ctrl+` `` (backtick) on Mac or Windows.

A terminal pane opens at the bottom of the window. All `npm run …` commands in this guide should be typed here.

---

## Setup

Do this once after downloading the project.

### 1. Install dependencies

In the VS Code terminal, run:
```
npm install
```

This downloads the required libraries into a `node_modules` folder. It only needs to be done once.

### 2. Create the configuration file

In the Explorer panel on the left, click the **New File** icon (a page with a `+`) at the top of the file list and name it `.env` (note the leading dot, no extension).

The file opens in the editor. Add this line:

```
OPENAI_API_KEY=your-key-here
```

Replace `your-key-here` with the API key you copied earlier. Press `Cmd+S` (Mac) or `Ctrl+S` (Windows) to save.

> **On Windows**, if File Explorer shows the file as `.env.txt`, rename it: right-click → Rename, and remove the `.txt` part. Make sure "Hide extensions for known file types" is turned off in Folder Options so you can see the full filename.

---

## Translating a text

### Step 1 — Put your text in `source.txt`

In the Explorer panel, click `source.txt` to open it. Paste your source text here, then save the file (`Cmd+S` / `Ctrl+S`).

The file should be plain text (`.txt`), encoded in UTF-8. VS Code handles this automatically.

If your text was copied from a PDF, run the cleaning step first (see below). Otherwise you can skip straight to Step 2.

### Step 2 (optional) — Clean the source text

If the text came from a PDF or AI generation, it may contain broken line breaks, separator lines (`---`, `***`), or missing section headings. In the VS Code terminal, run:

```
npm run clean
```

This rewrites `source.txt` in place — the original content is replaced with the cleaned version. Switch back to `source.txt` in the editor (click it in the Explorer, or press `Cmd+Shift+E` to focus the Explorer then click the file) to review the result.

The tool also auto-detects section headings and wraps them in square brackets like `[Chapter One]` — check that these look correct before continuing.

### Step 3 — Run the translation

In the VS Code terminal, run:

```
npm run dev -- Ukrainian Polish
```

Replace `Ukrainian` and `Polish` with the source and target languages of your choice. Language names should be written in English (e.g. `French`, `German`, `Spanish`, `Arabic`).

The tool will:
1. Extract a glossary of proper nouns and historical terms from your text.
2. Translate each section.
3. Improve the style and naturalness of each section.
4. Run a final consistency pass to normalise all glossary terms.

Progress is printed to the terminal as it runs. The translation is saved to `output.txt` after each section, so if something goes wrong mid-way you won't lose the work already done.

### Step 4 — Find your output

When finished, click `output.txt` in the Explorer panel to open it — that is your translation.

A file named `output_glossary.json` is also saved alongside it. It contains all proper nouns and fixed terms the tool identified (names, places, titles, etc.) and the canonical translation chosen for each. Click it in the Explorer to review or spot-check terminology.

---

## Useful options

All options are added after `--` at the end of the command.

**Use different input/output files:**
```
npm run dev -- Ukrainian Polish --src mytext.txt --out result.txt
```

**Resume a translation that was interrupted** (e.g. after a network error at block 12):
```
npm run dev -- Ukrainian Polish --start=12
```

**Skip glossary extraction** (faster, but proper nouns may be translated inconsistently):
```
npm run dev -- Ukrainian Polish --no-glossary
```

**Skip the final consistency pass:**
```
npm run dev -- Ukrainian Polish --no-consistency
```

Options can be combined:
```
npm run dev -- Ukrainian Polish --src mytext.txt --out result.txt --start=5
```

---

## Troubleshooting

**`OPENAI_API_KEY is not set`** — The `.env` file is missing or the key line is not formatted correctly. Make sure the file is named exactly `.env` (not `.env.txt`) and contains `OPENAI_API_KEY=sk-...` with no spaces around the `=`.

**`Source file not found: source.txt`** — Make sure `source.txt` exists in the project folder. In VS Code, check the Explorer panel on the left — the file should be visible there.

**API errors / rate limits** — The tool retries automatically up to 3 times with increasing delays. If errors persist, check your OpenAI account for billing issues or quota limits.

**Output looks cut off** — The translation is saved after every section, so open `output.txt` to see everything translated so far. You can resume from where it stopped using `--start=N`.
