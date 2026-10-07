// Ordered rules; headline matches beat summary matches.
// public-safety also covers road status: closures, slides, Highway 1 / Caltrans work, traffic advisories.
export const RULES = [
 ['weather', /\b(weather|heat(wave)?|storms?|rain(fall)?|forecast|flood (watch|warning|advisory)|red flag warning|fog|el ni[ñn]o|atmospheric river|high surf|wind advisory|hot weather)\b/i],
 ['public-safety', /\b(police|sheriff'?s?|undersheriff|crash(es)?|collision|arrest(ed)?|shooting|homicide|killed|body found|stabbing|robbery|pursuit|suspect|sentenced|convicted|pleads? guilty|charges against|district attorney|gang|scam(mer)?|fraud|evacuation|shelter[- ]in[- ]place|search and rescue|rescued|missing|amber alert|fire (update|evacuation)|\w+ fire\b|battery fire|wildfire|prison|inmate|sideshows?|stolen vehicle|recall(s|ed)?|outbreak|e\. coli|cyclospora|alpr|license plate|highway (1|one)|hwy\.? ?1|sr-?1|caltrans|road (closures?|work|status|conditions)|(lane|road|highway|full|overnight|night) closures?|closure of highway|traffic (advisory|alert|control)|detours?|(land|rock|mud)slides?|slide (repair|area|work)|(paul|regent)'?s slide|mud creek)\b/i],
 ['sports', /\b(football|basketball|baseball|softball|soccer|volleyball|cross country|xc runners|wrestling|playoffs?|prep|varsity|athletes?|tournament|golf|laguna seca|pcal|mustangs|colts)\b/i],
 ['environment', /\b(ocean|marine|sea stars?|whales?|otters?|kelp|monarchs?|wildlife|sanctuary|climate|drought|habitat|shellfish|air (quality|monitoring)|surf club|deep[- ]sea|zooplankton|coastline|coastal (commission|erosion)|beach(es)?)\b/i],
 ['government', /\b(electoral(es)?|elecci[oó]n|council|supervisors|election|ballot|voters?|voting|props?\.?\s?\d+|proposition|measures?|candidates?|mayor|ordinance|budget|legislat\w*|school board|school district (considers|votes|trustees)|district considers|superintendent|funding|government center|ice facility|ice presence|ordinance|policy|underfunding|social services office|tax(es)?)\b/i],
 ['business', /\b(business|restaurants?|jobs|econom\w*|minimum wage|farmworkers?|farm workers?|gas (prices|stations)|diesel|tourism|retail|opens|housing market|home loans?|startup|interpreters|robotic surgery)\b/i],
];
export function categorize(s) {
  if (/NWS/.test(s.source)) return 'weather';
  for (const [c, r] of RULES) if (r.test(s.headline)) return c;
  if (/MBARI/.test(s.source)) return 'environment';
  const sum = (s.summary || '').slice(0, 300);
  for (const [c, r] of RULES) if (r.test(sum)) return c;
  return 'community';
}
