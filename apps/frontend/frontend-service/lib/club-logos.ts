// Centralized mapping between club names and local logo assets (served from public/teams).
// By using paths into /public/teams, assets are bundled into the build and persist on Railway.

const map: Record<string, string> = {
  // Canonical keys -> file paths under /public/teams
  acmilan: '/teams/AcMilanLogo.png',
  milan: '/teams/AcMilanLogo.png',
  inter: '/teams/FcInternazionaleMilano.png',
  internazionale: '/teams/FcInternazionaleMilano.png',
  fcinternazionalemilano: '/teams/FcInternazionaleMilano.png',
  monza: '/teams/AcMonzaLogo.png',
  acmonza: '/teams/AcMonzaLogo.png',
  roma: '/teams/AsRomaLogo.png',
  asroma: '/teams/AsRomaLogo.png',
  atalanta: '/teams/AtalantaBcLogo.png',
  atalantabc: '/teams/AtalantaBcLogo.png',
  cagliari: '/teams/CagliariCalcioLogo.png',
  cagliaricalcio: '/teams/CagliariCalcioLogo.png',
  empoli: '/teams/EmpolFcLogo.png',
  empolifc: '/teams/EmpolFcLogo.png',
  genoacfc: '/teams/GenoaCfcLogo.png',
  genoa: '/teams/GenoaCfcLogo.png',
  hellasverona: '/teams/HellasVeronaFcLogo.png',
  verona: '/teams/HellasVeronaFcLogo.png',
  hellasveronafc: '/teams/HellasVeronaFcLogo.png',
  juventus: '/teams/JuventusFcLogo.png',
  juventusfc: '/teams/JuventusFcLogo.png',
  lecce: '/teams/LecceLogo.png',
  bologna: '/teams/LogobolognaLogo.png',
  parma: '/teams/ParmaLogo.png',
  napoli: '/teams/NapolLogo.png',
  sscnapoli: '/teams/NapolLogo.png',
  salernitana: '/teams/SalernitanaCentenarioLogo.png',
  sassuolo: '/teams/SassuoloLogo.png',
  frosinone: '/teams/ScFrosinoneLogo.png',
  scfrosinone: '/teams/ScFrosinoneLogo.png',
  spal: '/teams/SpalstemmaLogo.png',
  lazio: '/teams/StemmaLazioCentenarioLogo.png',
  torino: '/teams/TorinoFcLogo.png',
  torinofc: '/teams/TorinoFcLogo.png',
  udinese: '/teams/UdineseLogo.png',
  fiorentina: '/teams/AcfFiorentinaLogo.png',
  acffiorentina: '/teams/AcfFiorentinaLogo.png',
  pisa: '/teams/PisaCalcioLogo.png',
  pisacalcio: '/teams/PisaCalcioLogo.png',
  cremonese: '/teams/UsCremoneselogo.png',
  uscremonese: '/teams/UsCremoneselogo.png',
  como: '/teams/ComoCalcioLogo.png',
  comocalcio: '/teams/ComoCalcioLogo.png',
};

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getLogoForTeam(name?: string): string | undefined {
  if (!name) return undefined;
  const key = normalize(name);
  // A few common alternates and Italian spellings
  const aliases: Record<string, string> = {
    intermilano: 'inter',
    internazionalefc: 'internazionale',
    napol: 'napoli',
    bolognafc: 'bologna',
    acfiorentina: 'acffiorentina',
    uslecce: 'lecce',
    ussalernitana: 'salernitana',
  };
  const finalKey = aliases[key] ?? key;
  return map[finalKey];
}

/**
 * Enhanced logo resolution function that handles fallbacks and ensures reliable logo paths
 * This is the primary function all components should use for team logos
 */
export function resolveTeamLogo(teamName?: string, backendLogoPath?: string | null): string {
  if (!teamName) {
    return ''; // Return empty string for missing team names
  }

  // First, try to get logo from our mapping function (primary source of truth)
  const mappedLogo = getLogoForTeam(teamName);
  if (mappedLogo) {
    return mappedLogo;
  }

  // Fallback to backend path if it exists and looks valid
  if (backendLogoPath && backendLogoPath.startsWith('/teams/') && !backendLogoPath.includes('undefined')) {
    return backendLogoPath;
  }

  // Return empty string if no valid logo found (components should handle this gracefully)
  return '';
}
