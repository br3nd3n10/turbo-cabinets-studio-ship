// Current Turbo inventory as the packer and the renderer see it. Widths and depths are the
// carcass in inches. `bottom` is the placement height. Blind corner boxes carry the door
// position on their open face (frontOffset, frontWidth) from models/sku-v1/manifest.json.
export const INVENTORY = [
  { id: 'BBC39-L', kind: 'base', bank: 'base', width: 39, height: 34.5, depth: 24, blind: true, frontOffset: 24, frontWidth: 15 },
  { id: 'SB36', kind: 'base', bank: 'base', width: 36, height: 34.5, depth: 24 },
  { id: 'BWB18', kind: 'base', bank: 'base', width: 18, height: 34.5, depth: 24 },
  { id: 'B15-L', kind: 'base', bank: 'base', width: 15, height: 34.5, depth: 24 },
  { id: 'B12-R', kind: 'base', bank: 'base', width: 12, height: 34.5, depth: 24 },
  { id: 'F3-base', kind: 'filler', bank: 'base', width: 3, height: 34.5, depth: 24 },
  { id: 'WBC2730-L', kind: 'upper', bank: 'upper', width: 27, height: 36, depth: 12, bottom: 54, blind: true, frontOffset: 12, frontWidth: 15 },
  { id: 'W3630', kind: 'upper', bank: 'upper', width: 36, height: 36, depth: 12, bottom: 54 },
  { id: 'W3615', kind: 'upper', bank: 'upper', width: 36, height: 15, depth: 29.5, bottom: 75 },
  { id: 'W3015', kind: 'upper', bank: 'upper', width: 30, height: 15, depth: 12, bottom: 75 },
  { id: 'W2730', kind: 'upper', bank: 'upper', width: 27, height: 36, depth: 12, bottom: 54 },
  { id: 'W1230-L', kind: 'upper', bank: 'upper', width: 12, height: 36, depth: 12, bottom: 54 },
  { id: 'W1230-R', kind: 'upper', bank: 'upper', width: 12, height: 36, depth: 12, bottom: 54 },
  { id: 'F3-upper', kind: 'filler', bank: 'upper', width: 3, height: 36, depth: 12, bottom: 54 },
  { id: 'RANGE1.30', kind: 'appliance', bank: 'base', width: 30, height: 44.6, depth: 27 },
  { id: 'DISH-IQ6', kind: 'appliance', bank: 'base', width: 24, height: 34.4, depth: 25 },
  { id: 'REF.2D.36', kind: 'appliance', bank: 'base', width: 36, height: 64.9, depth: 29.5 },
];

export const SKU = new Map(INVENTORY.map((sku) => [sku.id, sku]));

export const FILLER = { base: SKU.get('F3-base'), upper: SKU.get('F3-upper') };

export function pick(ids) {
  return ids.map((id) => SKU.get(id)).filter(Boolean);
}
