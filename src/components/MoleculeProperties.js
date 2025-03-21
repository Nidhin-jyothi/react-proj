import React, { useState, useEffect } from "react";

const MoleculeProperties = ({ smiles }) => {  // Receiving smiles as a prop
    const [properties, setProperties] = useState(null);
    const [moleculeName, setMoleculeName] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!smiles) {
            setError("");
            setProperties(null);
            return; // Don't fetch if input is empty
        }

        const fetchProperties = async () => {
            setError("");
            setProperties(null);
            setMoleculeName("");

            try {
                const response = await fetch("http://localhost:8000/analyze", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ smiles }),  // Use the prop
                });

                const result = await response.json();

                if (response.ok && result.properties) {
                    setProperties(result.properties);
                    setMoleculeName(result.properties["Molecule Name"] || "Unknown Molecule"); 
                } else {
                    setError(result.error || "Invalid SMILES string or error fetching properties.");
                }
            } catch (error) {
                setError("Failed to fetch properties. Please try again.");
            }
        };

        fetchProperties();  // Auto-fetch when smiles changes
    }, [smiles]);  // Runs every time smiles updates

    return (
        <div className="molecule">
            <h2 className="space">Molecule Properties</h2>
            {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}
            {properties && (
                <div className="res" style={{  padding: "10px" }}>
                    <h3>Properties of {moleculeName}</h3> 
                    <ul>
                        {Object.entries(properties).map(([key, value]) => (
                            <li key={key}><strong>{key}:</strong> {value}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MoleculeProperties;
