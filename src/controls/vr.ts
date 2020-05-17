import { each, size } from 'lodash';
import * as THREE from 'three';
import { WebXRManager } from 'three/src/renderers/webxr/WebXRManager';
import { MotionController } from '@webxr-input-profiles/motion-controllers';
import ControllerModel from './vr/ControllerModel';
import { createMotionController } from './vr/utils';
import { debugProfiles } from './vr/debugProfiles';
import { getControllerMappings, applyMappings, Mappings } from './vr/mappings';

export class VRControls {
    xr: WebXRManager;
    ctx: any;
    controllers: {
        [key: number]: {
            info: MotionController;
            model: ControllerModel;
            mappings?: Mappings;
        }
    };
    pointers: any[];
    activePointer: number;
    triggered: boolean;
    skipping: boolean;

    constructor(params: any, sceneManager: any, game: any, renderer: any) {
        this.xr = renderer.threeRenderer.xr;
        this.ctx = {
            sceneManager,
            game,
            state: {}
        };
        this.controllers = {};
        this.pointers = [];
        this.triggered = false;
        this.skipping = false;
        this.activePointer = null;
        this.onInputSourcesChange = this.onInputSourcesChange.bind(this);
        this.initializeVRController(0);
        this.initializeVRController(1);
        if (params.vrCtrlDBG) {
            debugProfiles(this);
        }
    }

    dispose() {}

    update() {
        const { controlsState } = this.ctx.game;
        const scene = this.ctx.sceneManager.getScene();
        const ctx = {
            ...this.ctx,
            scene,
            camera: scene && scene.camera
        };
        controlsState.action = 0;
        each(this.controllers, (controller) => {
            controller.info.updateFromGamepad();
            controller.model.update();
            applyMappings(controller.info, controller.mappings, ctx);
        });
        for (let i = 0; i < 2; i += 1) {
            if (this.activePointer === i) {
                const vrController = this.xr.getController(i);
                this.ctx.game.controlsState.vrPointerTransform.copy(vrController.matrixWorld);
            }
        }
        if (this.skipping) {
            if (controlsState.action === 0) {
                this.skipping = false;
            } else {
                controlsState.action = 0;
            }
        }
        if (controlsState.skipListener) {
            controlsState.action = 0;
        }
        controlsState.vrTriggerButton = this.triggered;
        this.triggered = false;
    }

    onInputSourcesChange(event) {
        event.added.forEach((xrInputSource) => {
            createMotionController(xrInputSource);
        });
    }

    updateMappings() {
        const numControllers = size(this.controllers);
        each(this.controllers, (controller) => {
            const mappings = getControllerMappings(controller.info, numControllers);
            controller.model.loadLabels(mappings);
            controller.mappings = mappings;
        });
    }

    initializeVRController(index) {
        const vrControllerGrip = this.xr.getControllerGrip(index);

        vrControllerGrip.addEventListener('connected', async (event) => {
            const info = await createMotionController(event.data);
            const model = await new ControllerModel(info).load();

            vrControllerGrip.add(model.threeObject);
            this.controllers[index] = {
                info,
                model
            };
            this.updateMappings();
        });

        vrControllerGrip.addEventListener('disconnected', () => {
            const controller = this.controllers[index];
            if (controller && controller.model) {
                vrControllerGrip.remove(this.controllers[index].model.threeObject);
            }
            delete this.controllers[index];
        });

        const vrController = this.xr.getController(index);

        vrController.addEventListener('connected', () => {
            const pointerGeom = new THREE.ConeGeometry(0.002, 0.4, 4);
            const pointerMaterial = new THREE.MeshBasicMaterial({
                color: 0xFFFFFF,
                transparent: true,
                opacity: 0.5
            });
            const pointer = new THREE.Mesh(pointerGeom, pointerMaterial);
            pointer.position.set(0, 0, -0.2);
            pointer.rotation.x = -Math.PI / 2;
            pointer.rotation.y = Math.PI / 4;
            pointer.visible = false;

            vrController.add(pointer);
            this.pointers[index] = pointer;
            if (this.activePointer === null) {
                this.activatePointer(index);
            }
        });

        vrController.addEventListener('disconnected', () => {
            if (vrController.children.length) {
                vrController.remove(this.pointers[index]);
            }
        });

        vrController.addEventListener('selectstart', () => {
            if (this.ctx.game.controlsState.skipListener) {
                this.ctx.game.controlsState.skipListener();
                this.skipping = true;
                return;
            }
            if (this.activePointer === null) {
                this.activatePointer(index);
            }
            if (this.activePointer !== index) {
                this.activatePointer(index);
            } else {
                this.triggered = true;
            }
        });
    }

    activatePointer(idx) {
        this.activePointer = idx;
        if (this.pointers[1 - idx]) {
            this.pointers[1 - idx].visible = false;
        }
        this.pointers[idx].visible = true;
    }
}
