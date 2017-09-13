// @flow

import async from 'async';

import THREE from 'three';
import {loadHqrAsync} from '../hqr';
import type {Entity} from './entity';
import {loadEntity, getBodyIndex, getAnimIndex, getAnim} from './entity';
import {loadBody} from './body';
import {loadAnim} from './anim';
import {initSkeleton, createSkeleton, updateKeyframe, updateKeyframeInterpolation} from './animState';
import {processAnimAction} from './animAction';
import {loadMesh} from './geometries';
import {loadTexture2} from '../texture';
import {createBoundingBox} from '../utils/rendering';
import {DebugFlags} from '../utils';
import type {Time} from '../flowtypes';

export type Model = {
    state: any,
    anims: any,
    files: ?any,
    entities: Entity[],
    mesh: THREE.Object3D
}

export function loadModel(entityIdx: number, bodyIdx: number, animIdx: number, animState: any, envInfo: any, ambience: any, callback: Function) {
    async.auto({
        ress: loadHqrAsync('RESS.HQR'),
        body: loadHqrAsync('BODY.HQR'),
        anim: loadHqrAsync('ANIM.HQR'),
        anim3ds: loadHqrAsync('ANIM3DS.HQR')
    }, function(err, files) {
        callback(loadModelData(files, entityIdx, bodyIdx, animIdx, animState, envInfo, ambience));
    });
}

/** Load Models Data
 *  Model will hold data specific to a single model instance.
 *  This will allow to mantain different states for body animations.
 *  This module will still kept data reloaded to avoid reload twice for now.
 */
function loadModelData(files, entityIdx, bodyIdx, animIdx, animState: any, envInfo: any, ambience: any) {
    const palette = new Uint8Array(files.ress.getEntry(0));
    const entityInfo = files.ress.getEntry(44);
    const entities = loadEntity(entityInfo);

    const model = {
        palette: palette,
        files: files,
        bodies: [],
        anims: [],
        texture: loadTexture2(files.ress.getEntry(6), palette),
        state: null,
        mesh: null,
        entities: entities
    };

    const entity = entities[entityIdx];

    const realBodyIdx = getBodyIndex(entity, bodyIdx);
    const realAnimIdx = getAnimIndex(entity, animIdx);

    const body = loadBody(model, model.bodies, realBodyIdx, entity.bodies[bodyIdx]);
    const anim = loadAnim(model, model.anims, realAnimIdx);

    const skeleton = createSkeleton(body);
    initSkeleton(animState, skeleton, anim.loopFrame);
    model.mesh = loadMesh(body, model.texture, animState.bones, animState.matrixRotation, model.palette, envInfo, ambience);

    if (model.mesh) {
        model.boundingBox = body.boundingBox;
        if (DebugFlags.boundingBoxes) {
            const color = body.hasBoundingBox ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
            model.boundingBoxDebugMesh = createBoundingBox(body.boundingBox, color);
            model.mesh.add(model.boundingBoxDebugMesh);
        }
    }

    return model;
}

export function updateModel(sceneIsActive: any, model: any, animState: any, entityIdx: number, bodyIdx: number, animIdx: number, time: Time) {
    const entity = model.entities[entityIdx];
    const entityAnim = getAnim(entity, animIdx);
    if (entityAnim !== null) {
        const realAnimIdx = entityAnim.animIndex;
        const anim = loadAnim(model, model.anims, realAnimIdx);
        animState.loopFrame = anim.loopFrame;
        if (animState.prevRealAnimIdx !== -1 && realAnimIdx !== animState.prevRealAnimIdx) {
            updateKeyframeInterpolation(anim, animState, time, realAnimIdx);
        }
        if (realAnimIdx === animState.realAnimIdx || animState.realAnimIdx === -1) {
            updateKeyframe(anim, animState, time, realAnimIdx);
        }
        if (sceneIsActive) {
            processAnimAction(entityAnim, animState);
        }
    }
}
