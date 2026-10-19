import './style.css';
import narrativeData from './narrative.json';
import {
  Engine,
  Scene,
  SceneLoader,
  Color3,
  Color4,
  Vector3,
  UniversalCamera,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  ActionManager,
  ExecuteCodeAction,
  HavokPlugin,
  PhysicsAggregate,
  PhysicsShapeType,
  PBRMaterial,
  AbstractMesh,
} from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  TextBlock,
  Control,
} from '@babylonjs/gui';
import HavokPhysics from '@babylonjs/havok';
import havokWasmUrl from '@babylonjs/havok/lib/esm/HavokPhysics.wasm?url';

// Import registers the GLTF / GLB with Babylon:
import '@babylonjs/loaders/glTF';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true);

let activeScene: Scene | null = null;
let hkInstance: any = null;


// Helper function for loading narrative

// Dialogue UI Elements
const dialogueBox = document.getElementById('dialogue-box') as HTMLDivElement;
const dialogueTitle = document.getElementById('dialogue-title') as HTMLElement;
const dialogueText = document.getElementById('dialogue-text') as HTMLElement;
const dialogueClose = document.getElementById('dialogue-close') as HTMLButtonElement;

dialogueClose.addEventListener('click', () => {
  dialogueBox.classList.add('hidden');
});

// Helper function to show text
function displayNarrative(key: string) {
  const entry = narrativeData[key as keyof typeof narrativeData];
  if (!entry) return;

  dialogueTitle.textContent = entry.title;
  dialogueText.textContent = entry.text;
  dialogueBox.classList.remove('hidden');
}

// Attach to the loaded mesh
export function attachNarrativeTrigger(mesh: AbstractMesh, narrativeKey: string, scene: Scene) {
  mesh.isPickable = true;
  mesh.actionManager = new ActionManager(scene);

  mesh.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
      displayNarrative(narrativeKey);
    })
  );
}


// Helper function for loading models 

// Define the models and where they should sit in the scene
interface ModelConfig {
  file: string;
  position: Vector3;
  scale?: number;
  narrativeKey?: string; // Key matching your narrative.json entry
}

const modelsToLoad: ModelConfig[] = [
  { file: 'building-a.glb', position: new Vector3(-6, 0, 0), scale: 1 ,narrativeKey: 'building-a'},
  { file: 'building-c.glb', position: new Vector3(-2, 0, 0), scale: 1 ,narrativeKey: 'building-c'},
  { file: 'building-p.glb', position: new Vector3(2, 0, 0), scale: 1 },
  { file: 'detail-tank.glb', position: new Vector3(6, 0, 0), scale: 1 },
  { file: 'water-tower.glb', position: new Vector3(3, 3, 0), scale: 1,narrativeKey: 'water-tower' },
];

// Load all models asynchronously
async function loadKenneyModels(scene: Scene) {
  for (const config of modelsToLoad) {
    // Parameters: meshNames ("" for all), rootFolder, fileName, scene
    const result = await SceneLoader.ImportMeshAsync(
      '',
      './models/',
      config.file,
      scene
    );

    // The first entry is always the root transform node of the GLB
    const root = result.meshes[0];
    root.name = config.file;
    root.position = config.position;

    if (config.scale) {
      root.scaling.setAll(config.scale);
    }
	
	// Determine the key (uses narrativeKey if defined, otherwise strips '.glb' from filename)
    const key = config.narrativeKey || config.file.replace('.glb', '');

    // Enable picking and add a click event to all child meshes
    for (const mesh of result.meshes) {
      if (mesh.getTotalVertices() > 0) {
        mesh.isPickable = true;
        mesh.actionManager = new ActionManager(scene);
        mesh.actionManager.registerAction(
          new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
			displayNarrative(key);
            console.log(`Clicked on: ${config.file} (part: ${mesh.name})`);
          })
        );
      }
    }
  }
}



// ==========================================
// SCENE A (The Falling Sphere)
// ==========================================
function buildSceneA(engine: Engine, canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.1, 0.2, 0.3, 1);
  scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, hkInstance));

  const camera = new UniversalCamera('camA', new Vector3(0, 5, -15), scene);
  camera.setTarget(Vector3.Zero());
  camera.attachControl(canvas, true);

  const light = new HemisphericLight('LightA', new Vector3(0, 1, 0), scene);

  // setting different light color and atmosphere

  light.diffuse = new Color3(1, 0.9, 0.8);       
  light.groundColor = new Color3(0.2, 0.2, 0.3);  
  light.specular = new Color3(1, 1, 1);           
  light.intensity = 0.8;                          
  


  // Ground (Mass 0 = static)
  const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, restitution: 0.5 }, scene);

  // Sphere
  const sphere = MeshBuilder.CreateSphere('sphere', { diameter: 2 }, scene);
  sphere.position.y = 8;
  new PhysicsAggregate(sphere, PhysicsShapeType.SPHERE, { mass: 1, restitution: 0.8 }, scene);

	// Create the PBR material
	const goldPbr = new PBRMaterial('goldMaterial', scene);

	// Set base color (Albedo replaces Diffuse in PBR)
	goldPbr.albedoColor = new Color3(1.0, 0.76, 0.33); // Gold tone

	// Set physical surface properties (Values between 0.0 and 1.0)
	goldPbr.metallic = 0.5;   // 1.0 = full conductor/metal, 0.0 = dielectric (plastic, wood)
	goldPbr.roughness = 0.15; // 0.0 = mirror finish, 1.0 = rough matte surface

	// Attach to sphere
	sphere.material = goldPbr;



  // GUI
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('UI');
  const text = new TextBlock();
  text.text = 'SCENE A: Click the falling SPHERE to swap';
  text.color = 'white';
  text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  ui.addControl(text);

  // Click Trigger
  sphere.actionManager = new ActionManager(scene);
  sphere.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
      scene.dispose();
      activeScene = buildSceneB(engine, canvas);
    })
  );

  return scene;
}

// ==========================================
// SCENE B (The Falling Box)
// ==========================================
function buildSceneB(engine: Engine, canvas: HTMLCanvasElement): Scene {
	
  const scene = new Scene(engine);
  loadKenneyModels(scene);
  scene.clearColor = new Color4(0.4, 0.1, 0.1, 1);

  scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, hkInstance));

  const camera = new UniversalCamera('camB', new Vector3(0, 5, -15), scene);
  camera.setTarget(Vector3.Zero());
  camera.attachControl(canvas, true);

  const light = new DirectionalLight('LightB', new Vector3(-1, -2, -1), scene);
  light.diffuse = new Color3(1, 0.7, 0.4); // Golden hour orange tint
  light.intensity = 1.2;
  // Ground
  const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, restitution: 0.1 }, scene);

  // Box
  const box = MeshBuilder.CreateBox('box', { size: 2 }, scene);
  box.position.y = 8;
  new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 1, restitution: 0.2 }, scene);

  // Create the crystal material
const crystalMat = new PBRMaterial('crystalMat', scene);
crystalMat.metallic = 0.0;
crystalMat.roughness = 0.15;
crystalMat.alpha = 0.1; // Base transparency


crystalMat.subSurface.tintColor = new Color3(0.6, 0.2, 0.9); // Amethyst purple
// Enable physical refraction
crystalMat.subSurface.isRefractionEnabled = true;
crystalMat.subSurface.indexOfRefraction = 1.54; // 1.54 is the optical index for quartz crystal

// Attach to the falling box
box.material = crystalMat;

  // GUI
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('UI');
  const text = new TextBlock();
  text.text = 'SCENE B: Click the fallen BOX to swap';
  text.color = 'yellow';
  text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  ui.addControl(text);

  // Click Trigger
  box.actionManager = new ActionManager(scene);
  box.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
      scene.dispose();
      activeScene = buildSceneA(engine, canvas);
    })
  );

  return scene;
}

// ==========================================
// Application Bootstrap
// ==========================================
async function init() {
  // Vite resolves the WebAssembly binary path reliably using ?url
  hkInstance = await HavokPhysics({
    locateFile: () => havokWasmUrl,
  });

  activeScene = buildSceneA(engine, canvas);

  engine.runRenderLoop(() => {
    if (activeScene) {
      activeScene.render();
    }
  });

  window.addEventListener('resize', () => {
    engine.resize();
  });
}

init();