<div align="center">
  <h1>🧠 AI Question Paper Analyzer & Generator</h1>
  <p>
    <strong>A next-generation AI-powered backend for extracting, analyzing, generating, and modifying academic question papers.</strong>
  </p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/AI%20Powered-FF6F00?style=for-the-badge&logo=google-gemini&logoColor=white" alt="AI" />
    <img src="https://img.shields.io/badge/XGBoost-1C1C1C?style=for-the-badge&logoColor=white" alt="XGBoost" />
  </p>
</div>

<br />

## ✨ Features

- **📄 Smart OCR Extraction:** Extracts questions from uploaded PDFs or images of question papers automatically.
- **📊 Cognitive Difficulty Analysis:** Uses a Hybrid XGBoost model (`hybrid_xgboost_model.pkl`) alongside AI to predict question difficulty and cognitive levels (Bloom's Taxonomy).
- **🔄 AI Question Generation:** Automatically generate alternative questions based on the difficulty and topic of existing ones.
- **⚖️ Question Paper Comparison:** Compare multiple question papers for similarity, topic coverage, and difficulty distribution.
- **✏️ Interactive Modification:** Instantly tweak or rewrite extracted questions using AI agents.
- **📥 Seamless Export:** Export finalized question papers to PDF or Word formats.

## 🛠️ Tech Stack

- **Backend Framework:** [FastAPI](https://fastapi.tiangolo.com/) for lightning-fast API responses.
- **AI & ML:** Integration with LLMs and a custom Hybrid XGBoost model.
- **Computer Vision:** Advanced OCR capabilities for document parsing.
- **Frontend:** Built-in static UI serving vanilla HTML/JS/CSS.

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vinayraut71-source/question-paper.git
   cd question-paper
   ```

2. **Set up a Virtual Environment:**
   ```bash
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On Mac/Linux
   source venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables:**
   Create a `.env` file in the root directory and add your necessary API keys (e.g., LLM keys, database credentials).
   ```env
   # Example .env file
   AI_API_KEY=your_secret_key_here
   ```

5. **Run the Server:**
   ```bash
   uvicorn main:app --reload
   ```
   The backend and the static UI will be available at `http://127.0.0.1:8000`.

## 📁 Project Structure

```
mlBackend/
├── compare/                 # Logic for comparing different question papers
├── export/                  # Exporting papers to Word/PDF formats
├── generator/               # AI question generation logic
├── modifier/                # Question modification endpoints
├── ocr/                     # Optical Character Recognition and cleaning
├── static/                  # Frontend HTML/CSS/JS files
├── main.py                  # FastAPI application entry point
├── requirements.txt         # Python dependencies
├── Dockerfile               # Containerization support
└── hybrid_xgboost_model.pkl # Pre-trained ML model for difficulty prediction
```

## 🌐 API Documentation

Once the server is running, navigate to the built-in Swagger UI to interact with all endpoints:
- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **ReDoc:** `http://127.0.0.1:8000/redoc`

---

<div align="center">
  <i>Built with ❤️ for better education.</i>
</div>
