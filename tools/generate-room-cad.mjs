import fs from 'node:fs';
import path from 'node:path';
import {
  ACadVersion,
  Arc,
  CadDocument,
  Color,
  DwgWriter,
  Layer,
  Line,
  TextEntity,
  XYZ,
} from '@node-projects/acad-ts';

const outputDir = path.resolve(process.argv[2] ?? './cad-output');
fs.mkdirSync(outputDir, { recursive: true });

const doc = new CadDocument();
doc.header.version = ACadVersion.AC1015;
doc.header.codePage = 'ANSI_1252';
doc.header.measurementUnits = 1;

function createLayer(name, colorIndex) {
  const layer = new Layer();
  layer.name = name;
  layer.color = new Color(colorIndex);
  doc.layers.add(layer);
  return layer;
}

const wallLayer = createLayer('A-WALL', 7);
const doorLayer = createLayer('A-DOOR', 3);
const windowLayer = createLayer('A-WINDOW', 4);
const dimLayer = createLayer('A-DIM', 2);
const textLayer = createLayer('A-TEXT', 7);

function registerEntity(entity) {
  if (typeof doc.modelSpace.addEntity === 'function') {
    doc.modelSpace.addEntity(entity);
    return;
  }
  if (doc.modelSpace.entities && typeof doc.modelSpace.entities.add === 'function') {
    doc.modelSpace.entities.add(entity);
    return;
  }
  throw new Error(`Unable to add entity to model space. Keys: ${Object.keys(doc.modelSpace).join(', ')}`);
}

function addLine(x1, y1, x2, y2, layer) {
  const entity = new Line();
  entity.startPoint = new XYZ(x1, y1, 0);
  entity.endPoint = new XYZ(x2, y2, 0);
  entity.layer = layer;
  registerEntity(entity);
  return entity;
}

function addRect(x1, y1, x2, y2, layer) {
  addLine(x1, y1, x2, y1, layer);
  addLine(x2, y1, x2, y2, layer);
  addLine(x2, y2, x1, y2, layer);
  addLine(x1, y2, x1, y1, layer);
}

function addArc(cx, cy, radius, startAngle, endAngle, layer) {
  const entity = new Arc(new XYZ(cx, cy, 0), radius, startAngle, endAngle);
  entity.layer = layer;
  registerEntity(entity);
  return entity;
}

function addText(value, x, y, height, rotation, layer) {
  const entity = new TextEntity();
  entity.value = value;
  entity.insertPoint = new XYZ(x, y, 0);
  entity.alignmentPoint = new XYZ(x, y, 0);
  entity.height = height;
  entity.rotation = rotation;
  entity.layer = layer;
  registerEntity(entity);
  return entity;
}

function addArrow(x, y, angle, size, layer) {
  const a1 = angle + Math.PI * 0.82;
  const a2 = angle - Math.PI * 0.82;
  addLine(x, y, x + size * Math.cos(a1), y + size * Math.sin(a1), layer);
  addLine(x, y, x + size * Math.cos(a2), y + size * Math.sin(a2), layer);
}

const roomWidth = 2830;
const roomDepth = 4000;
const sideWall = 200;
const topWall = 250;
const doorX1 = 150;
const doorWidth = 800;
const doorX2 = doorX1 + doorWidth;
const windowX1 = 275;
const windowWidth = 2280;
const windowX2 = windowX1 + windowWidth;

addRect(-sideWall, -sideWall, 0, roomDepth + topWall, wallLayer);
addRect(roomWidth, -sideWall, roomWidth + sideWall, roomDepth + topWall, wallLayer);
addRect(-sideWall, -sideWall, doorX1, 0, wallLayer);
addRect(doorX2, -sideWall, roomWidth + sideWall, 0, wallLayer);
addRect(-sideWall, roomDepth, windowX1, roomDepth + topWall, wallLayer);
addRect(windowX2, roomDepth, roomWidth + sideWall, roomDepth + topWall, wallLayer);

addLine(doorX1, 0, doorX1, doorWidth, doorLayer);
addArc(doorX1, 0, doorWidth, 0, Math.PI / 2, doorLayer);
addLine(doorX1, -35, doorX1, 35, doorLayer);
addLine(doorX2, -35, doorX2, 35, doorLayer);

addLine(windowX1, roomDepth + 75, windowX2, roomDepth + 75, windowLayer);
addLine(windowX1, roomDepth + 175, windowX2, roomDepth + 175, windowLayer);
addLine(windowX1, roomDepth, windowX1, roomDepth + topWall, windowLayer);
addLine(windowX2, roomDepth, windowX2, roomDepth + topWall, windowLayer);

const widthDimY = -520;
addLine(0, -250, 0, widthDimY - 60, dimLayer);
addLine(roomWidth, -250, roomWidth, widthDimY - 60, dimLayer);
addLine(0, widthDimY, roomWidth, widthDimY, dimLayer);
addArrow(0, widthDimY, 0, 75, dimLayer);
addArrow(roomWidth, widthDimY, Math.PI, 75, dimLayer);
addText(String(roomWidth), roomWidth / 2 - 150, widthDimY + 45, 120, 0, dimLayer);

const depthDimX = -520;
addLine(-250, 0, depthDimX - 60, 0, dimLayer);
addLine(-250, roomDepth, depthDimX - 60, roomDepth, dimLayer);
addLine(depthDimX, 0, depthDimX, roomDepth, dimLayer);
addArrow(depthDimX, 0, Math.PI / 2, 75, dimLayer);
addArrow(depthDimX, roomDepth, -Math.PI / 2, 75, dimLayer);
addText(String(roomDepth), depthDimX - 45, roomDepth / 2 - 160, 120, Math.PI / 2, dimLayer);

const windowDimY = roomDepth + topWall + 250;
addLine(windowX1, roomDepth + topWall + 30, windowX1, windowDimY + 60, dimLayer);
addLine(windowX2, roomDepth + topWall + 30, windowX2, windowDimY + 60, dimLayer);
addLine(windowX1, windowDimY, windowX2, windowDimY, dimLayer);
addArrow(windowX1, windowDimY, 0, 60, dimLayer);
addArrow(windowX2, windowDimY, Math.PI, 60, dimLayer);
addText(String(windowWidth), (windowX1 + windowX2) / 2 - 130, windowDimY + 40, 105, 0, dimLayer);

const doorDimY = -330;
addLine(doorX1, doorDimY, doorX2, doorDimY, dimLayer);
addArrow(doorX1, doorDimY, 0, 55, dimLayer);
addArrow(doorX2, doorDimY, Math.PI, 55, dimLayer);
addText(String(doorWidth), (doorX1 + doorX2) / 2 - 90, doorDimY + 30, 90, 0, dimLayer);

addText('NO.1 BEDROOM - APPROX.', 690, 2200, 160, 0, textLayer);
addText('CLEAR AREA APPROX. 11.32 SQ.M', 520, 1950, 110, 0, textLayer);
addText('UNIT: mm / FOR FURNITURE LAYOUT ONLY', 380, 1750, 90, 0, textLayer);

const target = new Uint8Array(16 * 1024 * 1024);
const writer = new DwgWriter(target, doc);
writer.write();
const dwgBytes = target.slice(0, writer.bytesWritten);

if (dwgBytes.length < 1000) {
  throw new Error(`DWG output is unexpectedly small: ${dwgBytes.length} bytes`);
}

const dwgPath = path.join(outputDir, '次卧一_概略空房图_AC1015.dwg');
fs.writeFileSync(dwgPath, dwgBytes);

const signature = Buffer.from(dwgBytes.slice(0, 6)).toString('ascii');
const manifest = {
  file: path.basename(dwgPath),
  signature,
  bytes: dwgBytes.length,
  version: 'AC1015',
  units: 'mm',
  clearWidth: roomWidth,
  clearDepth: roomDepth,
  approximateClearAreaSqm: Number(((roomWidth * roomDepth) / 1_000_000).toFixed(2)),
  doorOpening: doorWidth,
  windowOpening: windowWidth,
  furnitureIncluded: false,
  disclaimer: 'Approximate reconstruction from a photographed floor plan; not a construction drawing.',
};
fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
