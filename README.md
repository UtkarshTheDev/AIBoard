
<div align="center">

# 🤖♟️ AI Chess Board

**A sophisticated chess application featuring AI vs AI matches, human vs AI gameplay, and advanced chess analysis**

[![Next.js](https://img.shields.io/badge/Next.js-15.3.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Stockfish](https://img.shields.io/badge/Stockfish-16-FF6B6B?style=for-the-badge)](https://stockfishchess.org/)

[🚀 Live Demo](#) • [📖 Documentation](#features) • [🛠️ Setup Guide](#getting-started) • [🎯 Usage](#usage)

</div>

---

## 🌟 Overview

AI Chess Board is a modern, web-based chess platform that brings together cutting-edge AI technology and classic chess gameplay. Experience the thrill of watching AI models battle each other, challenge powerful AI opponents yourself, or analyze positions with the world's strongest chess engine.

### ✨ What Makes This Special?

- **🧠 Multiple AI Models**: Play against Google Gemini's latest models (2.0 Flash, 2.5 Flash, Thinking variants)
- **⚡ Real-time Analysis**: Powered by Stockfish 16 WebAssembly for instant position evaluation
- **🎭 AI vs AI Matches**: Watch different AI models compete with full game control
- **📊 Advanced Features**: Move history, timers, analysis depth control, and comprehensive logging

---

## 🎯 Features

### 🎮 For Players
| Feature | Description |
|---------|-------------|
| **Human vs AI** | Challenge powerful AI models with adjustable difficulty |
| **AI vs AI Matches** | Watch AI models battle with start/stop control |
| **Move Analysis** | Get real-time position evaluation and best move suggestions |
| **Game Timer** | Track time for competitive gameplay |
| **Move History** | Navigate through games with full move replay |

### 🛠️ For Developers
| Feature | Description |
|---------|-------------|
| **TypeScript** | Full type safety and modern development experience |
| **Modular Architecture** | Clean separation of AI providers and chess logic |
| **WebAssembly Integration** | Client-side Stockfish for performance |
| **Extensible AI System** | Easy to add new AI providers and models |
| **Real-time Updates** | Reactive state management with Zustand |

---

## 🚀 Getting Started

### 📋 Prerequisites

- **Node.js 18+** or **Bun** (recommended)
- **Google AI API Key** ([Get one free here](https://ai.google.dev/))

### ⚡ Quick Setup

1. **Clone & Install**
   ```bash
   git clone <your-repo-url>
   cd ai-chess-board
   npm install
   # or with bun
   bun install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   # or with bun
   bun dev
   ```

3. **Open in Browser**
   Navigate to `http://localhost:3000`

4. **Configure AI** (First Time)
   - Click "AI Settings" button
   - Enter your Gemini API key in the configuration panel
   - Select your preferred AI models
   - Start playing! 🎉

---

## 🎲 Usage

### 👤 For Beginners

1. **🔑 Set Up API Key**
   - Get a free API key from [Google AI Studio](https://ai.google.dev/)
   - Click "AI Settings" in the app
   - Paste your key in the "API Configuration" section

2. **🎮 Start Playing**
   - Choose "Human" for yourself and "AI" for your opponent
   - Select an AI model (Gemini 2.0 Flash recommended for beginners)
   - Make your moves by clicking pieces on the board

3. **🤖 Watch AI vs AI**
   - Set both players to "AI" with different models
   - Click "Start Game" to begin the AI match
   - Enjoy the automated gameplay!

### 👨‍💻 For Developers

<details>
<summary><strong>🏗️ Architecture Overview</strong></summary>

```
src/
├── components/chess/     # Chess UI components
├── lib/
│   ├── ai-chess/        # AI provider implementations
│   ├── contexts/        # React contexts
│   ├── hooks/           # Custom React hooks
│   └── store/           # Zustand state management
└── types/               # TypeScript definitions
```

**Key Technologies:**
- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Chess Logic**: Chess.js library
- **Board UI**: react-chessboard
- **AI Integration**: Google Gemini API
- **Analysis**: Stockfish WebAssembly
- **State**: Zustand store
- **Styling**: Tailwind CSS

</details>

<details>
<summary><strong>🔌 Adding Custom AI Providers</strong></summary>

1. Implement the `AIChessProvider` interface:
```typescript
class MyAIProvider implements AIChessProvider {
  async getBestMove(fen: string, callback: (move: string) => void) {
    // Your AI logic here
  }
}
```

2. Register in the provider registry:
```typescript
import { ProviderRegistry } from '@/lib/ai-chess/provider-registry';
ProviderRegistry.register(new MyAIProvider());
```

</details>

---

## 🎨 Screenshots

<div align="center">

### 🏠 Main Interface
*Clean, modern chess board with AI controls*

### ⚙️ AI Configuration
*Easy-to-use settings panel for AI models*

### 📊 Analysis View
*Real-time Stockfish analysis and evaluation*

</div>

---

## 🔧 Advanced Configuration

### 🎛️ AI Model Settings

| Setting | Description | Recommended |
|---------|-------------|-------------|
| **Depth** | Analysis depth (10-25) | 15 for balance |
| **Time Limit** | Max thinking time | 5-10 seconds |
| **Temperature** | AI creativity (0-1) | 0.1 for strong play |

### ⚡ Performance Tips

- **For Best Performance**: Use Bun instead of npm
- **For Analysis**: Increase Stockfish depth for stronger analysis
- **For AI Matches**: Use lower time limits for faster games
- **For Development**: Enable verbose logging in AI providers

---

## 🚨 Troubleshooting

### Common Issues

<details>
<summary><strong>❌ "API key not set" error</strong></summary>

**Solution**: 
1. Get your API key from [Google AI Studio](https://ai.google.dev/)
2. Click "AI Settings" → "API Configuration"
3. Paste the key and save
</details>

<details>
<summary><strong>⏳ Stockfish not loading</strong></summary>

**Solution**: 
- Wait 10-15 seconds for WebAssembly initialization
- Check browser console for errors
- Try refreshing the page
</details>

<details>
<summary><strong>🔄 AI moves taking too long</strong></summary>

**Solution**: 
- Reduce time limit in AI settings
- Check your internet connection
- Verify API key has sufficient quota
</details>

---

## 🛡️ Technical Details

### 🏗️ Built With

- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[TypeScript 5](https://www.typescriptlang.org/)** - Type-safe development
- **[Chess.js](https://github.com/jhlywa/chess.js)** - Chess game logic
- **[Stockfish WASM](https://github.com/niklasf/stockfish.wasm)** - Chess engine
- **[Google Gemini API](https://ai.google.dev/)** - AI chess playing
- **[Zustand](https://zustand-demo.pmnd.rs/)** - State management
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling framework

### 🔒 Security & Privacy

- ✅ API keys stored locally in browser
- ✅ No game data sent to external servers
- ✅ Client-side chess analysis
- ✅ Open source and transparent

---

## 📈 Roadmap

- [ ] 🌐 Multiplayer online matches
- [ ] 📱 Mobile app version
- [ ] 🏆 Tournament mode
- [ ] 📚 Opening book integration
- [ ] 🎓 Chess puzzle trainer
- [ ] 📊 Advanced statistics
- [ ] 🔄 More AI providers (Claude, OpenAI)

---

## 🤝 Contributing

We welcome contributions! Whether you're:
- 🐛 Reporting bugs
- 💡 Suggesting features  
- 🔧 Improving code
- 📖 Updating documentation

Please feel free to open issues and pull requests.

### Development Setup
```bash
# Clone the repo
git clone <your-repo-url>
cd ai-chess-board

# Install dependencies
bun install

# Run in development mode
bun dev

# Run tests (if available)
bun test
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Stockfish Team** - For the incredible chess engine
- **Google AI** - For the Gemini API
- **Chess.js Contributors** - For the robust chess logic library
- **React Chessboard** - For the beautiful chess UI component

---

<div align="center">

**⭐ If you found this project helpful, please give it a star!**

[🐛 Report Bug](../../issues) • [💡 Request Feature](../../issues) • [💬 Discussions](../../discussions)

Made with ❤️ and ♟️

</div>
