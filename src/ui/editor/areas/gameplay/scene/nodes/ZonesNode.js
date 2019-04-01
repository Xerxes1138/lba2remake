import React from 'react';
import DebugData, {getObjectName, renameObject, locateObject} from '../../../../DebugData';
import {SceneGraphNode} from '../../sceneGraph/SceneGraphNode';
import {makeObjectsNode} from '../node_factories/objects';

const ZONE_TYPE = [
    'GOTO_SCENE',
    'CAMERA',
    'SCENERIC',
    'FRAGMENT',
    'BONUS',
    'TEXT',
    'LADDER',
    'CONVEYOR',
    'SPIKE',
    'RAIL'
];

const Zone = {
    dynamic: true,
    needsData: true,
    allowRenaming: () => true,
    rename: (zone, newName) => {
        renameObject('zone', zone.props.sceneIndex, zone.index, newName);
    },
    ctxMenu: [
        {
            name: 'Locate',
            onClick: (component, zone) => locateObject(zone)
        }
    ],
    name: zone => getObjectName('zone', zone.props.sceneIndex, zone.index),
    icon: zone => `editor/icons/zones/${ZONE_TYPE[zone.props.type]}.svg`,
    childProps: [
        {
            id: 'type',
            name: 'Type',
            value: zone => zone,
            render: (zone) => {
                const {r, g, b} = zone.color;
                const color = `rgba(${Math.floor(r * 256)},${Math.floor(g * 256)},${Math.floor(b * 256)},1)`;
                return <span style={{color}}>{ZONE_TYPE[zone.props.type]}</span>;
            }
        },
        {
            id: 'param',
            name: 'Param',
            value: (zone) => {
                let value = zone.props.snap;
                if (ZONE_TYPE[zone.props.type] === 'TEXT') {
                    if (DebugData.scope.scene.data.texts[value]) {
                        value = DebugData.scope.scene.data.texts[value].value;
                    }
                }
                return value;
            }
        },
    ],
    numChildren: zone => (zone.threeObject ? 1 : 0),
    child: () => SceneGraphNode,
    childData: zone => zone.threeObject,
    selected: (zone) => {
        const selection = DebugData.selection;
        return selection && selection.type === 'zone' && selection.index === zone.index;
    },
    onClick: (zone) => { DebugData.selection = {type: 'zone', index: zone.index}; },
    onDoubleClick: (zone, component, setRoot) => {
        locateObject(zone);
        setRoot();
    }
};

export const ZonesNode = makeObjectsNode('zone', {
    dynamic: true,
    needsData: true,
    name: () => 'Zones',
    icon: () => 'editor/icons/zone.svg',
    numChildren: scene => scene.zones.length,
    child: () => Zone,
    childData: (scene, idx) => scene.zones[idx],
    hasChanged: scene => scene.index !== DebugData.scope.scene.index,
    props: (data, ignored, component) => {
        const label = component.props.rootState.labels.zone;
        return [{
            id: 'visible',
            value: label,
            render: (visible) => {
                const style = {
                    width: 14,
                    height: 14,
                    cursor: 'pointer'
                };
                const onClick = () => {
                    component.props.rootStateHandler.setLabel('zone', !label);
                };
                return <img
                    style={style}
                    src={`editor/icons/${visible ? 'visible' : 'hidden'}.svg`}
                    onClick={onClick}
                />;
            }
        }];
    }
});
