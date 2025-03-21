import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const PredictionsChart = ({ smiles }) => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchChartData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("http://127.0.0.1:8000/chart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ smiles }),
        });
        if (!response.ok) {
          throw new Error("Error fetching chart data");
        }
        const data = await response.json();
        setPredictions(data.predictions);
      } catch (err) {
        console.error("Error fetching chart data:", err);
        setError("Failed to load chart data.");
      }
      setLoading(false);
    };

    fetchChartData();
  }, [smiles]);

  const chartData = {
    labels: predictions.map((pred) => pred.endpoint),
    datasets: [
      {
        label: 'Confidence',
        data: predictions.map((pred) => parseFloat(pred.value)),
        backgroundColor: 'rgba(75,192,192,0.4)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Prediction Confidence by Endpoint' },
    },
  };

  if (loading) return <p>Loading chart...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="prediction-chart" style={{ marginTop: '20px' }}>
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
};

export default PredictionsChart;
