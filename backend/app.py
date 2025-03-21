from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import matplotlib
matplotlib.use('Agg')  # Set backend before importing pyplot
import matplotlib.pyplot as plt
from PIL import Image
from rdkit import Chem
from rdkit.Chem import Draw, AllChem, Descriptors
from rdkit.Chem.rdmolfiles import MolToMolBlock
import deepchem as dc
import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables and configure Gemini
load_dotenv()
GENAI_API_KEY = os.getenv("GENAI_API_KEY", "")
genai.configure(api_key=GENAI_API_KEY)

# Load Pretrained Model
model = dc.models.GraphConvModel(n_tasks=12, mode='classification')
print("Pretrained model loaded successfully.")

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from your React frontend

def convert_smiles_to_mol(smiles):
    try:
        # Convert SMILES to molecule
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            raise ValueError("Invalid SMILES string provided")
        
        # Add hydrogens with explicit valence information
        mol = Chem.AddHs(mol, addCoords=True)
        
        # Generate 3D coordinates
        AllChem.EmbedMolecule(mol, AllChem.ETKDG())
        
        # Optimize with UFF
        AllChem.UFFOptimizeMolecule(mol)
        
        # Clean up the molecule structure
        Chem.SanitizeMol(mol)
        
        # Generate MOL block with proper hydrogen handling
        mol_block = MolToMolBlock(mol, includeStereo=True)
        
        # Debug: Verify atom and bond counts
        print(f"Generated MOL block with {mol.GetNumAtoms()} atoms and {mol.GetNumBonds()} bonds")
        
        return mol_block
        
    except Exception as e:
        print(f"Error in molecule generation: {str(e)}")
        raise ValueError(f"Molecule conversion failed: {str(e)}")


def predict_toxicity(smiles):
    try:
        featurizer = dc.feat.ConvMolFeaturizer()
        sample_molecules = featurizer.featurize([smiles])
        dataset = dc.data.NumpyDataset(X=sample_molecules)
        predictions = model.predict(dataset)
        endpoints = [
            "NR-AR", "NR-AR-LBD", "NR-AhR", "NR-Aromatase", "NR-ER",
            "NR-ER-LBD", "NR-PPAR-gamma", "SR-ARE", "SR-ATAD5",
            "SR-HSE", "SR-MMP", "SR-p53"
        ]
        results = {}
        for i, endpoint in enumerate(endpoints):
            toxicity = "Toxic" if predictions[0, i, 1] > 0.5 else "Non-Toxic"
            confidence = predictions[0, i, 1]
            results[endpoint] = {
                "prediction": toxicity,
                "confidence": f"{confidence:.2f}"
            }
        explanation = "\n".join(
            f"{k}: {v['prediction']} (confidence: {v['confidence']})"
            for k, v in results.items()
        )
        return results, explanation
    except Exception as e:
        return {"Error": f"Prediction error: {str(e)}"}, ""

def get_molecule_properties(smiles):
    try:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None, "Invalid SMILES string"
        properties = {
            "Molecular Weight": f"{Descriptors.ExactMolWt(mol):.2f}",
            "LogP": f"{Descriptors.MolLogP(mol):.2f}",
            "H-Bond Donors": str(Descriptors.NumHDonors(mol)),
            "H-Bond Acceptors": str(Descriptors.NumHAcceptors(mol)),
            "Rotatable Bonds": str(Descriptors.NumRotatableBonds(mol)),
            "TPSA": f"{Descriptors.TPSA(mol):.2f}",
            "Aromatic Rings": str(Descriptors.NumAromaticRings(mol))
        }
        explanation = (
            f"Molecular Weight: {properties['Molecular Weight']} g/mol\n"
            f"LogP: {properties['LogP']} (lipophilicity)\n"
            f"H-Bond Donors: {properties['H-Bond Donors']}\n"
            f"H-Bond Acceptors: {properties['H-Bond Acceptors']}\n"
            f"Rotatable Bonds: {properties['Rotatable Bonds']}\n"
            f"TPSA: {properties['TPSA']} Å²\n"
            f"Aromatic Rings: {properties['Aromatic Rings']}"
        )
        return properties, explanation
    except Exception as e:
        return None, str(e)

def generate_molecule_image(smiles):
    try:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None
        AllChem.Compute2DCoords(mol)
        img = Draw.MolToImage(mol, size=(400, 400))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
        return encoded  # Return as base64 string
    except Exception as e:
        return None

def query_gemini(prompt, smiles, properties_explanation, toxicity_explanation):
    try:
        model_gemini = genai.GenerativeModel("gemini-1.5-flash")
        context = f"""
Analysis for molecule with SMILES: {smiles}

{properties_explanation}

{toxicity_explanation}

Please consider all the above information when answering the following question.
        """
        response = model_gemini.generate_content(f"{context}\n\nQuestion: {prompt}")
        return response.text
    except Exception as e:
        return f"Error: {str(e)}"

def generate_toxicity_plot(toxicity_results):
    """Generate a bar chart visualization of toxicity endpoint predictions."""
    try:
        endpoints = list(toxicity_results.keys())
        confidences = [float(toxicity_results[endpoint]['confidence']) for endpoint in endpoints]

        plt.figure(figsize=(12, 6))
        bars = plt.bar(endpoints, confidences, color='#4CAF50')
        
        # Add value labels on top of each bar
        for bar in bars:
            height = bar.get_height()
            plt.text(bar.get_x() + bar.get_width()/2., height,
                     f'{height:.2f}',
                     ha='center', va='bottom')

        plt.xticks(rotation=45, ha='right', fontsize=8)
        plt.ylabel('Confidence Score', fontweight='bold')
        plt.ylim(0, 1.1)
        plt.title('Toxicity Endpoints Confidence Scores', fontweight='bold')
        plt.grid(axis='y', linestyle='--', alpha=0.7)
        plt.tight_layout()

        # Save plot to bytes buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        plt.close()
        buf.seek(0)
        return base64.b64encode(buf.read()).decode('utf-8')
    except Exception as e:
        print(f"Error generating toxicity plot: {str(e)}")
        return None

def generate_2d_structure(smiles):
    """Generate 2D molecular structure visualization with RDKit."""
    try:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None
            
        # Generate 2D coordinates
        AllChem.Compute2DCoords(mol)
        
        # Customize visualization
        drawer = Draw.rdMolDraw2D.MolDraw2DSVG(400, 400)
        drawer.DrawMolecule(mol)
        drawer.FinishDrawing()
        
        # Get SVG content and convert to base64
        svg = drawer.GetDrawingText()
        return f"data:image/svg+xml;base64,{base64.b64encode(svg.encode()).decode()}"
    except Exception as e:
        print(f"Error generating 2D structure: {str(e)}")
        return None

@app.route("/convert", methods=["POST"])
def convert():
    data = request.get_json()
    smiles = data.get("smiles")
    if not smiles:
        return jsonify({"error": "No SMILES string provided"}), 400
    try:
        mol_block = convert_smiles_to_mol(smiles)
        return jsonify({
            "message": "Molecule MOL file created successfully.",
            "mol_block": mol_block
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    smiles = data.get("smiles")
    prompt = data.get("prompt", "")
    
    properties, prop_explanation = get_molecule_properties(smiles)
    toxicity, tox_explanation = predict_toxicity(smiles)
    image_base64 = generate_molecule_image(smiles)
    molecule_image_2d = generate_2d_structure(smiles)
    toxicity_plot = generate_toxicity_plot(toxicity)
    gemini_response = ""
    if prompt:
        gemini_response = query_gemini(prompt, smiles, prop_explanation, tox_explanation)
    
    return jsonify({
        "properties": properties,
        "toxicity": toxicity,
        "molecule_image": image_base64,
        "gemini_response": gemini_response,
    })

if __name__ == "__main__":
    app.run(debug=True, port=8000)
