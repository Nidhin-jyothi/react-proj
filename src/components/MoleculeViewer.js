import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';


const MoleculeViewer = ({smiles}) => {
  const mountRef = useRef(null);
  const isInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const moleculeGroupRef = useRef(null);
  const animationIdRef = useRef(null);
  console.log(smiles)
  useEffect(() => {
    if (isInitialized.current) {
      loadMolecule();
    }
  }, [smiles]);
  useEffect(() => {
    // Initialize scene, camera, renderer
    
    if (isInitialized.current) return;
    isInitialized.current = true;
    const scene = sceneRef.current;
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(25,
      window.innerWidth / window.innerHeight,
      4,
      100);
    camera.position.z = 5;
    cameraRef.current = camera;
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight);
    })
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    const rendererDom = renderer.domElement;
    mountRef.current?.appendChild(rendererDom);
    rendererRef.current = renderer;

    // Setup controls
    const controls = new OrbitControls(camera, rendererDom);
    controls.minZoom = 0.5;  // Minimum zoom level
    controls.maxZoom = 0.5;    // Maximum zoom level

    // Limit camera distance (alternate to zoom)
    controls.minDistance = 20;  // Closest the camera can get
    controls.maxDistance = 30; // Farthest the camera can go

    document.addEventListener("wheel", (event) => {
      const zoom = camera.position.distanceTo(controls.target);
  
      if (zoom <= controls.minDistance || zoom >= controls.maxDistance) {
          // Allow normal scrolling when zoom limit is reached
          controls.enableZoom = false; // Temporarily disable OrbitControls zoom
          document.body.style.overflow = "auto";
      } else {
          // Prevent normal scrolling while within zoom range
          event.preventDefault();
          controls.enableZoom = true; // Re-enable OrbitControls zoom
          document.body.style.overflow = "hidden";
      }
  });
  
  // Ensure zoom is always enabled when interacting
  controls.addEventListener("start", () => {
      controls.enableZoom = true;
  });

    // Limit vertical rotation (polar angle)
    controls.minPolarAngle = 0;    // Radians (0 = top-down)
    controls.maxPolarAngle = Math.PI / 2; // 90 degrees

    // Limit horizontal rotation (azimuth angle)
    // controls.minAzimuthAngle = -Math.PI / 4; // -45 degrees
    // controls.maxAzimuthAngle = Math.PI / 4;  // +45 degrees

    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 0, 0);
    scene.add(directionalLight);

    loadMolecule();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Start animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      if (moleculeGroupRef.current) {
        moleculeGroupRef.current.rotation.y += 0.005;
        moleculeGroupRef.current.rotation.z += 0.005;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationIdRef.current);

      // Clear previous molecule
      if (moleculeGroupRef.current) {
        scene.remove(moleculeGroupRef.current);
      }

      // Safely remove renderer DOM element
      if (mountRef.current && rendererDom.parentNode === mountRef.current) {
        mountRef.current.removeChild(rendererDom);
      }

      // Dispose Three.js resources
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  const loadMolecule = async () => {
    try {
      // Remove existing molecule if any
      if (moleculeGroupRef.current) {
        sceneRef.current.remove(moleculeGroupRef.current);
        moleculeGroupRef.current = null;
      }
      if (!smiles || typeof smiles !== "string") {
        console.error("Invalid SMILES input:", smiles);
        return;
    }
      // const smiles = "CC(=O)Oc1ccccc1C(=O)O";      
      const response = await fetch('http://localhost:8000/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ smiles })
      });
      const data = await response.json();
      const molData = data.mol_block;
      const moleculeGroup = parseMolFile(molData);

      sceneRef.current.add(moleculeGroup);
      moleculeGroupRef.current = moleculeGroup;


      // Center camera
      const box = new THREE.Box3().setFromObject(moleculeGroup);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      cameraRef.current.position.copy(center);
      cameraRef.current.position.z += maxDim * 3;
      controlsRef.current.target.copy(center);

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading molecule:', error);
      setIsLoading(false);
    }
  };

  //Parsing of the molecule.mol file from backend
  const parseMolFile = (molData) => {
    const lines = molData.split('\n').map(line => line.replace(/\r/g, ''));
    const atoms = [];
    const bonds = [];
    const headerLine = lines[3];
    const numAtoms = parseInt(headerLine.substring(0, 3).trim(), 10);
    const numBonds = parseInt(headerLine.substring(3, 6).trim(), 10);

    for (let i = 0; i < numAtoms; i++) {
      const line = lines[i + 4];
      const x = parseFloat(line.substring(0, 10).trim());
      const y = parseFloat(line.substring(10, 20).trim());
      const z = parseFloat(line.substring(20, 30).trim());
      const element = line.substring(31, 34).trim();
      atoms.push({ position: new THREE.Vector3(x, y, z), element });
    }

    const bondStartLine = 4 + numAtoms;
    for (let i = 0; i < numBonds; i++) {
      const line = lines[bondStartLine + i];
      const atom1 = parseInt(line.substring(0, 3).trim(), 10) - 1;
      const atom2 = parseInt(line.substring(3, 6).trim(), 10) - 1;
      const order = parseInt(line.substring(6, 9).trim(), 10);
      bonds.push({ atom1, atom2, order });
    }

    return createMoleculeGeometry(atoms, bonds);
  };

  const createMoleculeGeometry = (atoms, bonds) => {
    const group = new THREE.Group();

    atoms.forEach((atom) => {
      const radius = atom.element === 'H' ? 0.1 : 0.3;
      const geometry = new THREE.SphereGeometry(radius, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color: atom.element === 'H' ? 0xffffff :
         atom.element === 'C' ? 0x808080 :
          atom.element === 'N' ? 0x0000ff :
           atom.element === 'O' ? 0xff0000 
           : 0xff00ff,
        shininess: 100
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(atom.position);
      group.add(sphere);
    });

    bonds.forEach(bond => {
      const atom1 = atoms[bond.atom1];
      const atom2 = atoms[bond.atom2];
      const start = atom1.position;
      const end = atom2.position;

      const createBond = (offset) => {
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        const geometry = new THREE.CylinderGeometry(0.04, 0.04, length, 8);
        const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
        const cylinder = new THREE.Mesh(geometry, material);
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        cylinder.position.copy(midpoint);
        cylinder.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.clone().normalize()
        );

        if (offset !== 0) {
          const axis = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
          cylinder.position.add(axis.multiplyScalar(offset));
        }

        return cylinder;
      };

      switch (bond.order) {
        case 2:
          group.add(createBond(0.06));
          group.add(createBond(-0.06));
          break;
        case 3:
          group.add(createBond(0.1));
          group.add(createBond(0));
          group.add(createBond(-0.1));
          break;
        default:
          group.add(createBond(0));
          break;
      }
    });
    // console.log(atoms)
    // console.log(bonds)
    return group;
  };

  return (
    <div className="molecule-viewer-container">
      {/* Canvas container */}
      <div ref={mountRef} className="canvas-container" />
      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          Loading molecule...
        </div>
      )}
    </div>
  );
};

export default MoleculeViewer;