import React, { useState } from 'react';

const SummaryPanel = () => {
  const [prompt, setPrompt] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Example SMILES string; you can modify this or pass it as a prop.
  const smiles = "CC(=O)Oc1ccccc1C(=O)O";

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smiles, prompt }),
      });
      if (!response.ok) {
        throw new Error("Error fetching AI summary");
      }
      const data = await response.json();
      // data.gemini_response contains the AI response from your Flask backend.
      setSummary(data.gemini_response);
    } catch (err) {
      console.error("Error fetching AI summary:", err);
      setError("Failed to fetch AI summary.");
    }
    setLoading(false);
  };

  return (
    <div className="right-container">
      <h3>AI Summary</h3>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your question here..."
        style={{ width: "100%", height: "100px", marginBottom: "10px" }}
      />
      <button onClick={handleSubmit} disabled={loading || !prompt}>
        {loading ? "Loading..." : "Ask AI"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {summary && (
        <div style={{ marginTop: "15px" }}>
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
};

export default SummaryPanel;
