import React, { useState } from 'react';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import styled from 'styled-components';

const SummaryPanel = ({smiles}) => {
  const [prompt, setPrompt] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Example SMILES string; you can modify this or pass it as a prop.
  //const smiles = "CC(=O)Oc1ccccc1C(=O)O";

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
      {/* Using PrimeReact InputTextarea with autoResize */}
      <InputTextarea
        autoResize
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your question here..."
        rows={5}
        cols={30}
        style={{
          width: "100%",
          marginBottom: "10px",
          backgroundColor: "black",
          border: "black",
          color: "white"
        }}
      />

      <StyledWrapper><Button
        label={loading ? "Loading..." : "Ask AI"}
        icon="pi pi-check"
        loading={loading}
        disabled={loading || !prompt}
        onClick={handleSubmit}
      /></StyledWrapper>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {summary && (
        <div style={{ marginTop: "15px" }}>
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
};

const StyledWrapper = styled.div`
  button {
    --color: #0077ff;
    font-family: inherit;
    display: inline-block;
    width: 6em;
    height: 2.6em;
    line-height: 2.5em;
    overflow: hidden;
    cursor: pointer;
    margin: 20px;
    font-size: 17px;
    z-index: 1;
    color: var(--color);
    border: 2px solid var(--color);
    border-radius: 6px;
    position: relative;
  }

  button::before {
    position: absolute;
    content: "";
    background: var(--color);
    width: 150px;
    height: 200px;
    z-index: -1;
    border-radius: 50%;
  }

  button:hover {
    color: white;
  }

  button:before {
    top: 100%;
    left: 100%;
    transition: 0.3s all;
  }

  button:hover::before {
    top: -30px;
    left: -30px;
  }`;

export default SummaryPanel;
