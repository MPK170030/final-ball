// Club kit colour table. Update each season.
// Format: [body, second, striped]
// striped=true  → sleeves=body,   stripes=second (vertical stripe shirt)
// striped=false → sleeves=second, stripes=body   (plain / two-tone, stripes invisible)

export type KitDef = readonly [string, string, boolean]

const KITS: Record<string, KitDef> = {
  BHA: ['#0057B8', '#FFFFFF', true],
  LIV: ['#C8102E', '#C8102E', false],
  FUL: ['#F2F2F2', '#181818', false],
  ARS: ['#DB0007', '#FFFFFF', false],
  EVE: ['#1B45A8', '#1B45A8', false],
  BOU: ['#DA291C', '#181818', true],
  CHE: ['#034694', '#034694', false],
  AVL: ['#670E36', '#95BFE5', false],
  NEW: ['#181818', '#F2F2F2', true],
  BRE: ['#E30613', '#FFFFFF', true],
  SUN: ['#EB172B', '#FFFFFF', true],
  MCI: ['#6CABDD', '#6CABDD', false],
  MUN: ['#DA291C', '#DA291C', false],
  TOT: ['#F2F2F2', '#132257', false],
  NFO: ['#DD0000', '#DD0000', false],
  CRY: ['#1B458F', '#C4122E', true],
  WHU: ['#7A263A', '#1BB1E7', false],
  WOL: ['#FDB913', '#FDB913', false],
  LEE: ['#F2F2F2', '#F2F2F2', false],
  BUR: ['#6C1D45', '#99D6EA', false],
  IPS: ['#3A64A3', '#F2F2F2', false],
  HUL: ['#F5A12D', '#181818', true],
  COV: ['#5BB7E8', '#FFFFFF', false],
  // GK-specific overrides
  BRE_GK: ['#2BB0A6', '#2BB0A6', false],
  BHA_GK: ['#E8C547', '#E8C547', false],
}

// Fallback GK kit when no _GK entry exists for the club
const DEFAULT_GK: KitDef = ['#E8C547', '#E8C547', false]
// Fallback for unknown club codes
const UNKNOWN: KitDef = ['#5E5E5E', '#5E5E5E', false]

export function getKit(clubCode: string, isGk: boolean): KitDef {
  if (isGk) {
    const gkEntry = KITS[`${clubCode}_GK`]
    if (gkEntry) return gkEntry
    // If the club itself has an entry use the default GK yellow; otherwise UNKNOWN
    return KITS[clubCode] ? DEFAULT_GK : UNKNOWN
  }
  return KITS[clubCode] ?? UNKNOWN
}
