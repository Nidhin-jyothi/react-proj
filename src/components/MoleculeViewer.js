import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const MoleculeViewer = () => {
  const mountRef = useRef(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading molecule...');
  const moleculeGroupRef = useRef(new THREE.Group());

  useEffect(() => {
    let scene, camera, renderer, controls, animationId;

    const initThree = () => {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);

      camera = new THREE.PerspectiveCamera(
        75,
        mountRef.current.clientWidth / mountRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.z = 10;

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      mountRef.current.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 10);
      scene.add(directionalLight);
    };

    const parseMolData = (molData) => {
      const lines = molData.split('\n').filter(line => line.trim() !== '');
      
      // Find counts line more accurately (V2000 format specific)
      const countsLineIndex = lines.findIndex(line => 
        line.match(/^\s*\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+V2000$/i)
      );
    
      if (countsLineIndex === -1) throw new Error('Invalid MOL format');
      
      const countsLine = lines[countsLineIndex];
      const [numAtoms, numBonds] = countsLine.split(/\s+/).slice(0, 2).map(Number);
    
      // Parse atoms
      const atoms = [];
      const atomStart = countsLineIndex + 1;
      const atomEnd = atomStart + numAtoms;
      
      for (let i = atomStart; i < atomEnd; i++) {
        if (i >= lines.length) break;
        const line = lines[i];
        const parts = line.split(/\s+/).filter(p => p !== '');
        
        if (parts.length < 4) {
          console.warn('Skipping invalid atom line:', line);
          continue;
        }
        
        const [x, y, z, element] = [
          parseFloat(parts[0]) || 0,
          parseFloat(parts[1]) || 0,
          parseFloat(parts[2]) || 0,
          parts[3]?.replace(/[^a-zA-Z]/g, '') || 'X'
        ];
        
        atoms.push({ 
          position: new THREE.Vector3(x, -y, z), 
          element: element === '0' ? 'X' : element 
        });
      }
    
      // Parse bonds with strict validation
      const bonds = [];
      const bondStart = atomEnd;
      const bondEnd = bondStart + numBonds;
      
      for (let i = bondStart; i < bondEnd; i++) {
        if (i >= lines.length) break;
        const line = lines[i];
        const parts = line.split(/\s+/).filter(p => p !== '');
        
        if (parts.length < 3 || !parts[0]?.match(/^\d+$/) || !parts[1]?.match(/^\d+$/)) {
          console.warn('Skipping invalid bond line:', line);
          continue;
        }
        
        const atom1 = parseInt(parts[0]) - 1;
        const atom2 = parseInt(parts[1]) - 1;
        const order = parseInt(parts[2]) || 1;
        
        if (
          isNaN(atom1) || isNaN(atom2) || 
          atom1 < 0 || atom2 < 0 || 
          atom1 >= atoms.length || 
          atom2 >= atoms.length
        ) {
          console.warn('Skipping bond with invalid indices:', line);
          continue;
        }
        
        bonds.push({ atom1, atom2, order });
      }
    
      return { atoms, bonds };
    };

    const createMolecule = (atoms, bonds) => {
      const group = new THREE.Group();
      const atomColors = { 
        'C': 0x888888, 'O': 0xff4444, 'H': 0xffffff,
        'N': 0x0000ff, 'S': 0xffff00, 'P': 0xffa500 
      };

      atoms.forEach((atom, index) => {
        if (!atom.position) {
          console.warn(`Skipping atom ${index} with missing position`);
          return;
        }
        
        const geometry = new THREE.SphereGeometry(0.4, 32, 32);
        const material = new THREE.MeshPhongMaterial({ 
          color: atomColors[atom.element] || 0x888888 
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(atom.position);
        group.add(sphere);
      });

      bonds.forEach((bond, index) => {
        const atom1 = atoms[bond.atom1];
        const atom2 = atoms[bond.atom2];
        
        if (!atom1?.position || !atom2?.position) {
          console.warn(`Skipping bond ${index} with missing atoms`);
          return;
        }

        const start = atom1.position;
        const end = atom2.position;
        const distance = start.distanceTo(end);
        const geometry = new THREE.CylinderGeometry(0.1, 0.1, distance, 8);
        const material = new THREE.MeshPhongMaterial({ color: 0xcccccc });
        const cylinder = new THREE.Mesh(geometry, material);
        
        const center = new THREE.Vector3().lerpVectors(start, end, 0.5);
        cylinder.position.copy(center);
        cylinder.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3().subVectors(end, start).normalize()
        );
        group.add(cylinder);
      });

      return group;
    };

    const loadMolecule = async () => {
      try {
        const smiles = "CC(=O)Oc1ccccc1C(=O)O";
        const convertResponse = await fetch('http://127.0.0.1:8000/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smiles })
        });

        if (!convertResponse.ok) throw new Error('Conversion failed');
        const { mol_block } = await convertResponse.json();
        
        const { atoms, bonds } = parseMolData(mol_block);
        scene.remove(moleculeGroupRef.current);
        
        moleculeGroupRef.current = createMolecule(atoms, bonds);
        scene.add(moleculeGroupRef.current);

        const box = new THREE.Box3().setFromObject(moleculeGroupRef.current);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        camera.position.copy(center).add(new THREE.Vector3(0, 0, size.length() * 1.5));
        controls.target.copy(center);
        
        setLoadingMessage('');
      } catch (error) {
        console.error('Error:', error);
        setLoadingMessage('Failed to load molecule');
      }
    };

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    initThree();
    loadMolecule();
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100vh' }}>
      {loadingMessage && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '1.2rem'
        }}>
          {loadingMessage}
        </div>
      )}
    </div>
  );
};

export default MoleculeViewer;