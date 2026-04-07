# Ukrainian to Spanish Translation Tool (TypeScript)

A TypeScript application that translates Ukrainian text to Spanish using the OpenAI ChatGPT API with a 3-step refinement process for high-quality, natural-sounding translations.

## Features

- 📝 Intelligent paragraph grouping (blocks of 3 paragraphs)
- 🏷️ Automatic title detection (paragraphs < 150 characters)
- 🔄 3-step translation pipeline:
  1. Ukrainian → Spanish translation
  2. Style improvement
  3. Natural Spanish enhancement
- 📊 Progress tracking with detailed logging
- ⚡ Built with TypeScript for type safety
- 🛡️ Comprehensive error handling

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

## Installation

1. **Clone or download the project files**

2. **Use the correct Node version (if using nvm):**
   ```bash
   nvm use    # Automatically uses Node 20 from .nvmrc
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up your OpenAI API key:**

   Create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your API key:
   ```
   OPENAI_API_KEY=your-actual-api-key-here
   ```

   **Alternative:** Set as environment variable:
   ```bash
   # Linux/Mac
   export OPENAI_API_KEY='your-api-key-here'

   # Windows (Command Prompt)
   set OPENAI_API_KEY=your-api-key-here

   # Windows (PowerShell)
   $env:OPENAI_API_KEY='your-api-key-here'
   ```

## Project Structure

```
project/
├── translate.ts          # Main TypeScript source file
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Environment variable template
├── .gitignore           # Git ignore rules
├── source.txt           # Input file (your Ukrainian text)
└── output.txt           # Generated output (Spanish translation)
```

## Usage

### Method 1: Using ts-node (Development)

Run directly without compilation:
```bash
npm run dev
```

### Method 2: Compile and Run (Production)

Build and run the compiled JavaScript:
```bash
npm run translate
```

Or separately:
```bash
npm run build    # Compiles TypeScript to JavaScript
npm start        # Runs the compiled code
```

## How It Works

### 1. Text Processing

The program reads `source.txt` and processes it as follows:

- **Paragraph Detection:** Splits text by double newlines (`\n\n`) or single newlines
- **Title Detection:** Paragraphs < 150 characters are treated as section titles
- **Block Creation:** Groups paragraphs into blocks of 3 (titles are included with adjacent blocks)

### 2. Translation Pipeline

For each block, the program executes:

```
STEP 1: Ukrainian → Spanish
  ↓
STEP 2: Style Improvement
  ↓
STEP 3: Natural Spanish Enhancement
  ↓
Output Block
```

### 3. Output Generation

All translated blocks are concatenated in their original order and saved to `output.txt`.

## Configuration

### Model Selection

By default, the program uses `gpt-4o`. To use a different model, modify the `callChatGPT` function in `translate.ts`:

```typescript
async function callChatGPT(prompt: string, model: string = 'gpt-4o'): Promise<string> {
  // Change 'gpt-4o' to your preferred model
  // Options: 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', etc.
}
```

### Temperature

The temperature is set to `0.3` for consistent translations. Adjust in the `callChatGPT` function:

```typescript
temperature: 0.3, // Lower = more consistent, Higher = more creative
```

### Block Size

To change the number of paragraphs per block, modify the condition in `createBlocks`:

```typescript
if (nonTitleCount >= 3) {  // Change 3 to desired number
  blocks.push(currentBlock.join('\n\n'));
  currentBlock = [];
}
```

### Title Length Threshold

To adjust what counts as a title, modify the threshold:

```typescript
const isTitle = para.length < 150;  // Change 150 to desired character count
```

## Example

**Input (source.txt):**
```
Вступ

Штучний інтелект стрімко розвивається і змінює наш світ...
```

**Output (output.txt):**
```
Introducción

La inteligencia artificial se desarrolla rápidamente y cambia nuestro mundo...
```

## Error Handling

The program handles various error scenarios:

- ✅ Missing `source.txt` file
- ✅ Missing API key
- ✅ API rate limits and errors
- ✅ Network issues
- ✅ Invalid file formats

All errors are logged with descriptive messages.

## API Costs

Translation costs depend on:
- Text length (tokens processed)
- Model used (GPT-4 is more expensive than GPT-3.5)
- Number of API calls (3 per block)

**Estimate:** For 1,000 words:
- ~3,000-4,000 tokens per pass
- 3 passes per block
- Multiple blocks

Monitor your usage at https://platform.openai.com/usage

## Development

### Type Checking

```bash
npx tsc --noEmit
```

### Watch Mode

```bash
npx tsc --watch
```

### Run with ts-node

```bash
npx ts-node translate.ts
```

## Troubleshooting

### "OPENAI_API_KEY environment variable not set"
- Ensure you've set the API key in `.env` or as an environment variable
- Check that `.env` is in the same directory as the script

### "source.txt not found"
- Create a `source.txt` file in the project directory
- Add your Ukrainian text to this file

### "Module not found" errors
- Run `npm install` to install all dependencies
- Ensure you're using Node.js v16 or higher

### API errors
- Verify your API key is valid
- Check you have sufficient credits
- Ensure stable internet connection
- Check OpenAI service status

### TypeScript compilation errors
- Ensure TypeScript version is compatible (5.x)
- Run `npm install` to get correct dependencies
- Check `tsconfig.json` settings

## License

MIT

## Support

For issues or questions:
- Check OpenAI documentation: https://platform.openai.com/docs
- OpenAI API status: https://status.openai.com
- Node.js documentation: https://nodejs.org/docs

## Version History

- **1.0.0** - Initial release with 3-step translation pipeline
