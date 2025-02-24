import React, { useState, useEffect } from 'react';

const PredictionsPanel = () => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Example SMILES string; adjust as needed or pass in via props/context.
  const smiles = "CC(=O)Oc1ccccc1C(=O)O";

  useEffect(() => {
    const fetchPredictions = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("http://127.0.0.1:8000/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ smiles, prompt: "" }),
        });

        if (!response.ok) {
          throw new Error("Error fetching predictions");
        }

        const data = await response.json();

        // Convert the toxicity object to an array for easier mapping.
        // Expected format from Flask: 
        // { "NR-AR": { prediction: "Toxic", confidence: "0.78" }, ... }
        const toxicityPredictions = data.toxicity;
        const predictionsArray = Object.entries(toxicityPredictions).map(
          ([endpoint, details]) => ({
            endpoint,
            prediction: details.prediction,
            value: details.confidence,
          })
        );
        setPredictions(predictionsArray);
      } catch (err) {
        console.error("Error fetching predictions:", err);
        setError("Failed to load predictions.");
      }
      setLoading(false);
    };

    fetchPredictions();
  }, [smiles]);

  return (
    <div className="left-container">
      <h3>Predicted Endpoints</h3>
      {loading && <p>Loading predictions...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Prediction</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((pred) => (
              <tr key={pred.endpoint}>
                <td>{pred.endpoint}</td>
                <td>{pred.prediction}</td>
                <td>{pred.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PredictionsPanel;
